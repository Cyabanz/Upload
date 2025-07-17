const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class GlobalChatCommands {
    constructor(globalChat, database) {
        this.globalChat = globalChat;
        this.db = database;
    }

    async handleGlobalChatEnable(message, args) {
        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ You need **Manage Server** permission to use this command.');
        }

        try {
            const channel = message.mentions.channels.first() || message.channel;
            
            // Check if bot has webhook permissions
            if (!channel.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.ManageWebhooks)) {
                return message.reply('❌ I need **Manage Webhooks** permission in that channel to enable global chat.');
            }

            const isEnabled = await this.globalChat.isGlobalChatEnabled(message.guild.id);
            if (isEnabled) {
                return message.reply('✅ Global chat is already enabled in this server.');
            }

            const success = await this.globalChat.enableGlobalChat(message.guild, channel);
            
            if (success) {
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('🌐 Global Chat Enabled')
                    .setDescription(`Global chat has been enabled in ${channel}`)
                    .addFields(
                        { name: 'Channel', value: channel.toString(), inline: true },
                        { name: 'Enabled by', value: message.author.toString(), inline: true }
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                // Send welcome message to global chat
                const welcomeMessage = await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x3498db)
                            .setTitle('🌐 Welcome to Global Chat!')
                            .setDescription('This channel is now connected to the global chat network. Messages sent here will be shared across all connected servers.')
                            .addFields(
                                { name: '📋 Rules', value: '• Be respectful to users from other servers\n• No spam or excessive messages\n• Follow Discord ToS and server rules\n• Inappropriate content will be filtered', inline: false },
                                { name: '🔧 Commands', value: '• `!globalchat disable` - Disable global chat\n• `!globalchat stats` - View network statistics', inline: false }
                            )
                            .setFooter({ text: `Server: ${message.guild.name}`, iconURL: message.guild.iconURL() })
                    ]
                });
            } else {
                return message.reply('❌ Failed to enable global chat. Please try again.');
            }
        } catch (error) {
            console.error('Error enabling global chat:', error);
            return message.reply('❌ An error occurred while enabling global chat.');
        }
    }

    async handleGlobalChatSet(message, args) {
        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ You need **Manage Server** permission to use this command.');
        }

        try {
            const channel = message.mentions.channels.first();
            
            if (!channel) {
                return message.reply('❌ Please mention a channel to set as global chat.\nUsage: `!globalchatset #channel`');
            }
            
            // Check if bot has webhook permissions
            if (!channel.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.ManageWebhooks)) {
                return message.reply('❌ I need **Manage Webhooks** permission in that channel to set it as global chat.');
            }

            const success = await this.globalChat.enableGlobalChat(message.guild, channel);
            
            if (success) {
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('🌐 Global Chat Channel Set')
                    .setDescription(`${channel} has been set as the global chat channel for this server!`)
                    .addFields(
                        { name: 'Channel', value: channel.toString(), inline: true },
                        { name: 'Set by', value: message.author.toString(), inline: true },
                        { name: 'Server', value: message.guild.name, inline: true }
                    )
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                // Send welcome message to global chat
                const welcomeMessage = await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x3498db)
                            .setTitle('🌐 Global Chat Channel Activated!')
                            .setDescription('This channel is now connected to the global chat network. Messages sent here will be shared across all connected servers.')
                            .addFields(
                                { name: '📋 Rules', value: '• Be respectful to users from other servers\n• No spam or excessive messages\n• Follow Discord ToS and server rules\n• Inappropriate content will be filtered', inline: false },
                                { name: '🔧 Commands', value: '• `!globalchat disable` - Disable global chat\n• `!globalchat stats` - View network statistics\n• `!userphone` - Talk to people across servers', inline: false }
                            )
                            .setFooter({ text: `Server: ${message.guild.name}`, iconURL: message.guild.iconURL() })
                    ]
                });
            } else {
                return message.reply('❌ Failed to set global chat channel. Please try again.');
            }
        } catch (error) {
            console.error('Error setting global chat channel:', error);
            return message.reply('❌ An error occurred while setting the global chat channel.');
        }
    }

    async handleGlobalChatDisable(message, args) {
        // Check permissions
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ You need **Manage Server** permission to use this command.');
        }

        try {
            const isEnabled = await this.globalChat.isGlobalChatEnabled(message.guild.id);
            if (!isEnabled) {
                return message.reply('❌ Global chat is not enabled in this server.');
            }

            const success = await this.globalChat.disableGlobalChat(message.guild.id);
            
            if (success) {
                const embed = new EmbedBuilder()
                    .setColor(0xff6b6b)
                    .setTitle('🌐 Global Chat Disabled')
                    .setDescription('Global chat has been disabled in this server.')
                    .addFields(
                        { name: 'Disabled by', value: message.author.toString(), inline: true }
                    )
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            } else {
                return message.reply('❌ Failed to disable global chat. Please try again.');
            }
        } catch (error) {
            console.error('Error disabling global chat:', error);
            return message.reply('❌ An error occurred while disabling global chat.');
        }
    }

    async handleGlobalChatStats(message, args) {
        try {
            const stats = await this.globalChat.getGlobalChatStats();
            
            if (!stats) {
                return message.reply('❌ Failed to retrieve global chat statistics.');
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('🌐 Global Chat Network Statistics')
                .addFields(
                    { name: '🏠 Total Servers', value: stats.totalServers.toString(), inline: true },
                    { name: '✅ Active Servers', value: stats.enabledServers.toString(), inline: true },
                    { name: '🔗 Active Webhooks', value: stats.activeWebhooks.toString(), inline: true },
                    { name: '📊 Message Queue', value: stats.queueLength.toString(), inline: true },
                    { name: '📈 Network Health', value: stats.activeWebhooks === stats.enabledServers ? '🟢 Healthy' : '🟡 Some Issues', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Global Chat Network' });

            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error getting global chat stats:', error);
            return message.reply('❌ An error occurred while retrieving statistics.');
        }
    }

    async handleGlobalChatBan(message, args) {
        // Check permissions - only server admins can ban from global chat
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need **Administrator** permission to ban users from global chat.');
        }

        const userId = args[0];
        const reason = args.slice(1).join(' ') || 'No reason provided';

        if (!userId) {
            return message.reply('❌ Please provide a user ID to ban.\nUsage: `!globalchat ban <user_id> [reason]`');
        }

        try {
            // Check if user is already banned
            const isBanned = await this.db.isUserBannedFromGlobalChat(userId);
            if (isBanned) {
                return message.reply('❌ This user is already banned from global chat.');
            }

            const success = await this.globalChat.banUserFromGlobalChat(userId, message.author.id, reason);
            
            if (success) {
                const embed = new EmbedBuilder()
                    .setColor(0xff6b6b)
                    .setTitle('🔨 Global Chat Ban')
                    .addFields(
                        { name: 'User ID', value: userId, inline: true },
                        { name: 'Banned by', value: message.author.toString(), inline: true },
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Server', value: message.guild.name, inline: true }
                    )
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            } else {
                return message.reply('❌ Failed to ban user from global chat.');
            }
        } catch (error) {
            console.error('Error banning user from global chat:', error);
            return message.reply('❌ An error occurred while banning the user.');
        }
    }

    async handleGlobalChatUnban(message, args) {
        // Check permissions - only server admins can unban from global chat
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ You need **Administrator** permission to unban users from global chat.');
        }

        const userId = args[0];

        if (!userId) {
            return message.reply('❌ Please provide a user ID to unban.\nUsage: `!globalchat unban <user_id>`');
        }

        try {
            // Check if user is banned
            const isBanned = await this.db.isUserBannedFromGlobalChat(userId);
            if (!isBanned) {
                return message.reply('❌ This user is not banned from global chat.');
            }

            const success = await this.globalChat.unbanUserFromGlobalChat(userId);
            
            if (success) {
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✅ Global Chat Unban')
                    .addFields(
                        { name: 'User ID', value: userId, inline: true },
                        { name: 'Unbanned by', value: message.author.toString(), inline: true },
                        { name: 'Server', value: message.guild.name, inline: true }
                    )
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            } else {
                return message.reply('❌ Failed to unban user from global chat.');
            }
        } catch (error) {
            console.error('Error unbanning user from global chat:', error);
            return message.reply('❌ An error occurred while unbanning the user.');
        }
    }

    async handleGlobalChatHelp(message, args) {
        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🌐 Global Chat Commands')
            .setDescription('Manage global chat settings for your server')
            .addFields(
                {
                    name: '**Basic Commands**',
                    value: [
                        '`!globalchatset #channel` - Set a channel as global chat (Yggdrasil style)',
                        '`!globalchat enable [#channel]` - Enable global chat (legacy)',
                        '`!globalchat disable` - Disable global chat',
                        '`!globalchat stats` - View network statistics',
                        '`!globalchat help` - Show this help message'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '**Admin Commands**',
                    value: [
                        '`!globalchat ban <user_id> [reason]` - Ban user from global chat',
                        '`!globalchat unban <user_id>` - Unban user from global chat'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '**Permissions Required**',
                    value: [
                        '**Manage Server** - Basic commands',
                        '**Administrator** - Ban/unban commands',
                        '**Manage Webhooks** - Bot needs this in the channel'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'Global Chat Network | Bot created for cross-server communication' });

        return message.reply({ embeds: [embed] });
    }

    async handleGlobalChatCommand(message, args) {
        const subcommand = args[0]?.toLowerCase();
        const subArgs = args.slice(1);

        switch (subcommand) {
            case 'enable':
                return this.handleGlobalChatEnable(message, subArgs);
            case 'set':
            case 'globalchatset':
                return this.handleGlobalChatSet(message, subArgs);
            case 'disable':
                return this.handleGlobalChatDisable(message, subArgs);
            case 'stats':
                return this.handleGlobalChatStats(message, subArgs);
            case 'ban':
                return this.handleGlobalChatBan(message, subArgs);
            case 'unban':
                return this.handleGlobalChatUnban(message, subArgs);
            case 'help':
            default:
                return this.handleGlobalChatHelp(message, subArgs);
        }
    }
}

module.exports = GlobalChatCommands;