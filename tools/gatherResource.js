/**
 * Gather Resource Tool
 * Autonomously mines blocks and collects drops until target amount is reached
 */
const { Movements, goals } = require('mineflayer-pathfinder');

module.exports = function gatherResource(bot) {
    console.error('[GatherResource] Tool loaded');

    /**
     * Sleep utility for adding delays
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get count of specific item in inventory
     */
    function getItemCount(itemName) {
        const items = bot.inventory.items().filter(item => item.name === itemName);
        return items.reduce((sum, item) => sum + item.count, 0);
    }

    /**
     * Check if inventory has space
     */
    function hasInventorySpace() {
        const emptySlots = bot.inventory.emptySlotCount();
        return emptySlots > 0;
    }

    /**
     * Equip best tool for mining the block
     */
    async function equipBestTool(block) {
        try {
            const mcData = require('minecraft-data')(bot.version);
            const toolsForBlock = mcData.blocksByName[block.name]?.harvestTools || {};
            
            // Get all tools in inventory that can harvest this block
            const availableTools = bot.inventory.items().filter(item => {
                return item.name.includes('pickaxe') || 
                       item.name.includes('axe') || 
                       item.name.includes('shovel') ||
                       item.name.includes('hoe');
            });

            if (availableTools.length === 0) {
                // No tools available, use hand
                return;
            }

            // Sort by material quality (diamond > iron > stone > wood)
            const toolPriority = ['diamond', 'iron', 'stone', 'wooden', 'golden'];
            availableTools.sort((a, b) => {
                const aPriority = toolPriority.findIndex(mat => a.name.includes(mat));
                const bPriority = toolPriority.findIndex(mat => b.name.includes(mat));
                return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
            });

            // Equip best tool
            const bestTool = availableTools[0];
            if (bot.heldItem?.name !== bestTool.name) {
                await bot.equip(bestTool, 'hand');
                console.error(`[GatherResource] Equipped ${bestTool.name}`);
            }
        } catch (error) {
            console.error(`[GatherResource] Error equipping tool: ${error.message}`);
            // Continue with current item
        }
    }

    /**
     * Collect nearby dropped items matching the resource
     */
    async function collectNearbyDrops(resourceName, maxDistance = 12) {
        try {
            const mcData = require('minecraft-data')(bot.version);
            
            // Find dropped items nearby
            const droppedItems = Object.values(bot.entities)
                .filter(entity => {
                    if (entity.name !== 'item') return false;
                    const distance = entity.position.distanceTo(bot.entity.position);
                    return distance <= maxDistance;
                })
                .sort((a, b) => {
                    return a.position.distanceTo(bot.entity.position) - 
                           b.position.distanceTo(bot.entity.position);
                });

            // Move towards dropped items to collect them
            for (const item of droppedItems) {
                try {
                    const distance = item.position.distanceTo(bot.entity.position);
                    if (distance > 2) {
                        bot.pathfinder.setMovements(new Movements(bot, mcData));
                        bot.pathfinder.setGoal(
                            new goals.GoalNear(item.position.x, item.position.y, item.position.z, 1)
                        );
                        
                        // Wait briefly for pathfinding
                        await sleep(500);
                    }
                } catch (error) {
                    // Item might have been collected or despawned
                    continue;
                }
            }

            // Wait for items to be collected
            await sleep(300);
        } catch (error) {
            console.error(`[GatherResource] Error collecting drops: ${error.message}`);
        }
    }

    /**
     * Main gathering function - continuously mines blocks until target reached
     */
    async function gatherResource(resource, amount, range = 64) {
        try {
            // Validate inputs
            if (!resource || typeof resource !== 'string') {
                throw new Error('Invalid resource name');
            }
            if (!amount || amount <= 0) {
                throw new Error('Amount must be greater than 0');
            }
            if (range <= 0 || range > 128) {
                throw new Error('Range must be between 1 and 128');
            }

            const mcData = require('minecraft-data')(bot.version);
            const blockType = mcData.blocksByName[resource];
            
            if (!blockType) {
                throw new Error(`Unknown block type: ${resource}`);
            }

            console.error(`[GatherResource] Starting to gather ${amount}x ${resource} within ${range} blocks`);

            const startingCount = getItemCount(resource);
            let iterationCount = 0;
            const maxIterations = 100; // Safety limit

            // Main gathering loop
            while (getItemCount(resource) - startingCount < amount) {
                iterationCount++;
                
                // Safety check to prevent infinite loops
                if (iterationCount > maxIterations) {
                    const collected = getItemCount(resource) - startingCount;
                    return {
                        success: false,
                        message: `Reached maximum iteration limit. Collected ${collected}/${amount} ${resource}.`,
                        collected,
                        resource
                    };
                }

                // Check if inventory is full
                if (!hasInventorySpace()) {
                    const collected = getItemCount(resource) - startingCount;
                    return {
                        success: false,
                        message: 'Inventory is full. Cannot gather more resources.',
                        collected,
                        resource
                    };
                }

                // Find nearest matching block
                const block = bot.findBlock({
                    matching: blockType.id,
                    maxDistance: range,
                    useExtraInfo: (block) => {
                        // Prioritize blocks that are easy to reach
                        return true;
                    }
                });

                if (!block) {
                    const collected = getItemCount(resource) - startingCount;
                    return {
                        success: false,
                        message: `No more ${resource} blocks found within ${range} blocks.`,
                        collected,
                        resource
                    };
                }

                console.error(`[GatherResource] Found ${resource} at (${block.position.x}, ${block.position.y}, ${block.position.z})`);

                // Equip best tool for this block
                await equipBestTool(block);

                // Move to the block
                try {
                    bot.pathfinder.setMovements(new Movements(bot, mcData));
                    const goal = new goals.GoalGetToBlock(block.position.x, block.position.y, block.position.z);
                    
                    await bot.pathfinder.goto(goal);
                    console.error(`[GatherResource] Reached block position`);
                } catch (pathError) {
                    console.error(`[GatherResource] Pathfinding failed: ${pathError.message}`);
                    // Try to find another block in next iteration
                    await sleep(500);
                    continue;
                }

                // Small delay before digging
                await sleep(100);

                // Verify block still exists
                const targetBlock = bot.blockAt(block.position);
                if (!targetBlock || targetBlock.type !== blockType.id) {
                    console.error(`[GatherResource] Block disappeared or changed`);
                    continue;
                }

                // Dig the block
                try {
                    console.error(`[GatherResource] Mining ${resource}...`);
                    await bot.dig(targetBlock);
                    console.error(`[GatherResource] Successfully mined ${resource}`);
                    
                    // Small delay after digging for drops to spawn
                    await sleep(200);
                    
                    // Collect nearby drops
                    await collectNearbyDrops(resource);
                    
                    // Small cooldown between mining attempts
                    await sleep(300);
                    
                } catch (digError) {
                    console.error(`[GatherResource] Failed to dig block: ${digError.message}`);
                    // Continue to next block
                    await sleep(500);
                    continue;
                }

                // Check progress
                const currentCount = getItemCount(resource) - startingCount;
                console.error(`[GatherResource] Progress: ${currentCount}/${amount}`);
            }

            // Success - target amount reached
            const finalCollected = getItemCount(resource) - startingCount;
            console.error(`[GatherResource] Successfully gathered ${finalCollected}x ${resource}`);
            
            return {
                success: true,
                collected: finalCollected,
                resource
            };

        } catch (error) {
            console.error(`[GatherResource] Error: ${error.message}`);
            return {
                success: false,
                message: error.message,
                collected: 0,
                resource
            };
        }
    }

    return {
        gatherResource
    };
};
