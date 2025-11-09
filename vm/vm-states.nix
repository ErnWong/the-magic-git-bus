{ system, pkgs, nixpkgs, v86, vmFs }:
  let
    libv86 = v86.packages.${system}.libv86;
    bios = v86.packages.${system}.seabios;
  in
    rec {
      loggedInState = pkgs.stdenv.mkDerivation {
        name = "the-magic-git-bus-login-state";
        nativeBuildInputs = [
          pkgs.nodejs_24
        ];
        src = nixpkgs.lib.fileset.toSource {
          root = ./..;
          fileset = nixpkgs.lib.fileset.unions [
            ./build-state-0-login.js
            ./state-builder.js
            ../config
          ];
        };
        postPatch = ''
          patchShebangs --build ./vm/build-state-0-login.js
        '';
        buildPhase = ''
          ln -s "${libv86}" v86
          ln -s "${bios}" bios
          mkdir -p images
          ln -s "${vmFs.rootfs}" ./fs
          ln -s "${vmFs.rootfsJson}/fs.json" ./fs.json
          ./vm/build-state-0-login.js
        '';
        installPhase = ''
          mkdir -p "$out"
          cp images/0-login.bin "$out"
        '';
      };
      gitStates = pkgs.stdenv.mkDerivation {
        name = "the-magic-git-bus-git-states";
        nativeBuildInputs = [
          pkgs.nodejs_24
        ];
        src = nixpkgs.lib.fileset.toSource {
          root = ./..;
          fileset = nixpkgs.lib.fileset.unions [
            ./build-state-1-git.js
            ./state-builder.js
            ../config
          ];
        };
        postPatch = ''
          patchShebangs --build ./vm/build-state-1-git.js
        '';
        buildPhase = ''
          ln -s "${libv86}" v86
          ln -s "${bios}" bios
          mkdir -p images
          ln -s "${vmFs.rootfs}" ./fs
          ln -s "${vmFs.rootfsJson}/fs.json" ./fs.json
          ln -s ${loggedInState}/0-login.bin ./images
          ./vm/build-state-1-git.js
        '';
        installPhase = ''
          mkdir -p "$out"
          cp images/1-git-init.bin "$out"
          cp images/2-git-blobs.bin "$out"
          cp images/3-git-trees.bin "$out"
          cp images/4-git-commits.bin "$out"
          cp images/5-git-index.bin "$out"
          cp images/6-git-tags.bin "$out"
          cp images/7-git-branches.bin "$out"
          cp images/8-git-annotated-tags.bin "$out"
        '';
      };
    }