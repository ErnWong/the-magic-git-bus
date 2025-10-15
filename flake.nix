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
    nixpkgs-i686.url = "github:NixOS/nixpkgs/23.05";
    nixos-generators = {
      #url = "github:nix-community/nixos-generators";
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
                system.stateVersion = "23.05";
                imports = [ "${modulesPath}/profiles/minimal.nix" ];

                # Allow logging in without password.
                users.users.root.initialHashedPassword = "";
            })
          ];
          specialArgs = {
            #diskSize = 512 * 1024 * 1024;
            diskSize = 3267021312;
          };
          #diskSize = 3267021312;
          format = "raw";
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
