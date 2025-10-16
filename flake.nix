{
  description = "The magic git bus: an interactive tour to how git works under the hood";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
    v86 = {
      url = "github:ErnWong/v86-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    # Avoid rebuilding everything for 32-bit by using older version where nixos still
    # supported and cached the i686 builds.
    nixpkgs-i686.url = "github:NixOS/nixpkgs/23.05";
    nixos-generators = {
      url = "github:nix-community/nixos-generators/1.8.0";
      inputs.nixpkgs.follows = "nixpkgs-i686";
    };
  };
  outputs = { self, nixpkgs, utils, v86, nixos-generators, nixpkgs-i686 }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
        pkgs-i686 = nixpkgs-i686.legacyPackages.i686-linux;
        vmImage = nixos-generators.nixosGenerate {
          #system = "i686-linux";
          pkgs = nixpkgs-i686.legacyPackages.i686-linux;
          modules = [
            ({ lib, modulesPath, ... }: {
                system.stateVersion = "23.05";
                imports = [ "${modulesPath}/profiles/minimal.nix" ];

                # Automatically log in at the virtual consoles.
                services.getty.autologinUser = "root";

                # Don't append "Installer" to grub menu entries. We're not an installer iso.
                isoImage.appendToMenuLabel = "";

                environment.systemPackages = [
                  pkgs-i686.vim
                  pkgs-i686.nano
                  nixpkgs.legacyPackages.i686-linux.msedit
                ];
                programs = {
                  git.enable = true;
                };
            })
          ];
          # Currently failing to generate a hard drive raw image:
          #format = "raw"; # can't open fsimg nixos.raw: Value too large for defined data type
          # Not quite applicable but similar: https://github.com/NixOS/nixpkgs/pull/82718
          # So instead we generate a live iso which seems to work.
          format = "iso";
        };
        vmState = pkgs.stdenv.mkDerivation {

        };
        depthsOfGit = pkgs.stdenv.mkDerivation {
          name = "depthsofgit";
        };
      in
      {
        packages = {
          inherit vmImage vmState depthsOfGit;
        };
        defaultPackage = depthsOfGit;
      }
    );
}
