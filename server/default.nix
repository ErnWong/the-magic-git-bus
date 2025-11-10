{ system, pkgs, nixpkgs, v86, vmImage, vmFs, vmStates, fsex300 }:
  let
    libv86 = v86.packages.${system}.libv86;
    bios = v86.packages.${system}.seabios;
  in
    pkgs.stdenv.mkDerivation {
      pname = "the-magic-git-bus";
      version = "0.0.0";
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
        ln -s "${vmFs.rootfs}/fs" ./fs
        ln -s "${vmFs.rootfsJson}/fs.json" ./fs.json
        mkdir -p images
        ln -s "${vmImage.kernel}/bzImage" images/bzImage
        ln -s "${vmImage.initrd}/initrd.zst" images/initrd.zst
        ln -s "${vmStates.loggedInState}/"* ./images/
        ln -s "${vmStates.gitStates}/"* ./images/
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
        # cp -ar . "$out"
        cp -Lr . "$out"
        runHook postInstall
      '';
      fixupPhase = ''
        wrapProgram "$out/bin/the-magic-git-bus" \
          --set PATH ${pkgs.lib.makeBinPath [
            pkgs.static-web-server
            pkgs.uutils-coreutils-noprefix # for dirname
          ]}
        # Don't patch anything else - our rootfs contains x86 files that shouldn't be modified.
      '';
    }
