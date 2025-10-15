{
  description = "Depths of git: an interactive tour to how git works under the hood";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
    v86 = {
      url = "github:ErnWong/v86-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    # Avoid rebuilding everything for 32-bit by using older version where nixos still
    # supported and cached the i686 builds.
    #nixpkgs-i686.url = "github:NixOS/nixpkgs/22.11";
    #nixpkgs-i686.url = "github:NixOS/nixpkgs/20.09";
    #nixpkgs-i686.url = "github:NixOS/nixpkgs/21.11";
    #nixpkgs-i686.url = "github:NixOS/nixpkgs/22.05"; # error: Package ‘lkl-2019-10-04’ in /nix/store/di36mqc6y19ivaa4qjrb2l82c6dqg7m3-source/pkgs/applications/virtualization/lkl/default.nix:57 is not supported on ‘i686-linux’, refusing to evaluate.
    nixpkgs-i686.url = "github:NixOS/nixpkgs/23.05";
    nixos-generators = {
      #url = "github:nix-community/nixos-generators";
      #url = "github:nix-community/nixos-generators/1.6.0";
      #url = "github:nix-community/nixos-generators/1.2.0"; # No flake
      #url = "github:nix-community/nixos-generators/1.5.0"; # No flake
      #url = "github:nix-community/nixos-generators/1.7.0";
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
        vmImage = nixos-generators.nixosGenerate {
          #system = "i686-linux";
          pkgs = nixpkgs-i686.legacyPackages.i686-linux;
          modules = [
            ({ lib, modulesPath, ... }: {
                #system.stateVersion = "25.11";
                #system.stateVersion = "22.11";
                #system.stateVersion = "20.09";
                #system.stateVersion = "21.11";
                #system.stateVersion = "22.05";
                system.stateVersion = "23.05";
                imports = [ "${modulesPath}/profiles/minimal.nix" ];
            })
          ];
          #format = "raw"; # can't open fsimg nixos.raw: Value too large for defined data type
          # Not quite applicable but similar: https://github.com/NixOS/nixpkgs/pull/82718
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
