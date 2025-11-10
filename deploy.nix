# This file has been blessed with the guidance from https://crystalwobsite.gay/posts/2025-01-26-nixos_vm_image
{ system, nixpkgs, nixos-generators, server }:
  nixos-generators.nixosGenerate {
    inherit system;
    format = "do"; # DigitalOcean
    modules = [
      ({ pkgs, modulePath, lib, ... } :{
        # Pin to flake input.
        nix.registry.nixpkgs.flake = nixpkgs;

        virtualisation.diskSize = 8 * 1024; # 8 GiB

        systemd.services.the-magic-git-bus = {
          enable = true;
          unitConfig.Type = "simple";
          serviceConfig.ExecStart = "${server}/bin/the-magic-git-bus";
          wantedBy = ["multi-user.target"];
        };

        # Hardening
        # This section is blessed with the wisdom from https://xeiaso.net/blog/paranoid-nixos-2021-07-18/
        networking.firewall.enable = true;
        nix.allowedUsers = []; # We'll redploy by manually submitting the image lol.
        security.auditd.enable = true;
        security.audit.enable = true;
        security.audit.rules = [
          "-a exit,always -F arch=b64 -S execve"
        ];
        security.sudo.enable = false;
        environment.defaultPackages = lib.mkForce [];
        services.openssh = {
          passwordAuthentication = false;
          allowSFTP = false; # Don't set this if you need sftp
          challengeResponseAuthentication = false;
          extraConfig = ''
            AllowTcpForwarding yes
            X11Forwarding no
            AllowAgentForwarding no
            AllowStreamLocalForwarding no
            AuthenticationMethods publickey
          '';
        };
        #fileSystems."/".options = [ "noexec" ];
        #fileSystems."/etc/nixos".options = [ "noexec" ];
        #fileSystems."/srv".options = [ "noexec" ];
        #fileSystems."/var/log".options = [ "noexec" ];
        # This section is blessed with the wisdom from https://dataswamp.org/~solene/2022-01-13-nixos-hardened.html
        #imports = [
        #  "${modulePath}/profiles/hardened.nix"
        #];
        systemd.coredump.enable = false;
      })
    ];
  }