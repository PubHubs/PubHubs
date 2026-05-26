{
  lib,
  pkgs,
}:
pkgs.buildGoModule rec {
  pname = "irmago";
  # To update, change the version number below and replace the hash
  version = "0.19.2";

  src = pkgs.fetchFromGitHub {
    owner = "privacybydesign";
    repo = "irmago";
    tag = "v${version}";
    # To get the hash of a new version, do `nix hash convert --hash-algo sha256 $(nix-prefetch-url --unpack https://github.com/privacybydesign/irmago/archive/refs/tags/v0.19.x.tar.gz 2>/dev/null)`
    hash = "sha256-CJDKwBL07Ok8MsZiu8WDTFJbsikgGHGt/E3k2NbXFyk=";
  };

  vendorHash = "sha256-JUwzhngYf50PhknAladHrO/67z9UmLpr5f9LeLX5fI4="; # This always stays the same

  subPackages = [ "irma" ];

  meta = {
    changelog = "https://github.com/privacybydesign/irmago/releases/tag/${src.tag}";
    description = "IRMA CLI and server implementation in Go";
    homepage = "https://docs.yivi.app/irma-cli";
    license = lib.licenses.asl20;
    mainProgram = "irma";

    maintainers = with lib.maintainers; [
      jorritvanderheide
    ];
  };
}
