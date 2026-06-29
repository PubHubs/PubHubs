{
  lib,
  pkgs,
}:
pkgs.buildGoModule rec {
  pname = "irmago";
  # To update, change the version number below and replace the hash
  version = "1.0.0";

  src = pkgs.fetchFromGitHub {
    owner = "privacybydesign";
    repo = "irmago";
    tag = "v${version}";
    # To get the hash of a new version, do `nix hash convert --hash-algo sha256 $(nix-prefetch-url --unpack https://github.com/privacybydesign/irmago/archive/refs/tags/v1.x.x.tar.gz 2>/dev/null)`
    hash = "sha256-ZV8H4WNxIIfkk5KYQdbbOEfyjI1vbI+WkdHBH6P4010=";
  };

  vendorHash = "sha256-d2whPQmcUAFGbuSztBB7yZTuAlQyIQEnWGDnwbcPMxE=";

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
