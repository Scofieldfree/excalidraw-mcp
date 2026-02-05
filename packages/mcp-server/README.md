# Excalidraw MCP Server

An MCP server that enables AI agents (like Claude, Cursor) to creating and editing Excalidraw diagrams directly.

## Features

- **Protocol**: Fully compliant with Model Context Protocol (MCP).
- **Tools**: `add_elements`, `update_element`, `start_session`, `export_diagram`, etc.
- **Smart**: Auto-calculates text width, auto-binds text to containers.
- **Visual**: Real-time browser preview via WebSocket.

## Quick Start

You can run this server directly using `npx`:

```bash
npx @scofieldfree/excalidraw-mcp
```

## Configuration

### Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "npx",
      "args": ["-y", "@scofieldfree/excalidraw-mcp"]
    }
  }
}
```

### Cursor

1. Open **Cursor Settings** -> **Features** -> **MCP**.
2. Click **+ Add New MCP Server**.
3. Name: `excalidraw`
4. Type: `command`
5. Command: `npx -y @scofieldfree/excalidraw-mcp`

## How it Works

1. The server starts a local HTTP server (default port 3100) for the Excalidraw frontend.
2. It exposes MCP tools to the AI Agent.
3. When the Agent calls `add_elements`, the server updates its state and pushes changes to the browser via WebSocket.
4. You see the diagram update in real-time!

## License

MIT
