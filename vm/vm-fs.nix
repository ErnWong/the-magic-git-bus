{ system, pkgs, v86, vmImage }:
  let
    v86-tools = v86.packages.${system}.tools;
    rootfs = pkgs.stdenv.mkDerivation {
      name = "the-magic-git-bus-rootfs";
      nativeBuildInputs = [
        v86-tools
      ];
      unpackPhase = ":";
      buildPhase = ''
        mkdir -p "$out/fs"
        copy-to-sha256.py "${vmImage}/tarball/nixos-system-i686-linux.tar.xz" "$out/fs"
      '';
    };
    rootfsJson = pkgs.stdenv.mkDerivation {
      name = "the-magic-git-bus-rootfs";
      nativeBuildInputs = [
        v86-tools
      ];
      unpackPhase = ":";
      buildPhase = ''
        mkdir -p "$out"
        fs2json.py --out "$out/fs.json" "${vmImage}/tarball/nixos-system-i686-linux.tar.xz"
      '';
    };
    rootfsExtracted = pkgs.stdenv.mkDerivation {
      name = "the-magic-git-bus-rootfs";
      nativeBuildInputs = [
        v86-tools
      ];
      unpackPhase = ''
        mkdir extracted
        tar -xf "${vmImage}/tarball/nixos-system-i686-linux.tar.xz" -C ./extracted
      '';
      buildPhase = ''
        mkdir -p "$out/fs"
        copy-to-sha256.py ./extracted "$out/fs"
      '';
    };
    rootfsJsonExtracted = pkgs.stdenv.mkDerivation {
      name = "the-magic-git-bus-rootfs";
      nativeBuildInputs = [
        v86-tools
      ];
      unpackPhase = ''
        mkdir extracted
        tar -xf "${vmImage}/tarball/nixos-system-i686-linux.tar.xz" -C ./extracted
      '';
      buildPhase = ''
        mkdir -p "$out"
        fs2json.py --out "$out/fs.json" ./extracted
      '';
    };
  in
    {
      # Extracting it first is much much faster (seconds instead of hours!)
      rootfs = rootfsExtracted;
      rootfsJson = rootfsJsonExtracted;
    }
