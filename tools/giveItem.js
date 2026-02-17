/**
 * Give Item Tool
 * Tosses items from inventory to nearby players
 */

module.exports = function giveItem(bot) {
    console.error('[GiveItem] Tool loaded');

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
     * Find player by username
     */
    function findPlayer(username) {
        const player = bot.players[username];
        if (!player || !player.entity) {
            return null;
        }
        return player.entity;
    }

    /**
     * Give items to a nearby player
     * @param {string} playerName - Username of the player to give items to
     * @param {string} itemName - Name of the item to give
     * @param {number} amount - Number of items to give
     * @returns {Promise<Object>} Result object with success status
     */
    async function giveItem(playerName, itemName, amount) {
        try {
            // Validate inputs
            if (!playerName || typeof playerName !== 'string') {
                throw new Error('Invalid player name');
            }
            if (!itemName || typeof itemName !== 'string') {
                throw new Error('Invalid item name');
            }
            if (!amount || amount <= 0) {
                throw new Error('Amount must be greater than 0');
            }

            // Find the player
            const player = findPlayer(playerName);
            if (!player) {
                return {
                    success: false,
                    message: `Player "${playerName}" not found or not visible. Make sure they are online and nearby.`,
                    given: 0,
                    player: playerName,
                    item: itemName
                };
            }

            // Check distance to player
            const distance = player.position.distanceTo(bot.entity.position);
            if (distance > 32) {
                return {
                    success: false,
                    message: `Player "${playerName}" is too far away (${distance.toFixed(1)} blocks). Please move closer.`,
                    given: 0,
                    player: playerName,
                    item: itemName
                };
            }

            // Find items in inventory
            const items = bot.inventory.items().filter(item => item.name === itemName);
            const availableCount = items.reduce((sum, item) => sum + item.count, 0);

            if (availableCount === 0) {
                return {
                    success: false,
                    message: `No "${itemName}" found in inventory.`,
                    given: 0,
                    player: playerName,
                    item: itemName
                };
            }

            // Adjust amount if requesting more than available
            const amountToGive = Math.min(amount, availableCount);
            
            console.error(`[GiveItem] Giving ${amountToGive}x ${itemName} to ${playerName}`);

            // Look at the player
            await bot.lookAt(player.position.offset(0, player.height / 2, 0));
            await sleep(200);

            let totalGiven = 0;
            let remainingToGive = amountToGive;

            // Toss items in batches (max 64 per toss - stack size)
            while (remainingToGive > 0) {
                // Find an item stack to toss
                const item = bot.inventory.items().find(i => i.name === itemName);
                if (!item) {
                    break; // No more items
                }

                // Toss up to the remaining amount or the stack size
                const amountInStack = item.count;
                const amountToToss = Math.min(remainingToGive, amountInStack);

                try {
                    // Toss the items towards the player
                    await bot.toss(item.type, null, amountToToss);
                    console.error(`[GiveItem] Tossed ${amountToToss}x ${itemName}`);
                    
                    totalGiven += amountToToss;
                    remainingToGive -= amountToToss;

                    // Small delay between tosses
                    await sleep(300);
                } catch (tossError) {
                    console.error(`[GiveItem] Error tossing items: ${tossError.message}`);
                    break;
                }
            }

            if (totalGiven > 0) {
                return {
                    success: true,
                    message: `Successfully gave ${totalGiven}x ${itemName} to ${playerName}`,
                    given: totalGiven,
                    player: playerName,
                    item: itemName
                };
            } else {
                return {
                    success: false,
                    message: `Failed to give items to ${playerName}`,
                    given: 0,
                    player: playerName,
                    item: itemName
                };
            }

        } catch (error) {
            console.error(`[GiveItem] Error: ${error.message}`);
            return {
                success: false,
                message: error.message,
                given: 0,
                player: playerName,
                item: itemName
            };
        }
    }

    return {
        giveItem
    };
};
