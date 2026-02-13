#!/usr/bin/env node

/**
 * Minecraft Bot MCP Server
 * Exposes Minecraft bot capabilities as MCP tools for LLM interaction
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const bot = require('./bot');

// Import tool modules
const autoEquip = require('./tools/autoEquip');
const guard = require('./tools/guard');
const selfDefense = require('./tools/selfDefense');

// Initialize bot tools
console.error('Initializing Minecraft bot tools...');
autoEquip(bot);
const guardTool = guard(bot);
const selfDefenseTool = selfDefense(bot);

// Create MCP server
const server = new Server(
  {
    name: 'minecraft-bot-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define MCP tools
const tools = [
  {
    name: 'minecraft_guard_position',
    description: 'Command the bot to guard a specific position and attack nearby hostile mobs within 16 blocks. The bot will patrol the area and eliminate threats.',
    inputSchema: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate to guard',
        },
        y: {
          type: 'number',
          description: 'Y coordinate to guard',
        },
        z: {
          type: 'number',
          description: 'Z coordinate to guard',
        },
        player: {
          type: 'string',
          description: 'Player username whose position to guard (alternative to coordinates)',
        },
      },
    },
  },
  {
    name: 'minecraft_stop_guarding',
    description: 'Stop the bot from guarding its current position. The bot will cease patrolling and attacking.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'minecraft_get_status',
    description: 'Get the current status of the bot including health, hunger, position, and equipment.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'minecraft_chat',
    description: 'Send a chat message in the Minecraft server as the bot.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to send in chat',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'minecraft_move_to',
    description: 'Move the bot to a specific position using pathfinding.',
    inputSchema: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X coordinate to move to',
        },
        y: {
          type: 'number',
          description: 'Y coordinate to move to',
        },
        z: {
          type: 'number',
          description: 'Z coordinate to move to',
        },
      },
      required: ['x', 'y', 'z'],
    },
  },
  {
    name: 'minecraft_attack_entity',
    description: 'Attack a nearby entity by name or type. Use "player" or "nearest player" to attack the closest player, or specify a username/mob type.',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: {
          type: 'string',
          description: 'Name of the entity to attack (e.g., "zombie", "skeleton", "player", "nearest player", or a specific player username)',
        },
      },
      required: ['entityName'],
    },
  },
  {
    name: 'minecraft_get_nearby_entities',
    description: 'Get a list of all nearby entities (players, mobs, items) within a specified range.',
    inputSchema: {
      type: 'object',
      properties: {
        range: {
          type: 'number',
          description: 'Range in blocks to search for entities (default: 16)',
          default: 16,
        },
        type: {
          type: 'string',
          description: 'Filter by entity type: "player", "mob", or "item" (optional)',
        },
      },
    },
  },
  {
    name: 'minecraft_get_inventory',
    description: 'Get the current inventory contents of the bot.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'minecraft_equip_item',
    description: 'Equip a specific item from inventory to hand or off-hand.',
    inputSchema: {
      type: 'object',
      properties: {
        itemName: {
          type: 'string',
          description: 'Name of the item to equip (e.g., "diamond_sword", "shield")',
        },
        slot: {
          type: 'string',
          description: 'Where to equip: "hand" or "off-hand"',
          enum: ['hand', 'off-hand'],
        },
      },
      required: ['itemName', 'slot'],
    },
  },
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'minecraft_guard_position': {
        if (args.player) {
          const player = bot.players[args.player];
          if (!player || !player.entity) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Player "${args.player}" not found or not visible.`,
                },
              ],
            };
          }
          guardTool.guardArea(player.entity.position);
          return {
            content: [
              {
                type: 'text',
                text: `Now guarding ${args.player}'s position at ${player.entity.position.toString()}`,
              },
            ],
          };
        } else if (args.x !== undefined && args.y !== undefined && args.z !== undefined) {
          const pos = { x: args.x, y: args.y, z: args.z, clone: () => ({ x: args.x, y: args.y, z: args.z }) };
          guardTool.guardArea(pos);
          return {
            content: [
              {
                type: 'text',
                text: `Now guarding position (${args.x}, ${args.y}, ${args.z})`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: 'Please provide either coordinates (x, y, z) or a player name.',
              },
            ],
          };
        }
      }

      case 'minecraft_stop_guarding': {
        guardTool.stopGuarding();
        return {
          content: [
            {
              type: 'text',
              text: 'Stopped guarding.',
            },
          ],
        };
      }

      case 'minecraft_get_status': {
        const pos = bot.entity.position;
        const inventory = bot.inventory.items().map(item => `${item.name} x${item.count}`);
        const equipped = {
          hand: bot.heldItem ? bot.heldItem.name : 'empty',
          offHand: bot.inventory.slots[45] ? bot.inventory.slots[45].name : 'empty',
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                health: bot.health,
                food: bot.food,
                position: { x: pos.x, y: pos.y, z: pos.z },
                equipped,
                inventory: inventory.slice(0, 10), // Limit to first 10 items
                totalItems: inventory.length,
              }, null, 2),
            },
          ],
        };
      }

      case 'minecraft_chat': {
        bot.chat(args.message);
        return {
          content: [
            {
              type: 'text',
              text: `Sent message: "${args.message}"`,
            },
          ],
        };
      }

      case 'minecraft_move_to': {
        const { Movements, goals } = require('mineflayer-pathfinder');
        const mcData = require('minecraft-data')(bot.version);
        bot.pathfinder.setMovements(new Movements(bot, mcData));
        bot.pathfinder.setGoal(new goals.GoalBlock(args.x, args.y, args.z));
        
        return {
          content: [
            {
              type: 'text',
              text: `Moving to position (${args.x}, ${args.y}, ${args.z})`,
            },
          ],
        };
      }

      case 'minecraft_attack_entity': {
        let entity;
        
        // Special handling for "nearest/closest player/mob" commands
        const searchTerm = args.entityName.toLowerCase();
        if (searchTerm.includes('nearest') || searchTerm.includes('closest') || 
            searchTerm === 'player' || searchTerm === 'any player') {
          // Find nearest player
          entity = bot.nearestEntity(e => e.type === 'player');
        } else if (searchTerm === 'mob' || searchTerm === 'any mob' || 
                   searchTerm.includes('nearest mob') || searchTerm.includes('closest mob')) {
          // Find nearest mob
          entity = bot.nearestEntity(e => e.type === 'mob');
        } else {
          // Normal name search
          entity = bot.nearestEntity(e => {
            if (e.type === 'player') {
              return e.username && e.username.toLowerCase().includes(searchTerm);
            } else if (e.type === 'mob') {
              return e.name && e.name.toLowerCase().includes(searchTerm);
            }
            return false;
          });
        }

        if (!entity) {
          return {
            content: [
              {
                type: 'text',
                text: `No entity found matching "${args.entityName}"`,
              },
            ],
          };
        }

        bot.pvp.attack(entity);
        return {
          content: [
            {
              type: 'text',
              text: `Attacking ${entity.name || entity.username}`,
            },
          ],
        };
      }

      case 'minecraft_get_nearby_entities': {
        const range = args.range || 16;
        const entities = Object.values(bot.entities).filter(e => {
          if (e === bot.entity) return false;
          const distance = e.position.distanceTo(bot.entity.position);
          if (distance > range) return false;
          
          if (args.type) {
            return e.type === args.type;
          }
          return true;
        }).map(e => ({
          type: e.type,
          name: e.name || e.username || 'unknown',
          position: { x: Math.floor(e.position.x), y: Math.floor(e.position.y), z: Math.floor(e.position.z) },
          distance: e.position.distanceTo(bot.entity.position).toFixed(1),
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(entities, null, 2),
            },
          ],
        };
      }

      case 'minecraft_get_inventory': {
        const items = bot.inventory.items().map(item => ({
          name: item.name,
          count: item.count,
          slot: item.slot,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(items, null, 2),
            },
          ],
        };
      }

      case 'minecraft_equip_item': {
        const item = bot.inventory.items().find(i => i.name.includes(args.itemName));
        
        if (!item) {
          return {
            content: [
              {
                type: 'text',
                text: `Item "${args.itemName}" not found in inventory.`,
              },
            ],
          };
        }

        await bot.equip(item, args.slot);
        return {
          content: [
            {
              type: 'text',
              text: `Equipped ${item.name} to ${args.slot}`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Minecraft Bot MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
