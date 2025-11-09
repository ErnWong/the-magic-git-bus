{ system, pkgs, nixpkgs, v86, vmImage, vmStates, fsex300 }:
  let
    libv86 = v86.packages.${system}.libv86;
    bios = v86.packages.${system}.seabios;
  in
    pkgs.stdenv.mkDerivation {
      name = "the-magic-git-bus";
      nativeBuildInputs = [
        pkgs.makeWrapper
        pkgs.zstd
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
        zstd -19 --keep "${vmImage}/iso/nixos.iso" -o ./images/nixos.iso
        zstd -19 --keep "${vmStates.loggedInState}/0-login.bin" -o ./images/0-login.bin.zst
        zstd -19 --keep "${vmStates.gitStates}/1-git-init.bin" -o ./images/1-git-init.bin.zst
        zstd -19 --keep "${vmStates.gitStates}/2-git-blobs.bin" -o ./images/2-git-blobs.bin.zst
        zstd -19 --keep "${vmStates.gitStates}/3-git-trees.bin" -o ./images/3-git-trees.bin.zst
        zstd -19 --keep "${vmStates.gitStates}/4-git-commits.bin" -o ./images/4-git-commits.bin.zst
        zstd -19 --keep "${vmStates.gitStates}/5-git-index.bin" -o ./images/5-git-index.bin.zst
        zstd -19 --keep "${vmStates.gitStates}/6-git-tags.bin" -o ./images/6-git-tags.bin.zst
        zstd -19 --keep "${vmStates.gitStates}/7-git-branches.bin" -o ./images/7-git-branches.bin.zst
        zstd -19 --keep "${vmStates.gitStates}/8-git-annotated-tags.bin" -o ./images/8-git-annotated-tags.bin.zst
        ln -s "${pkgs.fetchurl { # TODO Use npm the nix way
          url = "https://cdn.jsdelivr.net/npm/xterm@5.2.1/lib/xterm.min.js";
          hash = "sha256-ZZr3ei46ADqAYwr6ktRTx/IVPVh8ti9goKoQttkdnzY=";
        }}" ./xterm.js
        ln -s "${pkgs.fetchurl { # TODO Use npm the nix way
          url = "https://cdn.jsdelivr.net/npm/xterm@5.2.1/css/xterm.css";
          hash = "sha256-gy8/LGA7Q61DUf8ElwFQzHqHMBQnbbEmpgZcbdgeSHI=";
        }}" ./xterm.css
        ln -s "${pkgs.fetchurl { # TODO Use npm the nix way
          url = "https://cdn.jsdelivr.net/npm/elkjs@0.11.0/lib/elk.bundled.js";
          hash = "sha256-y/YbAYLpCF023NWzkvV8yBYnMWmsQL3oC1K4CERMXPg=";
        }}" ./elk.js
        ln -s "${fsex300}/fsex300.css" ./
        ln -s "${fsex300}/fsex300.eot" ./
        ln -s "${fsex300}/fsex300.svg" ./
        ln -s "${fsex300}/fsex300.ttf" ./
        ln -s "${fsex300}/fsex300.woff" ./
        ln -s "${fsex300}/fsex300.woff2" ./
        ''
        +
        # TODO Package this properly
        ''
        cp client/isomorphic-git/index.umd.min.js ./isomorphic-git.js
        cp client/isomorphic-git/index.umd.min.js.map ./
        ''
        #''
        #ln -s "${pkgs.fetchurl { # TODO Use npm the nix way
        #  url = "https://cdn.jsdelivr.net/npm/isomorphic-git@1.34.2/index.umd.min.js";
        #  hash = "sha256-1cmm7c9nXc5hk2acipphtUfjPco0Nw1oFvOKms8eqEo=";
        #  #url = "https://cdn.jsdelivr.net/npm/isomorphic-git@1.34.2/index.cjs";
        #  #hash = "sha256-LgW+AK3yZJOCREocZrDUSdUHt//xO+Vsxnk7WGvnxjE=";
        #}}" ./isomorphic-git.js
        #''
        +
        ''
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
