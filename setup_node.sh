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
BLUE='\033[0;34m'
NC='\033[0m'

pause() {
  printf "${YELLOW}Press Enter to continue...${NC}"
  # shellcheck disable=SC2034
  read -r _
}

info() {
  printf "${GREEN}==> %s${NC}\n" "$1"
}

warn() {
  printf "${YELLOW}==> %s${NC}\n" "$1"
}

note() {
  printf "${BLUE}==> %s${NC}\n" "$1"
}

# Detect current shell
CURRENT_SHELL=$(basename "$SHELL")
if [ "$CURRENT_SHELL" = "zsh" ]; then
  SHELL_TYPE="zsh"
  PROFILE_FILE="$HOME/.zshrc"
elif [ "$CURRENT_SHELL" = "bash" ]; then
  SHELL_TYPE="bash"
  PROFILE_FILE="$HOME/.bashrc"
else
  SHELL_TYPE="unknown"
  PROFILE_FILE="your shell profile"
fi

echo "This script will install nvm ${NVM_VERSION} and Node.js ${NODE_VERSION}."
note "Detected shell: ${SHELL_TYPE} (${SHELL})"
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

# Add shell-specific completion
if [ "$SHELL_TYPE" = "zsh" ]; then
  info "Setting up zsh completion for nvm"
  # shellcheck disable=SC1090
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
  note "Note: nvm uses bash completion even in zsh, which is normal"
elif [ "$SHELL_TYPE" = "bash" ]; then
  info "Setting up bash completion for nvm"
  # shellcheck disable=SC1090
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
fi
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

# 5. Shell-specific setup guidance
info "Setting up shell profile for persistent nvm access"
if [ "$SHELL_TYPE" = "zsh" ]; then
  if [ -f "$HOME/.zshrc" ]; then
    note "Detected .zshrc file"
    if ! grep -q "nvm" "$HOME/.zshrc"; then
      warn "Adding nvm configuration to .zshrc"
      cat >> "$HOME/.zshrc" << 'EOF'

# NVM Configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
EOF
      info "Added nvm configuration to .zshrc"
    else
      note "nvm configuration already found in .zshrc"
    fi
  else
    warn "No .zshrc file found. Creating one with nvm configuration"
    cat > "$HOME/.zshrc" << 'EOF'
# NVM Configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
EOF
    info "Created .zshrc with nvm configuration"
  fi
  echo "==> Please run 'source ~/.zshrc' or open a new terminal to use Node.js and npm."
  
elif [ "$SHELL_TYPE" = "bash" ]; then
  if [ -f "$HOME/.bashrc" ]; then
    note "Detected .bashrc file"
    if ! grep -q "nvm" "$HOME/.bashrc"; then
      warn "Adding nvm configuration to .bashrc"
      cat >> "$HOME/.bashrc" << 'EOF'

# NVM Configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
EOF
      info "Added nvm configuration to .bashrc"
    else
      note "nvm configuration already found in .bashrc"
    fi
  else
    warn "No .bashrc file found. Creating one with nvm configuration"
    cat > "$HOME/.bashrc" << 'EOF'
# NVM Configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
EOF
    info "Created .bashrc with nvm configuration"
  fi
  echo "==> Please run 'source ~/.bashrc' or open a new terminal to use Node.js and npm."
  
else
  warn "Unknown shell type. Please manually add nvm configuration to your shell profile:"
  echo "export NVM_DIR=\"\$HOME/.nvm\""
  echo "[ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"  # This loads nvm"
  echo "[ -s \"\$NVM_DIR/bash_completion\" ] && \. \"\$NVM_DIR/bash_completion\"  # This loads nvm bash_completion"
fi

note "For immediate use in this session, run: source ~/.${SHELL_TYPE}rc"
