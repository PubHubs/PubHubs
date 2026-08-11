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
          rustToolchain = pkgs.rust-bin.fromRustupToolchainFile ./pubhubs/rust-toolchain.toml;

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
            (ps.toPythonModule pkgs.matrix-synapse-unwrapped) # 1.156.0
            ps.authlib # 1.7.2
            ps.cryptography # 49.0.0
            ps.livekit-api # 1.1.0
            ps.pyopenssl # 26.3.0
            ps.twisted # 26.4.0
          ]);
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

                # Python (provides python3, plus the hub's Synapse dependencies)
                pythonEnv # 3.14.6

                # Rust (pinned via ./rust-toolchain.toml)
                rustToolchain
                cargo-watch # 8.5.3

                # Android / Capacitor
                android-tools # 35.0.2 — adb, fastboot
                androidSdk.androidsdk
                openjdk21

                # Other
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

            # Android SDK tooling expects these environment variables.
            ANDROID_SDK_ROOT = "${androidSdk.androidsdk}/libexec/android-sdk";
            ANDROID_HOME = "${androidSdk.androidsdk}/libexec/android-sdk";
            JAVA_HOME = "${pkgs.openjdk21}";
          };
        }
      );
    };
}
