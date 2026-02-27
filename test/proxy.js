import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
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
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
        ETag: '"proxy-test"',
        Connection: 'keep-alive',
        'Proxy-Connection': 'keep-alive',
        Upgrade: 'h2c',
        'Transfer-Encoding': 'chunked',
      })
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
        assert.equal(res.headers['cache-control'], 'public, max-age=60')
        assert.equal(res.headers.etag, '"proxy-test"')
        assert.notEqual(res.headers.connection, 'keep-alive')
        assert.equal(res.headers['proxy-connection'], undefined)
        assert.equal(res.headers.upgrade, undefined)
      })

    wiki.cleanup()
  })

  it('keeps http fallback available for non-loopback remotes on public sites', () => {
    const plan = buildRemoteRequestURLs('wiki.ralfbarkow.ch', 'fed.wiki.org', 'favicon.png')

    assert.equal(plan.blocked, false)
    assert.deepEqual(plan.candidates, ['https://fed.wiki.org/favicon.png', 'http://fed.wiki.org/favicon.png'])
  })

  it('buffers slow json responses to avoid partial 200 bodies', async () => {
    const slowRemote = http.createServer(async (req, res) => {
      if ((req.url || '').startsWith('/system/sitemap.json')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.write('{"items":[')
        for (let i = 0; i < 42; i += 1) {
          if (i > 0) res.write(',')
          res.write(JSON.stringify({ slug: `page-${i}` }))
          await delay(50)
        }
        res.end(']}')
        return
      }
      res.writeHead(404)
      res.end('not found')
    })

    slowRemote.listen(0, '127.0.0.1')
    await once(slowRemote, 'listening')
    const address = slowRemote.address()
    if (!address || typeof address === 'string') throw new Error('expected tcp address')

    const wiki = await makeWikiApp({ url: 'http://localhost:55612', port: 55612 })
    const request = supertest(wiki.app)

    try {
      await request
        .get(`/proxy/localhost:${address.port}/system/sitemap.json`)
        .expect(200)
        .expect('Content-Type', /application\/json/)
        .then(res => {
          const parsed = JSON.parse(res.text)
          assert.equal(parsed.items.length, 42)
        })
    } finally {
      await new Promise((resolve, reject) => slowRemote.close(err => (err ? reject(err) : resolve())))
      wiki.cleanup()
    }
  })

  it('blocks loopback proxy targets for non-loopback sites', async () => {
    const wiki = await makeWikiApp({ url: 'http://example.com:55611', port: 55611 })
    const request = supertest(wiki.app)

    await request.get(`/proxy/localhost:${remote.port}/favicon.png`).expect(403)

    wiki.cleanup()
  })
})
