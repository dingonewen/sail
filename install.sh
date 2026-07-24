#!/usr/bin/env bash
set -e

# Sail — Terminal coding agent powered by Mastra
# One-command installer: curl -fsSL https://.../install.sh | sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "${BOLD}Sail${NC} — AI coding assistant"
echo ""

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 22 ]; then
  echo -e "${RED}Error: Node.js 22 or later is required.${NC}"
  echo "Install it from https://nodejs.org or use nvm:"
  echo "  nvm install 22 && nvm use 22"
  exit 1
fi
echo -e "  Node.js $(node -v)  ${GREEN}✓${NC}"

# Check npm
if ! command -v npm &>/dev/null; then
  echo -e "${RED}Error: npm is required but not found.${NC}"
  exit 1
fi
echo -e "  npm $(npm -v)  ${GREEN}✓${NC}"

# Install globally
echo ""
echo -e "Installing Sail..."
npm install -g sail 2>/dev/null || {
  echo -e "${YELLOW}npm install -g failed. Trying from local build...${NC}"
  # Fallback: install from working directory if running from repo
  if [ -f "package.json" ] && grep -q '"sail"' package.json 2>/dev/null; then
    npm install -g .
  else
    echo -e "${RED}Error: Could not install Sail.${NC}"
    exit 1
  fi
}

echo ""
echo -e "${GREEN}${BOLD}✓ Sail installed successfully!${NC}"
echo ""

# Verify installation
if command -v sail &>/dev/null; then
  sail --version
else
  echo -e "${YELLOW}Warning: 'sail' not found in PATH. You may need to restart your terminal.${NC}"
fi

echo ""
echo -e "Get started:"
echo -e "  ${BOLD}sail${NC}              Start interactive session"
echo -e "  ${BOLD}sail -p 'prompt'${NC}   Run a single prompt"
echo -e "  ${BOLD}sail --help${NC}        Show all options"
echo ""
echo -e "Set your API key:"
echo -e "  export ANTHROPIC_API_KEY=your-key-here"
echo -e "  export OPENAI_API_KEY=your-key-here"
echo ""
