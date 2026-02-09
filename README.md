# Minecraft Bot MCP Server

A Model Context Protocol (MCP) server that exposes Minecraft bot capabilities for LLM interaction.

## Features

The bot provides the following MCP tools for intelligent LLM control:

### Core Tools

- **minecraft_guard_position** - Guard a specific position and attack hostile mobs
- **minecraft_stop_guarding** - Stop guarding
- **minecraft_get_status** - Get bot's health, hunger, position, and equipment
- **minecraft_chat** - Send messages in Minecraft chat

### Movement & Combat

- **minecraft_move_to** - Move to specific coordinates using pathfinding
- **minecraft_attack_entity** - Attack nearby entities by name
- **minecraft_get_nearby_entities** - List nearby players, mobs, and items

### Inventory Management

- **minecraft_get_inventory** - View inventory contents
- **minecraft_equip_item** - Equip items to hand or off-hand

### Automatic Features

- **Auto-Equip** - Automatically equips swords and shields when collected
- **Self-Defense** - Fights back when attacked, or runs away if low health/hunger

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file or set environment variables:

```env
MC_HOST=localhost
MC_PORT=22122
MC_USERNAME=MiniProj_BOT
VIEWER_PORT=3000
```

### 3. Run the Bot (Standalone Mode)

```bash
node main.js
```

### 4. Run as MCP Server

```bash
node mcp-server.js
```

## MCP Configuration

Add this to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "minecraft-bot": {
      "command": "node",
      "args": ["/home/aibel/Documents/Code/Minecraft/mcp-server.js"],
      "env": {
        "MC_HOST": "localhost",
        "MC_PORT": "22122",
        "MC_USERNAME": "MiniProj_BOT"
      }
    }
  }
}
```

## Usage Examples

When connected to an LLM via MCP:

- "Guard my current position and protect it from mobs"
- "What's your current status?"
- "Move to coordinates 100, 64, 200"
- "Show me what's in your inventory"
- "Attack the nearest zombie"
- "Equip a diamond sword"

## Architecture

```
minecraft-bot-mcp-server/
├── mcp-server.js          # MCP server entry point
├── main.js                # Standalone bot entry point
├── bot.js                 # Bot initialization
├── tools/
│   ├── autoEquip.js       # Auto-equip tool
│   ├── guard.js           # Guard position tool
│   └── selfDefense.js     # Self-defense tool
└── package.json
```

## Adding New Tools

To add a new tool:

1. Create a new file in `tools/` directory
2. Export a function that takes the bot instance
3. Import and initialize it in `mcp-server.js`
4. Add the tool definition to the `tools` array
5. Add a case handler in the `CallToolRequestSchema` handler

Example:

```javascript
// tools/mine.js
module.exports = function mine(bot) {
    function mineBlock(x, y, z) {
        // Mining logic
    }
    
    return { mineBlock };
}

// In mcp-server.js
const mineTool = require('./tools/mine');
const mineAPI = mineTool(bot);

// Add tool definition and handler
```

## License

MIT
