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
                # Docker
                docker # 29.2.1
                buildkit # 0.27.1

                # Node
                nodejs # 24.13.0

                # Python
                python3 # 3.13.12

                # Rust
                rustc # 1.94
                cargo # 1.94
                cargo-watch # 8.5.3
                clippy # 0.1.94
                rustfmt # 1.8.0

                # Other
                android-tools # 35.0.2
                mask # 0.11.7
                openssl # 3.6.1
                pkg-config # 0.29.2
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
