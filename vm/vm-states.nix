{ system, pkgs, nixpkgs, v86, vmFs, vmImage }:
  let
    libv86 = v86.packages.${system}.libv86;
    bios = v86.packages.${system}.seabios;
  in
    rec {
      loggedInState = pkgs.stdenv.mkDerivation {
        name = "the-magic-git-bus-login-state";
        nativeBuildInputs = [
          pkgs.nodejs_24
          pkgs.zstd
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
          ln -s "${vmFs.rootfs}/fs" ./fs
          ln -s "${vmFs.rootfsJson}/fs.json" ./fs.json
          ln -s "${vmImage.kernel}/bzImage" images/bzImage
          ln -s "${vmImage.initrd}/initrd.zst" images/initrd.zst
          ./vm/build-state-0-login.js
        '';
        installPhase = ''
          mkdir -p "$out"
          zstd -19 images/0-login.bin -o "$out/0-login.bin.zst"
        '';
      };
      gitStates = pkgs.stdenv.mkDerivation {
        name = "the-magic-git-bus-git-states";
        nativeBuildInputs = [
          pkgs.nodejs_24
          pkgs.zstd
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
          ln -s "${vmFs.rootfs}/fs" ./fs
          ln -s "${vmFs.rootfsJson}/fs.json" ./fs.json
          ln -s ${loggedInState}/0-login.bin.zst ./images
          ln -s "${vmImage.kernel}/bzImage" images/bzImage
          ln -s "${vmImage.initrd}/initrd.zst" images/initrd.zst
          ./vm/build-state-1-git.js
        '';
        installPhase = ''
          mkdir -p "$out"
          zstd -19 images/1-git-init.bin -o "$out/1-git-init.bin.zst"
          zstd -19 images/2-git-blobs.bin -o "$out/2-git-blobs.bin.zst"
          zstd -19 images/3-git-trees.bin -o "$out/3-git-trees.bin.zst"
          zstd -19 images/4-git-commits.bin -o "$out/4-git-commits.bin.zst"
          zstd -19 images/5-git-index.bin -o "$out/5-git-index.bin.zst"
          zstd -19 images/6-git-tags.bin -o "$out/6-git-tags.bin.zst"
          zstd -19 images/7-git-branches.bin -o "$out/7-git-branches.bin.zst"
          zstd -19 images/8-git-annotated-tags.bin -o "$out/8-git-annotated-tags.bin.zst"
        '';
      };
    }