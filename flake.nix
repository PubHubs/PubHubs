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
      forAllSystems =
        f:
        builtins.listToAttrs (
          map (system: {
            name = system;
            value = f system;
          }) systems
        );
    in
    {
      # Packages output
      packages = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          irmago = pkgs.callPackage ./packages/irmago.nix { };
          default = pkgs.callPackage ./packages/irmago.nix { };
        }
      );

      # Development shells
      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages =
              with pkgs;
              [
                rustc # 1.92
                cargo # 1.92
                cargo-watch # 8.5.3
                clippy
                rustfmt
                docker # 29.2.0
                mask # 0.11.7
                nodejs # 24.13.0
                nodePackages.sass # 1.85.1
                openssl # 3.6.0
                pkg-config # 0.29.2
                python3 # 3.13.11
                sqlite # 3.51.2
                tmux # 3.6a
              ]
              ++ [
                # Custom packages
                (pkgs.callPackage ./packages/irmago.nix { }) # 0.19.1
              ];
          };
        }
      );
    };
}
