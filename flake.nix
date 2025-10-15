{
  description = "Depths of git: an interactive tour to how git works under the hood";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
    v86 = {
      url = "github:ErnWong/v86-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    nixos-generators = {
      url = "github:nix-community/nixos-generators";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };
  outputs = { self, nixpkgs, utils, v86, nixos-generators }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };
        osImage = nixos-generators.nixosGenerate {
          inherit system;
          modules = [
            {

            }
          ];
          format = "raw";
        };
        depthsOfGit = pkgs.stdenv.mkDerivation {
          name = "depthsofgit";
        };
      in
      {
        packages = {
          inherit osImage depthsOfGit;
        };
        defaultPackage = depthsOfGit;
      }
    );
}
