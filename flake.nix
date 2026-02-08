{
  description = "wiki-server dev shell (repomix-tools loaded via .envrc)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_20
            pkgs.nodePackages.repomix
            pkgs.git
            pkgs.ripgrep
            pkgs.jq
            pkgs.coreutils
            pkgs.findutils
          ];
          shellHook = ''
            echo "🔧 wiki-server dev shell ready"
          '';
        };
      });
}
