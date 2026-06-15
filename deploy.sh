#!/bin/bash
set -euo pipefail

# Robust deploy script that runs inside the release directory on the server.
# This script prints diagnostics and ensures npm/node are available in
# non-interactive SSH sessions (GitHub Actions ssh), then installs deps and builds.

echo ">>> Deploy script starting: $(date)"

echo ">>> Current user: $(whoami)"
echo ">>> Current dir: $(pwd)"
echo ">>> PATH: $PATH"

# If nvm is present, source it explicitly
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
export PATH="$PATH:$(npm bin -g)"

echo ">>> use node 24"
nvm use 24

node -v

echo ">>> Installing dependencies..."
npm install

echo ">>> Building application..."
npm run build

echo ">>> Deployment successful!"