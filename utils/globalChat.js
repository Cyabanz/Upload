const axios = require('axios');
const { WebhookClient } = require('discord.js');

class GlobalChat {
    constructor(database, profanityFilter) {
        this.db = database;
        this.profanityFilter = profanityFilter;
        this.webhookClients = new Map();
        this.messageQueue = [];
        this.processing = false;
    }

    async initializeWebhooks() {
        try {
            const settings = await this.db.getAllGlobalChatSettings();
            
            for (const setting of settings) {
                if (setting.webhook_id && setting.webhook_token) {
                    const webhook = new WebhookClient({
                        id: setting.webhook_id,
                        token: setting.webhook_token
                    });
                    this.webhookClients.set(setting.guild_id, webhook);
                }
            }
            
            console.log(`Initialized ${this.webhookClients.size} global chat webhooks`);
        } catch (error) {
            console.error('Error initializing webhooks:', error);
        }
    }

    async createWebhookForGuild(guild, channel) {
        try {
            const webhook = await channel.createWebhook({
                name: 'Global Chat',
                avatar: guild.client.user.displayAvatarURL(),
                reason: 'Global Chat System'
            });

            // Store webhook in database
            await this.db.setGlobalChatSettings(
                guild.id,
                true,
                channel.id,
                webhook.url,
                webhook.id,
                webhook.token
            );

            // Store webhook client
            const webhookClient = new WebhookClient({
                id: webhook.id,
                token: webhook.token
            });
            this.webhookClients.set(guild.id, webhookClient);

            return webhook;
        } catch (error) {
            console.error('Error creating webhook:', error);
            throw error;
        }
    }

    async enableGlobalChat(guild, channel) {
        try {
            // Check if webhook already exists
            let settings = await this.db.getGlobalChatSettings(guild.id);
            
            if (!settings || !settings.webhook_id) {
                // Create new webhook
                await this.createWebhookForGuild(guild, channel);
                settings = await this.db.getGlobalChatSettings(guild.id);
            } else {
                // Update existing settings
                await this.db.setGlobalChatSettings(
                    guild.id,
                    true,
                    channel.id,
                    settings.webhook_url,
                    settings.webhook_id,
                    settings.webhook_token
                );
            }

            return true;
        } catch (error) {
            console.error('Error enabling global chat:', error);
            return false;
        }
    }

    async disableGlobalChat(guildId) {
        try {
            const settings = await this.db.getGlobalChatSettings(guildId);
            if (settings) {
                await this.db.setGlobalChatSettings(
                    guildId,
                    false,
                    settings.channel_id,
                    settings.webhook_url,
                    settings.webhook_id,
                    settings.webhook_token
                );
            }

            // Remove webhook client
            this.webhookClients.delete(guildId);
            return true;
        } catch (error) {
            console.error('Error disabling global chat:', error);
            return false;
        }
    }

    async sendGlobalMessage(message, excludeGuildId = null) {
        try {
            // Check if user is banned
            const isBanned = await this.db.isUserBannedFromGlobalChat(message.author.id);
            if (isBanned) {
                return { success: false, reason: 'User is banned from global chat' };
            }

            // Check for profanity
            const containsProfanity = await this.profanityFilter.checkProfanity(message.content);
            let messageContent = message.content;
            
            if (containsProfanity) {
                const shouldAutoModerate = await this.profanityFilter.shouldAutoModerate(message.content);
                if (shouldAutoModerate) {
                    return { success: false, reason: 'Message contains inappropriate content' };
                }
                // Filter profanity for global chat
                messageContent = await this.profanityFilter.filterProfanity(message.content);
            }

            const messageData = {
                content: messageContent,
                username: `${message.author.displayName} | ${message.guild.name}`,
                avatarURL: message.author.displayAvatarURL(),
                embeds: [],
                allowedMentions: { parse: [] } // Disable mentions in global chat
            };

            // Add server info embed for context
            if (message.attachments.size > 0) {
                messageData.embeds.push({
                    color: 0x3498db,
                    footer: {
                        text: `From: ${message.guild.name} | User ID: ${message.author.id}`,
                        icon_url: message.guild.iconURL()
                    },
                    fields: [
                        {
                            name: 'Attachments',
                            value: message.attachments.map(att => `[${att.name}](${att.url})`).join('\n'),
                            inline: false
                        }
                    ]
                });
            } else {
                messageData.embeds.push({
                    color: 0x3498db,
                    footer: {
                        text: `From: ${message.guild.name} | User ID: ${message.author.id}`,
                        icon_url: message.guild.iconURL()
                    }
                });
            }

            // Add to queue for processing
            this.messageQueue.push({
                messageData,
                excludeGuildId,
                originalMessage: message
            });

            if (!this.processing) {
                this.processMessageQueue();
            }

            return { success: true };
        } catch (error) {
            console.error('Error sending global message:', error);
            return { success: false, reason: 'Internal error' };
        }
    }

    async processMessageQueue() {
        if (this.processing || this.messageQueue.length === 0) return;
        
        this.processing = true;

        while (this.messageQueue.length > 0) {
            const { messageData, excludeGuildId } = this.messageQueue.shift();
            
            try {
                const webhookPromises = [];
                
                for (const [guildId, webhook] of this.webhookClients) {
                    if (guildId === excludeGuildId) continue;
                    
                    // Check if this guild still has global chat enabled
                    const settings = await this.db.getGlobalChatSettings(guildId);
                    if (!settings || !settings.enabled) {
                        this.webhookClients.delete(guildId);
                        continue;
                    }
                    
                    webhookPromises.push(
                        webhook.send(messageData).catch(error => {
                            console.error(`Error sending to guild ${guildId}:`, error);
                            // If webhook is invalid, remove it
                            if (error.status === 404) {
                                this.webhookClients.delete(guildId);
                            }
                        })
                    );
                }

                // Send to all webhooks in parallel
                await Promise.allSettled(webhookPromises);
                
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('Error processing message:', error);
            }
        }

        this.processing = false;
    }

    async getGlobalChatStats() {
        try {
            const allSettings = await this.db.getAllGlobalChatSettings();
            const enabledServers = allSettings.filter(s => s.enabled).length;
            const activeWebhooks = this.webhookClients.size;

            return {
                totalServers: allSettings.length,
                enabledServers,
                activeWebhooks,
                queueLength: this.messageQueue.length
            };
        } catch (error) {
            console.error('Error getting global chat stats:', error);
            return null;
        }
    }

    async isGlobalChatEnabled(guildId) {
        try {
            const settings = await this.db.getGlobalChatSettings(guildId);
            return settings ? settings.enabled : false;
        } catch (error) {
            console.error('Error checking global chat status:', error);
            return false;
        }
    }

    async getGlobalChatChannel(guildId) {
        try {
            const settings = await this.db.getGlobalChatSettings(guildId);
            return settings ? settings.channel_id : null;
        } catch (error) {
            console.error('Error getting global chat channel:', error);
            return null;
        }
    }

    // Admin functions
    async banUserFromGlobalChat(userId, bannedBy, reason) {
        try {
            await this.db.banUserFromGlobalChat(userId, bannedBy, reason);
            return true;
        } catch (error) {
            console.error('Error banning user from global chat:', error);
            return false;
        }
    }

    async unbanUserFromGlobalChat(userId) {
        try {
            await this.db.unbanUserFromGlobalChat(userId);
            return true;
        } catch (error) {
            console.error('Error unbanning user from global chat:', error);
            return false;
        }
    }

    // Check if user has permission to manage global chat in their server
    hasGlobalChatPermission(member) {
        return member.permissions.has('ManageGuild') || member.permissions.has('Administrator');
    }

    // Cleanup invalid webhooks
    async cleanupInvalidWebhooks() {
        const invalidGuilds = [];
        
        for (const [guildId, webhook] of this.webhookClients) {
            try {
                await webhook.fetchMessage('0'); // This will fail, but we can catch the error type
            } catch (error) {
                if (error.status === 404 || error.status === 401) {
                    invalidGuilds.push(guildId);
                }
            }
        }

        for (const guildId of invalidGuilds) {
            this.webhookClients.delete(guildId);
            await this.disableGlobalChat(guildId);
        }

        console.log(`Cleaned up ${invalidGuilds.length} invalid webhooks`);
    }
}

module.exports = GlobalChat;