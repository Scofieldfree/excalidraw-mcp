# Excalidraw MCP Component

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server that enables AI agents to programmatically generate, edit, and view Excalidraw diagrams.

## ✨ Features

- **Diagram Generation**: Create new diagrams from text descriptions
- **Real-time Preview**: View changes instantly in the browser
- **Tool Integration**: Explicit tools for adding shapes, text, arrows, and more
- **Bi-directional**: Changes in the browser sync back to the agent context

## 📦 Components

- **@excalidraw-mcp/server**: The core MCP server implementation with embedded HTTP/WebSocket server.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 9

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/excalidraw-mcp.git
cd excalidraw-mcp

# Install dependencies
pnpm install

# Build packages
pnpm build
```

### Running Locally

```bash
# Start the MCP server (includes web interface)
pnpm dev
```

Visit `http://localhost:3100` to see the Excalidraw interface.

## 🤖 Using with Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "npx",
      "args": ["@excalidraw-mcp/server@latest"]
    }
  }
}
```

## 🛠️ Development

This project involves a monorepo structure using pnpm workspace.

- `packages/mcp-server`: The MCP server and web interface

```bash
# Run tests (if applicable)
pnpm test

# Lint code
pnpm lint
```

## 📄 License

MIT
