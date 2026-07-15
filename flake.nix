{
  description = "A Nix flake for the PubHubs local development environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs, rust-overlay, ... }:
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
          yivi = pkgs.callPackage ./packages/yivi.nix { };
          default = pkgs.callPackage ./packages/yivi.nix { };
        }
      );

      # Development shells
      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs {
            inherit system;
            overlays = [ rust-overlay.overlays.default ];
          };
          # Pinned to match ./rust-toolchain.toml so Nix, CI (rustup) and local all
          # build on the identical rustc.
          rustToolchain = pkgs.rust-bin.fromRustupToolchainFile ./pubhubs/rust-toolchain.toml;
        in
        {
          default = pkgs.mkShell {
            packages =
              with pkgs;
              [
                # Docker
                buildkit # 0.27.1
                docker # 29.2.1

                # Node
                nodejs # 24.13.0

                # Python
                python3 # 3.13.12

                # Rust (pinned via ./rust-toolchain.toml)
                rustToolchain
                cargo-watch # 8.5.3

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
                (pkgs.callPackage ./packages/yivi.nix { }) # 1.0.0
              ];
          };
        }
      );
    };
}
