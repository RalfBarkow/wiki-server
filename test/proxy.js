import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { once } from 'node:events'

import supertest from 'supertest'

const serverModule = await import('../index.js')
const { buildRemoteRequestURLs } = await import('../lib/server.js')
import defaultargs from '../lib/defaultargs.js'
import random from '../lib/random_id.js'

const makeRemoteServer = async () => {
  let lastRequestUrl = ''
  const remoteServer = http.createServer((req, res) => {
    lastRequestUrl = req.url || ''
    if ((req.url || '').startsWith('/favicon.png')) {
      res.writeHead(200, { 'Content-Type': 'image/png' })
      res.end(Buffer.from('proxy-test-png'))
      return
    }
    res.writeHead(404)
    res.end('not found')
  })

  remoteServer.listen(0, '127.0.0.1')
  await once(remoteServer, 'listening')
  const address = remoteServer.address()
  if (!address || typeof address === 'string') throw new Error('expected tcp address')
  return {
    close: () => new Promise((resolve, reject) => remoteServer.close(err => (err ? reject(err) : resolve()))),
    port: address.port,
    lastRequestUrl: () => lastRequestUrl,
  }
}

const makeWikiApp = async ({ url, port }) => {
  const testid = random()
  const data = fs.mkdtempSync(path.join(os.tmpdir(), `sfw-proxy-${testid}-`))
  fs.mkdirSync(path.join(data, 'status'), { recursive: true })
  fs.writeFileSync(path.join(data, 'status', 'sitemap.json'), JSON.stringify([]))

  const argv = defaultargs({
    data,
    packageDir: path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'node_modules'),
    port,
    security_legacy: true,
    test: true,
    url,
  })

  const app = await serverModule.default(argv)
  await once(app, 'owner-set')
  return { app, cleanup: () => fs.rmSync(data, { recursive: true, force: true }) }
}

describe('proxy', () => {
  let remote

  before(async () => {
    remote = await makeRemoteServer()
  })

  after(async () => {
    await remote.close()
  })

  it('falls back from https to http and preserves query strings', async () => {
    const wiki = await makeWikiApp({ url: 'http://localhost:55610', port: 55610 })
    const request = supertest(wiki.app)

    await request
      .get(`/proxy/localhost:${remote.port}/favicon.png?x=1`)
      .expect(200)
      .expect('Content-Type', /image\/png/)
      .then(res => {
        assert.equal(res.body.toString(), 'proxy-test-png')
        assert.equal(remote.lastRequestUrl(), '/favicon.png?x=1')
      })

    wiki.cleanup()
  })

  it('keeps http fallback available for non-loopback remotes on public sites', () => {
    const plan = buildRemoteRequestURLs('wiki.ralfbarkow.ch', 'fed.wiki.org', 'favicon.png')

    assert.equal(plan.blocked, false)
    assert.deepEqual(plan.candidates, ['https://fed.wiki.org/favicon.png', 'http://fed.wiki.org/favicon.png'])
  })

  it('blocks loopback proxy targets for non-loopback sites', async () => {
    const wiki = await makeWikiApp({ url: 'http://example.com:55611', port: 55611 })
    const request = supertest(wiki.app)

    await request.get(`/proxy/localhost:${remote.port}/favicon.png`).expect(403)

    wiki.cleanup()
  })
})
