#!/bin/bash

# Agent Visualizer Development Setup Script
# This script initializes the project for development

set -e

echo "🚀 Agent Visualizer - Development Setup"
echo ""

# Check if Node.js and npm are installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo "✅ npm $(npm -v) detected"
echo ""

# Install root dependencies
echo "📦 Installing extension dependencies..."
npm install

# Install webview dependencies
echo "📦 Installing webview dependencies..."
cd webview-ui
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📖 Next steps:"
echo "   1. Open the project in VS Code: code ."
echo "   2. Press F5 to start debugging (or Run > Start Debugging)"
echo "   3. A new VS Code window will open with the extension"
echo "   4. Navigate to a folder with Cursor agent transcripts"
echo "   5. Look for 'Agent Visualizer' in the activity bar"
echo ""
echo "🔧 Development commands:"
echo "   npm run build      - Build extension and webview"
echo "   npm run watch      - Watch for changes (auto-rebuild)"
echo "   npm run build:ext  - Build only extension"
echo "   npm run build:webview - Build only webview"
echo ""
