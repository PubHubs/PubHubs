{
  description = "A Nix flake for the PubHubs local development environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
      # Define the supported systems
      systems = [
        "x86_64-linux"
        "x86_64-darwin"
      ];

      # Define the development shell for the specified system
      devShellsBySys = builtins.listToAttrs (
        map (system: {
          name = system;
          value = {
            default =
              let
                pkgs = import nixpkgs { inherit system; };
              in
              pkgs.mkShell {
                packages = with pkgs; [
                  rustc
                  cargo
                  cargo-watch
                  docker
                  mask
                  nodejs
                  nodePackages.sass
                  openssl
                  pkg-config
                  python3
                  sqlite
                ];
              };
          };
        }) systems
      );
    in
    {
      devShells = devShellsBySys // {
        default = devShellsBySys."${builtins.currentSystem}".default;
      };
    };
}
