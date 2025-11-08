# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
    pkgs.util-linux
    pkgs.openjdk21
    # pkgs.go
  ];
  
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
      # "golang.go"
      "esbenp.prettier-vscode"
      "PKief.material-icon-theme"
      "yzhang.markdown-all-in-one"
    ];

    # Enable previews and customize configuration
    previews = {
      enable = true;
      previews = {
        # The following object sets web previews
        web = {
          command = [
            "npm"
            "run"
            "start"
            "--"
            "--port"
            "$PORT"
            "--host"
            "0.0.0.0"
            "--disable-host-check"
          ];
          manager = "web";
        };
      };
    };
  };
}
