#!/bin/bash

# Quick start script for Minecraft Bot MCP Server

echo "Minecraft Bot MCP Server Setup"
echo "================================"
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "Available modes:"
echo "1. Standalone Bot (node main.js)"
echo "2. MCP Server (node mcp-server.js)"
echo ""
echo "For MCP integration with Claude Desktop, add this to your config:"
echo "~/.config/Claude/claude_desktop_config.json"
echo ""
echo "See README.md for detailed setup instructions"
