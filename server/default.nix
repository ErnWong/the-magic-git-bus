{ system, pkgs, nixpkgs, v86, vmImage, vmStates }:
  let
    libv86 = v86.packages.${system}.libv86;
    bios = v86.packages.${system}.seabios;
  in
    pkgs.stdenv.mkDerivation {
      name = "the-magic-git-bus";
      nativeBuildInputs = [
        pkgs.makeWrapper
      ];
      src = nixpkgs.lib.fileset.toSource {
        root = ./..;
        fileset = nixpkgs.lib.fileset.unions [
          ../bin
          ../config
          ../client
          ./run.sh
        ];
      };
      postPatch = ''
        patchShebangs --build ./bin/the-magic-git-bus
        patchShebangs --build ./server/run.sh
      '';
      buildPhase = ''
        runHook preBuild
        ln -s "${libv86}" v86
        ln -s "${bios}" bios
        mkdir -p images
        ln -s "${vmImage}/iso/nixos.iso" ./images
        ln -s "${vmStates.loggedInState}/0-login.bin" ./images
        ln -s "${vmStates.gitStates}/1-git-init.bin" ./images
        ln -s "${vmStates.gitStates}/2-git-blobs.bin" ./images
        ln -s "${vmStates.gitStates}/3-git-trees.bin" ./images
        ln -s "${pkgs.fetchurl { # TODO Use npm the nix way
          url = "https://cdn.jsdelivr.net/npm/xterm@5.2.1/lib/xterm.min.js";
          hash = "sha256-ZZr3ei46ADqAYwr6ktRTx/IVPVh8ti9goKoQttkdnzY=";
        }}" ./xterm.js
        ln -s "${pkgs.fetchurl { # TODO Use npm the nix way
          url = "https://cdn.jsdelivr.net/npm/xterm@5.2.1/css/xterm.css";
          hash = "sha256-gy8/LGA7Q61DUf8ElwFQzHqHMBQnbbEmpgZcbdgeSHI=";
        }}" ./xterm.css
        mv client/* .
        rmdir client
        runHook postBuild
      '';
      installPhase = ''
        runHook preInstall
        mkdir -p "$out"
        cp -ar . "$out"
        runHook postInstall
      '';
      postFixup = ''
        wrapProgram "$out/bin/the-magic-git-bus" \
          --set PATH ${pkgs.lib.makeBinPath [
            pkgs.static-web-server
            pkgs.uutils-coreutils-noprefix # for dirname
          ]}
      '';
    }
