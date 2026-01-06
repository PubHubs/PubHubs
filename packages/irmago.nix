{
  lib,
  pkgs,
}:
pkgs.buildGoModule rec {
  pname = "irmago";
  version = "0.19.1";

  src = pkgs.fetchFromGitHub {
    owner = "privacybydesign";
    repo = "irmago";
    tag = "v${version}";
    hash = "sha256-ym/w8I3KrintiK4GACZ54uDwTYAOdsyK18lPB14rkYg=";
  };

  vendorHash = "sha256-JUwzhngYf50PhknAladHrO/67z9UmLpr5f9LeLX5fI4=";

  subPackages = [ "irma" ];

  meta = {
    changelog = "https://github.com/privacybydesign/irmago/releases/tag/${src.tag}";
    description = "IRMA CLI and server implementation in Go";
    homepage = "https://docs.yivi.app/irma-cli";
    license = lib.licenses.asl20;
    mainProgram = "irmago";
    
    maintainers = with lib.maintainers; [
      jorritvanderheide
    ];
  };
}
