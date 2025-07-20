#!/usr/bin/env bash
# setup_node.sh – Quick wrapper to install nvm & Node.js v22 with verbose output
# Usage: bash setup_node.sh
# The script defaults to proceeding automatically, but pauses between major steps
# so you can observe what is happening. Press Enter to continue or Ctrl+C to abort.

set -euo pipefail
NVM_VERSION="v0.40.3"
NODE_VERSION="22"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pause() {
  printf "${YELLOW}Press Enter to continue...${NC}"
  # shellcheck disable=SC2034
  read -r _
}

info() {
  printf "${GREEN}==> %s${NC}\n" "$1"
}

echo "This script will install nvm ${NVM_VERSION} and Node.js ${NODE_VERSION}."
info "Starting installation process"
pause

# 1. Install nvm
info "Downloading and installing nvm ${NVM_VERSION}"
curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
pause

# 2. Load nvm without restarting shell
info "Loading nvm into current shell session"
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1090
. "$NVM_DIR/nvm.sh"
pause

# 3. Install Node.js
info "Installing Node.js ${NODE_VERSION} (may take a moment)"
nvm install "${NODE_VERSION}"
pause

# 4. Verification
info "Verifying Node.js & npm versions"
node -v   # Expect v22.x.x
nvm current
npm -v

info "Installation completed successfully!"

info "Smart reminder to source the correct shell profile for NVM/Node"
if [ -f "$HOME/.bashrc" ]; then
  PROFILE_FILE="$HOME/.bashrc"
elif [ -f "$HOME/.profile" ]; then
  PROFILE_FILE="$HOME/.profile"
else
  PROFILE_FILE="your shell profile"
fi

echo "==> Please run 'source $PROFILE_FILE' or open a new terminal to use Node.js and npm."
