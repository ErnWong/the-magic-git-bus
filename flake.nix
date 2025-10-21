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
        vmImage = import ./vm/vm-image.nix {
          inherit nixpkgs nixpkgs-i686 nixos-generators;
        };
        vmStates = import ./vm/vm-states.nix {
          inherit system pkgs nixpkgs v86 vmImage;
        };
        theMagicGitBus = pkgs.stdenv.mkDerivation {
          name = "theMagicGitBus";
        };
      in
      {
        packages = {
          inherit vmImage vmStates theMagicGitBus;
        };
        defaultPackage = theMagicGitBus;
      }
    );
}
