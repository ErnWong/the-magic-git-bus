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
          pkgs = nixpkgs-i686.legacyPackages.i686-linux;
          modules = [
            ({ lib, modulesPath, ... }: {
                system.stateVersion = "23.05";
                imports = [ "${modulesPath}/profiles/minimal.nix" ];

                # Always use serial port
                boot.kernelParams = [ "console=ttyS0,115200n8" ];

                networking.hostName = "gitbus";

                # Automatically log in at the virtual consoles.
                services.getty.autologinUser = "root";

                # Don't append "Installer" to grub menu entries. We're not an installer iso.
                isoImage.appendToMenuLabel = "";

                environment.systemPackages = [
                  (pkgs-i686.vim-full.customize {
                    vimrcConfig.packages.myVimPackage = {
                      start = [
                        pkgs-i686.vimPlugins.fugitive
                        pkgs-i686.vimPlugins.rhubarb
                        pkgs-i686.vimPlugins.vim-gitgutter
                        pkgs-i686.vimPlugins.vim-bufkill
                        pkgs-i686.vimPlugins.gruvbox
                        pkgs-i686.vimPlugins.vim-airline
                        pkgs-i686.vimPlugins.vim-airline-themes
                      ];
                    };
                    vimrcConfig.customRC = ''
                      set nocompatible
                      inoremap jk <esc>
                      nnoremap <space> :
                      vnoremap <space> :
                      nnoremap <C-c> :BD<cr>
                      nnoremap <C-w>h :wincmd v<cr>
                      nnoremap <C-w>j :wincmd s<cr>:wincmd k<cr>
                      nnoremap <C-w>k :wincmd s<cr>
                      nnoremap <C-w>l :wincmd v<cr>:wincmd l<cr>

                      set nobackup
                      set nowritebackup

                      let g:gruvbox_italic = 1
                      let g:gruvbox_bold = 1
                      colorscheme gruvbox
                      set background=dark
                      set termguicolors
                      set t_8f=[38;2;%lu;%lu;%lum " Needed in tmux and v86 xtermjs for setting foreground color (or else invisible cursor and buggy background)
                      set t_8b=[48;2;%lu;%lu;%lum " Needed in tmux and v86 xtermjs for setting background color
                      set t_ZH=[3m " Italics
                      set t_ZR=[23m " End italics
                      syntax on

                      let g:airline_theme='gruvbox'
                      let g:airline#extensions#tabline#enabled = 1
                      let g:airline#extensions#tabline#left_sep = '''
                      let g:airline#extensions#tabline#left_alt_sep = '│'

                      set cusorline
                      set number
                      set numberwidth=4
                      set signcolum=number
                      set laststatus=2
                      set noshowmode

                      set mouse=a
                    '';
                  })
                  pkgs-i686.nano
                  ((pkgs-i686.emacsPackagesFor pkgs-i686.emacs).emacsWithPackages (
                    epkgs: [epkgs.magit]
                  ))

                  # msedit is new and didn't exist in the older nixpkgs version
                  nixpkgs.legacyPackages.i686-linux.msedit

                  # In case the user gets curious
                  pkgs-i686.neofetch
                  nixpkgs.legacyPackages.i686-linux.fastfetch
                  pkgs-i686.hyfetch
                  pkgs-i686.sl
                  pkgs-i686.cowsay

                  # Important for the git tutorial
                  pkgs-i686.pigz # For compressing objects into zlib stream
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
        libv86 = v86.packages.${system}.libv86;
        bios = v86.packages.${system}.seabios;
        vmStates = rec {
          loggedInState = pkgs.stdenv.mkDerivation {
            name = "the-magic-git-bus-login-state";
            nativeBuildInputs = [
              pkgs.nodejs_24
            ];
            src = nixpkgs.lib.fileset.toSource {
              root = ./.;
              fileset = nixpkgs.lib.fileset.unions [
                ./build-state-0-login.js
                ./state-builder.js
              ];
            };
            postPatch = ''
              patchShebangs --build build-state-0-login.js
            '';
            buildPhase = ''
              ln -s "${libv86}" v86
              ln -s "${bios}" bios
              mkdir -p images
              ln -s "${vmImage}/iso/nixos.iso" ./images
              ./build-state-0-login.js
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
              root = ./.;
              fileset = nixpkgs.lib.fileset.unions [
                ./build-state-1-git.js
                ./state-builder.js
              ];
            };
            postPatch = ''
              patchShebangs --build build-state-1-git.js
            '';
            buildPhase = ''
              ln -s "${libv86}" v86
              ln -s "${bios}" bios
              mkdir -p images
              ln -s ${vmImage}/iso/nixos.iso ./images
              ln -s ${loggedInState}/0-login.bin ./images
              ./build-state-1-git.js
            '';
            installPhase = ''
              mkdir -p "$out"
              cp images/1-git-init.bin "$out"
            '';
          };
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
