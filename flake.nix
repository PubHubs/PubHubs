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

      # Helper to generate attrs for each system
      forAllSystems = f: builtins.listToAttrs (
        map (system: {
          name = system;
          value = f system;
        }) systems
      );
    in
    {
      # Packages output
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          irmago = pkgs.callPackage ./packages/irmago.nix { };
          default = pkgs.callPackage ./packages/irmago.nix { };
        }
      );

      # Development shells
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
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
            ] ++ [
              # Custom packages
              (pkgs.callPackage ./packages/irmago.nix { })
            ];
          };
        }
      );
    };
}
