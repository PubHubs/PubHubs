# Ensure that this repository is placed in a folder that is **not** managed by the home-manager
# version of impermanence. Doing so may cause issues with folder permissions related to the testhub.
{
  description = "A Nix-flake for the PubHubs local development environment";

  inputs = {
    # Specify the Nixpkgs repository version to use for building the development environment
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
      # Define the system architecture
      system = "x86_64-linux";
      # system = "x86_64-darwin";
    in
    {
      # Define the development shell for the specified system architecture
      devShells."${system}".default =
        let
          pkgs = import nixpkgs {
            inherit system;
          };
        in
        pkgs.mkShell {
          # Ensure that Docker is already installed on your system before using the development environment
          packages = with pkgs; [
            rustc
            cargo
            cargo-watch
            mask
            nodejs
            nodePackages.sass
            openssl
            pkg-config
            python3
            sqlite
          ];

          # Shell hook that executes when the development environment starts
          shellHook = ''
            # If the shell is Fish, start a new Fish shell session to ensure proper environment setup
            if [[ "$SHELL" == *"fish"* ]]; then
              alias pubhubs="mask"
              exec fish
            fi
          '';
        };
    };
}
