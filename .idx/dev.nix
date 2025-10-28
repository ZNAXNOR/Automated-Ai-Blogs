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

  # Sets environment variables in the workspace
  env = {
    # --- AI / Genkit keys ---
    GOOGLE_GENAI_API_KEY = " "; # Get from https://g.co/ai/idxGetGeminiKey
    
    # --- Data Collection ---
    SERPAPI_KEY = " "; # Optional if you’re using SERP-based r0 flow

    # --- Huggingface Api ---
    HF_TOKEN = " "; # Optional if you’re using HuggingFace models
    
    # --- Apyhub Api ---
    APYHUB_API_KEY = " ";

    # --- News API Keys ---
    NEWSDATA_API = " ";
    GNEWS_API = " ";

    # --- Google Custom Search Engine Api ---
    GOOGLE_CSE_API_KEY = " ";
    GOOGLE_CSE_CX = " ";

    # --- WordPress blog publishing (r5) ---
    WP_API_URL = " ";
    WP_USERNAME = " ";
    WP_PASSWORD = " ";
    
    # --- GCP metadata ---
    GCP_PROJECT_ID = " ";
    GCS_BUCKET_NAME = " ";

    # --- Firebase / Firestore setup ---
    GCP_SERVICE_ACCOUNT_JSON = " ";
  };
  
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
      # "golang.go"
      "esbenp.prettier-vscode"
      "PKief.material-icon-theme"
      "yzhang.markdown-all-in-one"
    ];

    # Workspace lifecycle hooks
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        npm-install = "npm ci --no-audit --prefer-offline --no-progress --timing";
        default.openFiles = [ "README.md" "index.ts" ];
      };
      # Runs when the workspace is (re)started
      onStart = {
        run-server = "if [ -z \"\${GOOGLE_GENAI_API_KEY}\" ]; then \
          echo 'No Gemini API key detected, enter a Gemini API key from https://aistudio.google.com/app/apikey:' && \
          read -s GOOGLE_GENAI_API_KEY && \
          echo 'You can also add to .idx/dev.nix to automatically add to your workspace'
          export GOOGLE_GENAI_API_KEY; \
          fi && \
          npm run genkit:dev";
      };
    };
  };
}
