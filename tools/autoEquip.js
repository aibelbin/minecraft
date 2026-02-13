/**
 * Auto-Equip Tool
 * Automatically equips sword and shield when items are collected
 */
module.exports = function autoEquip(bot) {
    console.error('[AutoEquip] Tool loaded')

    // Equip sword when picked up
    bot.on('playerCollect', (collector, itemDrop) => {
        if (collector !== bot.entity) return

        setTimeout(() => {
            const sword = bot.inventory.items().find(item => item.name.includes('sword'))
            if (sword) bot.equip(sword, 'hand')
        }, 150)
    })

    // Equip shield when picked up
    bot.on('playerCollect', (collector, itemDrop) => {
        if (collector !== bot.entity) return

        setTimeout(() => {
            const shield = bot.inventory.items().find(item => item.name.includes('shield'))
            if (shield) bot.equip(shield, 'off-hand')
        }, 250)
    })
}
