{
  lib,
  pkgs,
}:
pkgs.buildGoModule.override { go = pkgs.go_1_27; } rec {
  pname = "irmago";

  # To update, run `mask update yivi <new version>` from the repository root.  That wraps
  # nix-update in a throwaway git worktree and rewrites `version`, `hash` and `vendorHash` in
  # one pass.
  #
  # Keep this version in sync with the `yivi_build` stage of pubhubs_hub/Dockerfile, and
  # update the trailing version comment next to this package in flake.nix.  Afterwards run
  # `direnv reload` and check `yivi version`: direnv only watches flake.nix and flake.lock, so
  # without a reload the shell keeps serving the previously built binary.
  version = "1.3.1";

  src = pkgs.fetchFromGitHub {
    owner = "privacybydesign";
    repo = "irmago";
    tag = "v${version}";
    hash = "sha256-3Sy3u4UA69CG1YRFg8z5E2vk30Odh8jMsB1XzGzqqpM=";
  };

  vendorHash = "sha256-g9zPX3/UoI6ykyGQmcmnjN7bnAGTh40aYfRvn6JbelE=";

  subPackages = [ "yivi" ];

  doCheck = false;

  meta = {
    changelog = "https://github.com/privacybydesign/irmago/releases/tag/${src.tag}";
    description = "IRMA CLI and server implementation in Go";
    homepage = "https://docs.yivi.app/irma-cli";
    license = lib.licenses.asl20;
    mainProgram = "yivi";

    maintainers = [
      {
        name = "Jorrit van der Heide";
        github = "jorritvanderheide";
      }
    ];
  };
}
