# Minecraft Bot MCP Tools

Complete list of available tools for the Minecraft bot MCP server.

---

## 🛡️ Guard & Defense

### 1. minecraft_guard_position
**🔄 CONTINUOUS ACTION** - Starts persistent guarding mode that runs until stopped.

**Two Modes:**

**📍 Position Mode** - Guards static coordinates and attacks nearby hostile mobs (within 16 blocks)
- Bot patrols the area
- Only attacks hostile mobs
- Returns to position after combat

**👤 Player Protection Mode** - Actively follows and protects a specific player
- Bot follows the player continuously (stays within 3 blocks)
- Attacks ANY entity (players OR mobs) that gets within 8 blocks of the protected player
- Aggressive bodyguard mode - defends against all threats
- Updates position as player moves

**⚠️ Important:** This is a **persistent action** - once started, it continues running in the background until you call `stop_guarding`.

**Parameters:**
- `x` (number, optional): X coordinate to guard (for position mode ONLY)
- `y` (number, optional): Y coordinate to guard (for position mode ONLY)
- `z` (number, optional): Z coordinate to guard (for position mode ONLY)
- `player` (string, optional): Player username to follow and protect (for player mode ONLY)

**⚠️ Use EITHER coordinates OR player, never both!**

**Usage:**
- Guard coordinates: `{"x": 100, "y": 64, "z": 200}`
- Protect player: `{"player": "Steve"}` ← **Bot will follow Steve continuously**

**Keywords:** guard, protect, defend, bodyguard, follow, patrol, watch, watch over

---

### 2. minecraft_stop_guarding
**🛑 STOP CONTINUOUS ACTION** - Immediately cancels any active guarding mode (position or player protection). The bot will cease all guarding activities and return to idle state.

**Parameters:**
- None

**Usage:**
- `{}`

**Keywords:** stop, halt, cease, stand down, cancel guard, stop protecting

---

## ⚔️ Combat

### 3. minecraft_attack_entity
Attack a nearby entity by name or type. Use "player" or "nearest player" to attack the closest player, or specify a username/mob type.

**Parameters:**
- `entityName` (string, required): Name of the entity to attack
  - Examples: "zombie", "skeleton", "player", "nearest player", or a specific username like "Steve"

**Usage:**
- Attack nearest player: `{"entityName": "player"}`
- Attack specific mob: `{"entityName": "zombie"}`
- Attack by username: `{"entityName": "Steve"}`

---

## 🚶 Movement

### 4. minecraft_move_to
Move the bot to a specific position using pathfinding.

**Parameters:**
- `x` (number, required): X coordinate to move to
- `y` (number, required): Y coordinate to move to
- `z` (number, required): Z coordinate to move to

**Usage:**
- `{"x": 100, "y": 64, "z": 200}`

---

## 📊 Information & Status

### 5. minecraft_get_status
Get the current status of the bot including health, hunger, position, and equipment.

**Parameters:**
- None

**Returns:**
- Health and food levels
- Current position coordinates
- Equipped items (hand and off-hand)
- Inventory summary (first 10 items)

**Usage:**
- `{}`

---

### 6. minecraft_get_nearby_entities
Get a list of all nearby entities (players, mobs, items) within a specified range.

**Parameters:**
- `range` (number, optional): Range in blocks to search for entities (default: 16)
- `type` (string, optional): Filter by entity type - "player", "mob", or "item"

**Usage:**
- All entities in 16 blocks: `{}`
- Only players in 32 blocks: `{"range": 32, "type": "player"}`
- Only mobs: `{"type": "mob"}`

---

### 7. minecraft_get_inventory
Get the current inventory contents of the bot.

**Parameters:**
- None

**Returns:**
- List of all items with name, count, and slot number

**Usage:**
- `{}`

---

## 🎒 Inventory Management

### 8. minecraft_equip_item
Equip a specific item from inventory to hand or off-hand.

**Parameters:**
- `itemName` (string, required): Name of the item to equip (e.g., "diamond_sword", "shield")
- `slot` (string, required): Where to equip - "hand" or "off-hand"

**Usage:**
- Equip sword: `{"itemName": "diamond_sword", "slot": "hand"}`
- Equip shield: `{"itemName": "shield", "slot": "off-hand"}`

---

## 💬 Communication

### 9. minecraft_chat
Send a chat message in the Minecraft server as the bot.

**Parameters:**
- `message` (string, required): The message to send in chat

**Usage:**
- `{"message": "Hello everyone!"}`

---

## Summary

**Total Tools: 9**

**Categories:**
- Guard & Defense: 2 tools
- Combat: 1 tool  
- Movement: 1 tool
- Information & Status: 3 tools
- Inventory Management: 1 tool
- Communication: 1 tool

**Common Use Cases:**
- **Protect an area**: Use `minecraft_guard_position` with coordinates or player
- **Get bot info**: Use `minecraft_get_status` for health/position/inventory
- **Find entities**: Use `minecraft_get_nearby_entities` with filters
- **Attack threats**: Use `minecraft_attack_entity` with entity name
- **Navigation**: Use `minecraft_move_to` for pathfinding
- **Gear up**: Use `minecraft_equip_item` to change weapons/tools
