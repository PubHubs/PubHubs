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
            config = {
              allowUnfree = true;
              android_sdk.accept_license = true;
            };
          };


          # Pinned to match ./rust-toolchain.toml so Nix, CI (rustup) and local all
          # build on the identical rustc.
          rustToolchain = (pkgs.rust-bin.fromRustupToolchainFile ./pubhubs/rust-toolchain.toml).override {
            extensions = [
              "rust-analyzer"
              "rust-src"
            ];
          };

          # Compose Android SDK for Capacitor builds.
          # Versions match global-client/android/variables.gradle.
          androidSdk = pkgs.androidenv.composeAndroidPackages {
            platformVersions = [ "35" "36" ];
            buildToolsVersions = [ "35.0.0" ];
            includeEmulator = false;
            includeSources = false;
            includeSystemImages = false;
            includeNDK = false;
          };

          # Python with the dependencies the hub modules import, so `mask test hub` runs
          # the Synapse module tests without a virtualenv.  Keep in sync with the direct
          # dependencies in ./pubhubs_hub/requirements.txt, which is what the hub's Docker
          # image installs; synapse's own transitive dependencies come along with it.
          pythonEnv = pkgs.python3.withPackages (ps: [
            # matrix-synapse is packaged as an application rather than a library;
            # toPythonModule exposes its `synapse` package to `import`.
            (ps.toPythonModule pkgs.matrix-synapse-unwrapped) # 1.165.0
            ps.authlib # 1.9.1
            ps.cryptography # 50.0.2
            ps.livekit-api # 1.1.0
            ps.pyopenssl # 26.4.0
            ps.twisted # 26.4.0
          ]);
        in
        {
          default = pkgs.mkShell {
            packages =
              with pkgs;
              [
                # Docker
                buildkit # 0.34.2
                docker # 29.9.3

                # Node
                nodejs_26 # 26.13.1

                # Python (provides python3, plus the hub's Synapse dependencies)
                pythonEnv # 3.14.10

                # Rust (pinned via ./rust-toolchain.toml)
                rustToolchain
                cargo-deny # 0.21.0
                cargo-outdated # 0.19.0
                cargo-edit # 0.13.14
                cargo-watch # 8.5.3

                # Android / Capacitor
                android-tools # 37.0.0p1
                androidSdk.androidsdk
                openjdk21
                android-studio

                # Other
                mask # 0.11.7
                openssl # 3.5.9
                pkg-config # 0.29.2
                sqlite # 3.54.0
                tmux # 3.8
              ]
              ++ [
                # Custom packages
                (pkgs.callPackage ./packages/yivi.nix { }) # 1.3.1
              ];

            # Android SDK tooling expects these environment variables.
            ANDROID_SDK_ROOT = "${androidSdk.androidsdk}/libexec/android-sdk";
            ANDROID_HOME = "${androidSdk.androidsdk}/libexec/android-sdk";
            JAVA_HOME = "${pkgs.openjdk21}";
          };
        }
      );
    };
}
