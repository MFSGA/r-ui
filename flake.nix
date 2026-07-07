{
  description = "r-ui development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_22
              pnpm_10
              git
              pkg-config
              python3
              playwright-driver.browsers
            ];

            PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
            PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";

            shellHook = ''
              export PNPM_HOME="$HOME/.local/share/pnpm"
              export COREPACK_HOME="$HOME/.cache/node/corepack"
              export XDG_CACHE_HOME="$HOME/.cache"
              export XDG_CONFIG_HOME="$HOME/.config"
              export XDG_DATA_HOME="$HOME/.local/share"
              export PATH="${pkgs.nodejs_22}/bin:${pkgs.pnpm_10}/bin:$PNPM_HOME:$PATH"

              echo "r-ui dev shell: Node $(node --version), pnpm $(pnpm --version)"
            '';
          };
        });
    };
}
