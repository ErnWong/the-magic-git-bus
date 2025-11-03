{ nixpkgs, nixpkgs-i686, nixos-generators }:
  let
    pkgs-i686 = nixpkgs-i686.legacyPackages.i686-linux;
  in
    nixos-generators.nixosGenerate {
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

                  set cursorline
                  set number
                  set numberwidth=4
                  set signcolumn=number
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

              (pkgs-i686.stdenv.mkDerivation {
                name = "vm-scripts";
                nativeBuildInputs = [
                  pkgs-i686.makeWrapper
                ];
                src = nixpkgs.lib.fileset.toSource {
                  root = ./.;
                  fileset = nixpkgs.lib.fileset.unions [
                    ./bin
                  ];
                };
                installPhase = ''
                  runHook preInstall
                  mkdir -p "$out"
                  cp -ar . "$out"
                  runHook postInstall
                '';
                postFixup = ''
                  patchShebangs --host "$out/bin/stream-git-dumps"
                  wrapProgram "$out/bin/stream-git-dumps" \
                    --set PATH ${pkgs-i686.lib.makeBinPath [
                      pkgs-i686.inotify-tools
                      pkgs-i686.jq
                    ]}
                  patchShebangs --host "$out/bin/dump-git.sh"
                  wrapProgram "$out/bin/dump-git.sh" \
                    --set PATH ${pkgs-i686.lib.makeBinPath [
                      pkgs-i686.jq
                    ]}
                  patchShebangs --host "$out/bin/send-to-host.sh"
                '';
              })
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
    }