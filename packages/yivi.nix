{
  lib,
  pkgs,
}:
pkgs.buildGoModule rec {
  pname = "irmago";
  # To update, change the version number below and replace the hash
  version = "1.1.1";

  src = pkgs.fetchFromGitHub {
    owner = "privacybydesign";
    repo = "irmago";
    tag = "v${version}";
    # To get the hash of a new version, do `nix hash convert --hash-algo sha256 $(nix-prefetch-url --unpack https://github.com/privacybydesign/irmago/archive/refs/tags/v1.x.x.tar.gz 2>/dev/null)`
    hash = "sha256-nuyq2b+X0GFhLFkUyM+iAX7HtVltLxhTPwCPvq7DDF0=";
  };

  # To get the new vendor hash, change the hash to `sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=` and run `nix build ./#yivi`. You will get promted with the right hash.
  vendorHash = "sha256-64eEtU4qtowODc+Wax5kbe5EO2JTnBw9bJDomiqlA44=";

  subPackages = [ "yivi" ];

  doCheck = false;

  meta = {
    changelog = "https://github.com/privacybydesign/irmago/releases/tag/${src.tag}";
    description = "IRMA CLI and server implementation in Go";
    homepage = "https://docs.yivi.app/irma-cli";
    license = lib.licenses.asl20;
    mainProgram = "yivi";

    maintainers = with lib.maintainers; [
      jorritvanderheide
    ];
  };
}
