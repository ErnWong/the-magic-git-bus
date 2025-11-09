{ nixpkgs, nixpkgs-i686, nixos-generators }:
  let
    pkgs-i686 = nixpkgs-i686.legacyPackages.i686-linux;
    method = "9p"; # "9p" | "inotify"
  in
    nixos-generators.nixosGenerate {
      pkgs = nixpkgs-i686.legacyPackages.i686-linux;
      modules = [
        ({ lib, modulesPath, ... }: {
            system.stateVersion = "23.05";
            imports = [ "${modulesPath}/profiles/minimal.nix" ];

            # Always use serial port
            boot.kernelParams = [ "console=ttyS0,115200n8" ];
            boot.loader.grub.enable = lib.mkForce false;
            boot.loader.systemd-boot.enable = lib.mkForce false;
            formatAttr = "tarball";
            fileExtension = ".tar.xz";
            boot.initrd.availableKernelModules = [
              "virtio_pci"
              "9p"
              "9pnet"
              "9pnet_virtio"
            ];
            boot.initrd.postDeviceCommands = ''
              mount -t 9p -o trans=virtio,version=9p2000.L host9p /sysroot
            '';
            # fileSystems."/" = {
              # device = "/dev/";
              # fstype = "9p";
            # };

            networking.hostName = "gitbus";

            # Automatically log in at the virtual consoles.
            services.getty.autologinUser = "root";

            #boot.supportedFilesystems = lib.mkForce [ ];
  
            # If you don't need non-free firmware
            hardware.enableRedistributableFirmware = lib.mkForce false;

            # If you don't want the docs
            documentation.enable = lib.mkForce false;
            documentation.nixos.enable = lib.mkForce false;

            # If you don't need wifi
            networking.wireless.enable = lib.mkForce false;

            networking.useDHCP = false;
            networking.interfaces = {};

            # This is used to pull in stdenv to speed up the installation, so removing it
            # means you have to download it
            system.extraDependencies = lib.mkForce [];

            # Don't append "Installer" to grub menu entries. We're not an installer iso.
            #isoImage.appendToMenuLabel = "";

            services.openssh.enable = lib.mkForce false;

            #https://sidhion.com/blog/nixos_server_issues
            nix.enable = false;
            nixpkgs.overlays = [
            (
              self: super:
              {
                dbus = super.dbus.override {
                  systemdMinimal = self.systemd;
                };
              }
            )
            ];
            security.sudo.enable = false;
            # disabledModules = [ "security/wrappers/default.nix" ];
            # options.security = {
            #   wrappers = lib.mkOption {
            #     type = lib.types.attrs;
            #     default = { };
            #   };
            #   wrapperDir = lib.mkOption {
            #     type = lib.types.path;
            #     default = "/run/wrappers/bin";
            #   };
            # };

            environment.systemPackages = [
              #(pkgs-i686.vim-full.customize {
              #  vimrcConfig.packages.myVimPackage = {
              #    start = [
              #      pkgs-i686.vimPlugins.fugitive
              #      pkgs-i686.vimPlugins.rhubarb
              #      pkgs-i686.vimPlugins.vim-gitgutter
              #      pkgs-i686.vimPlugins.vim-bufkill
              #      pkgs-i686.vimPlugins.gruvbox
              #      pkgs-i686.vimPlugins.vim-airline
              #      pkgs-i686.vimPlugins.vim-airline-themes
              #    ];
              #  };
              #  vimrcConfig.customRC = ''
              #    set nocompatible
              #    inoremap jk <esc>
              #    nnoremap <space> :
              #    vnoremap <space> :
              #    nnoremap <C-c> :BD<cr>
              #    nnoremap <C-w>h :wincmd v<cr>
              #    nnoremap <C-w>j :wincmd s<cr>:wincmd k<cr>
              #    nnoremap <C-w>k :wincmd s<cr>
              #    nnoremap <C-w>l :wincmd v<cr>:wincmd l<cr>

              #    set nobackup
              #    set nowritebackup

              #    let g:gruvbox_italic = 1
              #    let g:gruvbox_bold = 1
              #    colorscheme gruvbox
              #    set background=dark
              #    set termguicolors
              #    set t_8f=[38;2;%lu;%lu;%lum " Needed in tmux and v86 xtermjs for setting foreground color (or else invisible cursor and buggy background)
              #    set t_8b=[48;2;%lu;%lu;%lum " Needed in tmux and v86 xtermjs for setting background color
              #    set t_ZH=[3m " Italics
              #    set t_ZR=[23m " End italics
              #    syntax on

              #    let g:airline_theme='gruvbox'
              #    let g:airline#extensions#tabline#enabled = 1
              #    let g:airline#extensions#tabline#left_sep = '''
              #    let g:airline#extensions#tabline#left_alt_sep = '│'

              #    set cursorline
              #    set number
              #    set numberwidth=4
              #    set signcolumn=number
              #    set laststatus=2
              #    set noshowmode

              #    set mouse=a
              #  '';
              #})
              #pkgs-i686.nano
              #((pkgs-i686.emacsPackagesFor pkgs-i686.emacs).emacsWithPackages (
              #  epkgs: [epkgs.magit]
              #))

              # msedit is new and didn't exist in the older nixpkgs version
              #nixpkgs.legacyPackages.i686-linux.msedit

              # In case the user gets curious
              #pkgs-i686.neofetch
              #nixpkgs.legacyPackages.i686-linux.fastfetch
              #pkgs-i686.hyfetch
              #pkgs-i686.sl
              #pkgs-i686.cowsay

              # Important for the git tutorial
              pkgs-i686.unixtools.xxd
              pkgs-i686.pigz # For compressing objects into zlib stream

            ] ++ (if method == "inotify" then [(pkgs-i686.stdenv.mkDerivation {
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
                      pkgs-i686.git
                      pkgs-i686.jq
                      pkgs-i686.coreutils-full
                    ]}
                  patchShebangs --host "$out/bin/dump-git.sh"
                  wrapProgram "$out/bin/dump-git.sh" \
                    --set PATH ${pkgs-i686.lib.makeBinPath [
                      pkgs-i686.git
                      pkgs-i686.jq
                      pkgs-i686.coreutils-full
                    ]}
                  patchShebangs --host "$out/bin/send-to-host.sh"
                  wrapProgram "$out/bin/send-to-host.sh" \
                    --set PATH ${pkgs-i686.lib.makeBinPath [
                      pkgs-i686.coreutils-full
                      pkgs-i686.util-linux
                    ]}
                '';
              })
            ] else []);
            programs = {
              git.enable = true;
            };
        })
      ];
      # Currently failing to generate a hard drive raw image:
      #format = "raw"; # can't open fsimg nixos.raw: Value too large for defined data type
      # Not quite applicable but similar: https://github.com/NixOS/nixpkgs/pull/82718
      # So instead we generate a live iso which seems to work.
      #format = "iso";
      format = "lxc";

    }