{
  description = "wiki-server dev shell (repomix-tools loaded via .envrc)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";

    repomix-tools.url = "git+file:///Users/rgb/flakes/repomix-tools";
  };

  outputs = { self, nixpkgs, flake-utils, repomix-tools }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_20
            pkgs.git
            pkgs.jq
            pkgs.ripgrep
            pkgs.coreutils
            pkgs.findutils

            # Nix-pure Repomix tooling (real repomix binary)
            repomix-tools.packages.${system}.repomix
            repomix-tools.packages.${system}.repomix-pack-md
            repomix-tools.packages.${system}.repomix-pack-remote-md
          ];

          shellHook = ''
            echo
            echo "wiki-server devShell"
            echo
            echo "Repomix (Nix-pure):"
            echo "  • repomix --version"
            echo "  • repomix-pack-md [output.md]"
            echo "  • repomix-pack-remote-md <url> [out]"
            echo
          '';
        };
      });
}
