require('dotenv').config();
const { Client, GatewayIntentBits, PartialType, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');

// Import custom modules
const Database = require('./database');
const LinkChecker = require('./utils/linkChecker');
const ProfanityFilter = require('./utils/profanityFilter');
const GlobalChat = require('./utils/globalChat');
const GlobalChatCommands = require('./commands/globalchat');
const UserPhoneCommands = require('./commands/userphone');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildWebhooks
    ],
    partials: [PartialType.Message, PartialType.Channel, PartialType.Reaction]
});

// Initialize modules
const database = new Database(process.env.DB_PATH || './database.sqlite');
const linkChecker = new LinkChecker(database);
const profanityFilter = new ProfanityFilter();
const globalChat = new GlobalChat(database, profanityFilter);
const globalChatCommands = new GlobalChatCommands(globalChat, database);
const userPhoneCommands = new UserPhoneCommands(database);

// Bot configuration
const PREFIX = process.env.PREFIX || '!';
const BOT_OWNER_ID = process.env.BOT_OWNER_ID;

// Bot ready event
client.once('ready', async () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    
    // Set bot activity
    client.user.setActivity('!help for commands', { type: 'WATCHING' });
    
    // Initialize global chat webhooks
    await globalChat.initializeWebhooks();
    
    console.log('🚀 All systems operational!');
});

// Message event handler
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Ignore DMs
    if (!message.guild) return;

    try {
        // Handle commands
        if (message.content.startsWith(PREFIX)) {
            await handleCommand(message);
            return;
        }

        // Check if this is a global chat channel
        const isGlobalChatChannel = await globalChat.getGlobalChatChannel(message.guild.id) === message.channel.id;
        const isGlobalChatEnabled = await globalChat.isGlobalChatEnabled(message.guild.id);

        if (isGlobalChatChannel && isGlobalChatEnabled) {
            // Handle global chat message
            await handleGlobalChatMessage(message);
        } else {
            // Handle regular message (link checking)
            await handleRegularMessage(message);
        }

    } catch (error) {
        console.error('Error handling message:', error);
    }
});

// Command handler
async function handleCommand(message) {
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch (command) {
        case 'globalchat':
        case 'gc':
            await globalChatCommands.handleGlobalChatCommand(message, args);
            break;

        case 'userphone':
        case 'phone':
            await userPhoneCommands.handleUserPhoneCommand(message, args);
            break;

        case 'help':
            await handleHelpCommand(message, args);
            break;

        case 'ping':
            await handlePingCommand(message);
            break;

        case 'linkcheck':
            await handleLinkCheckCommand(message, args);
            break;

        case 'stats':
            await handleStatsCommand(message);
            break;

        default:
            // Unknown command - ignore silently
            break;
    }
}

// Global chat message handler
async function handleGlobalChatMessage(message) {
    try {
        // Check if user is banned from global chat
        const isBanned = await database.isUserBannedFromGlobalChat(message.author.id);
        if (isBanned) {
            await message.react('❌');
            const reply = await message.reply('❌ You are banned from global chat.');
            setTimeout(() => reply.delete().catch(() => {}), 5000);
            return;
        }

        // Check if user is verified (optional requirement)
        const isVerified = await userPhoneCommands.isUserVerified(message.author.id);
        if (!isVerified) {
            await message.react('📱');
            const reply = await message.reply('📱 Phone verification recommended for global chat. Use `!userphone register` to get started.');
            setTimeout(() => reply.delete().catch(() => {}), 10000);
        }

        // Send message to global chat network
        const result = await globalChat.sendGlobalMessage(message, message.guild.id);
        
        if (!result.success) {
            await message.react('❌');
            const reply = await message.reply(`❌ Failed to send to global chat: ${result.reason}`);
            setTimeout(() => reply.delete().catch(() => {}), 5000);
        } else {
            await message.react('🌐');
        }

    } catch (error) {
        console.error('Error handling global chat message:', error);
        await message.react('⚠️');
    }
}

// Regular message handler (link checking)
async function handleRegularMessage(message) {
    try {
        // Skip if link checking is disabled
        if (process.env.LINK_CHECK_ENABLED === 'false') return;

        // Analyze message for suspicious links
        const analysis = await linkChecker.analyzeMessage(
            message.content,
            message.id,
            message.channel.id,
            message.guild.id,
            message.author.id
        );

        if (analysis.isSuspicious) {
            // Log the suspicious link
            console.log(`🚨 Suspicious link detected in ${message.guild.name} by ${message.author.tag}`);

            // React to the message
            await message.react('⚠️');

            // Take action based on analysis
            if (analysis.action === 'delete') {
                try {
                    await message.delete();
                    
                    const warningEmbed = new EmbedBuilder()
                        .setColor(0xFF6B6B)
                        .setTitle('🚨 Suspicious Link Deleted')
                        .setDescription(`${message.author}, your message was deleted because it contained potentially dangerous links.`)
                        .addFields(
                            { name: 'Reason', value: analysis.reasons.join(', '), inline: false },
                            { name: 'Channel', value: message.channel.toString(), inline: true }
                        )
                        .setTimestamp();

                    const reply = await message.channel.send({ embeds: [warningEmbed] });
                    setTimeout(() => reply.delete().catch(() => {}), 10000);

                } catch (error) {
                    console.error('Error deleting suspicious message:', error);
                }
            } else if (analysis.action === 'warn') {
                const warningEmbed = new EmbedBuilder()
                    .setColor(0xFFD93D)
                    .setTitle('⚠️ Potentially Suspicious Link')
                    .setDescription(`${message.author}, please be careful with the links you share.`)
                    .addFields(
                        { name: 'Reason', value: analysis.reasons.join(', '), inline: false }
                    )
                    .setTimestamp();

                const reply = await message.channel.send({ embeds: [warningEmbed] });
                setTimeout(() => reply.delete().catch(() => {}), 10000);
            }

            // Send detailed report to moderation log (if set up)
            const report = linkChecker.generateSuspiciousLinkReport(analysis);
            if (report && process.env.MODERATION_LOG_CHANNEL) {
                const logChannel = client.channels.cache.get(process.env.MODERATION_LOG_CHANNEL);
                if (logChannel) {
                    report.fields.push(
                        { name: 'User', value: `${message.author} (${message.author.id})`, inline: true },
                        { name: 'Channel', value: message.channel.toString(), inline: true },
                        { name: 'Server', value: message.guild.name, inline: true }
                    );
                    await logChannel.send({ embeds: [report] });
                }
            }
        }

    } catch (error) {
        console.error('Error checking links:', error);
    }
}

// Help command
async function handleHelpCommand(message, args) {
    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🤖 Bot Commands')
        .setDescription('A comprehensive Discord bot with link checking, global chat, and user verification.')
        .addFields(
            {
                name: '🌐 Global Chat',
                value: [
                    '`!globalchat enable` - Enable global chat in current channel',
                    '`!globalchat disable` - Disable global chat',
                    '`!globalchat stats` - View network statistics',
                    '`!globalchat ban <user_id>` - Ban user from global chat (Admin)',
                    '`!globalchat help` - Global chat help'
                ].join('\n'),
                inline: false
            },
            {
                name: '📱 User Phone Verification',
                value: [
                    '`!userphone register <phone>` - Register phone number',
                    '`!userphone verify <code>` - Verify with SMS code',
                    '`!userphone status` - Check verification status',
                    '`!userphone help` - Phone system help'
                ].join('\n'),
                inline: false
            },
            {
                name: '🔗 Link Checking',
                value: [
                    '`!linkcheck <url>` - Manually check a URL',
                    'Automatic scanning of all messages',
                    'Suspicious links are flagged automatically'
                ].join('\n'),
                inline: false
            },
            {
                name: '⚙️ General',
                value: [
                    '`!ping` - Check bot latency',
                    '`!stats` - View bot statistics',
                    '`!help` - Show this help message'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ 
            text: 'Link Checker & Global Chat Bot | Keeping Discord safe and connected',
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();

    await message.reply({ embeds: [embed] });
}

// Ping command
async function handlePingCommand(message) {
    const start = Date.now();
    const reply = await message.reply('🏓 Pinging...');
    const end = Date.now();

    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🏓 Pong!')
        .addFields(
            { name: 'Message Latency', value: `${end - start}ms`, inline: true },
            { name: 'API Latency', value: `${Math.round(client.ws.ping)}ms`, inline: true },
            { name: 'Uptime', value: formatUptime(client.uptime), inline: true }
        )
        .setTimestamp();

    await reply.edit({ content: null, embeds: [embed] });
}

// Link check command
async function handleLinkCheckCommand(message, args) {
    const url = args[0];
    if (!url) {
        return message.reply('❌ Please provide a URL to check.\nUsage: `!linkcheck <url>`');
    }

    try {
        const analysis = await linkChecker.analyzeMessage(
            url,
            message.id,
            message.channel.id,
            message.guild.id,
            message.author.id
        );

        const embed = new EmbedBuilder()
            .setColor(analysis.isSuspicious ? 0xFF6B6B : 0x00FF00)
            .setTitle(analysis.isSuspicious ? '🚨 Suspicious Link Detected' : '✅ Link Appears Safe')
            .addFields(
                { name: 'URL', value: url, inline: false },
                { name: 'Status', value: analysis.isSuspicious ? '❌ Suspicious' : '✅ Safe', inline: true },
                { name: 'Action', value: analysis.action || 'none', inline: true }
            );

        if (analysis.reasons.length > 0) {
            embed.addFields({ name: 'Reasons', value: analysis.reasons.join('\n'), inline: false });
        }

        if (analysis.urls.length > 0) {
            const urlInfo = analysis.urls.map(u => {
                let info = `• ${u.url}`;
                if (u.isSuspicious) info += ' ❌';
                if (u.redirectsTo) info += `\n  → ${u.redirectsTo}`;
                return info;
            }).join('\n');
            embed.addFields({ name: 'URL Analysis', value: urlInfo, inline: false });
        }

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error checking link:', error);
        await message.reply('❌ An error occurred while checking the link.');
    }
}

// Stats command
async function handleStatsCommand(message) {
    try {
        const globalChatStats = await globalChat.getGlobalChatStats();
        
        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('📊 Bot Statistics')
            .addFields(
                { name: '🏠 Servers', value: client.guilds.cache.size.toString(), inline: true },
                { name: '👥 Users', value: client.users.cache.size.toString(), inline: true },
                { name: '📺 Channels', value: client.channels.cache.size.toString(), inline: true },
                { name: '🌐 Global Chat Servers', value: globalChatStats ? globalChatStats.enabledServers.toString() : 'N/A', inline: true },
                { name: '🔗 Active Webhooks', value: globalChatStats ? globalChatStats.activeWebhooks.toString() : 'N/A', inline: true },
                { name: '⏱️ Uptime', value: formatUptime(client.uptime), inline: true },
                { name: '💾 Memory Usage', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
                { name: '🏓 Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Bot Statistics' });

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Error getting stats:', error);
        await message.reply('❌ An error occurred while getting statistics.');
    }
}

// Utility function to format uptime
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// Error handling
client.on('error', console.error);
client.on('warn', console.warn);

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Scheduled tasks
cron.schedule('0 */6 * * *', async () => {
    console.log('🧹 Running scheduled cleanup tasks...');
    
    // Cleanup expired verification codes
    userPhoneCommands.cleanupExpiredCodes();
    
    // Cleanup invalid webhooks
    await globalChat.cleanupInvalidWebhooks();
    
    console.log('✅ Cleanup tasks completed');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('📴 Shutting down bot...');
    await database.close();
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('📴 Shutting down bot...');
    await database.close();
    client.destroy();
    process.exit(0);
});

// Start the bot
client.login(process.env.DISCORD_TOKEN);