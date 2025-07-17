const { EmbedBuilder } = require('discord.js');

class UserPhoneCommands {
    constructor(database) {
        this.db = database;
        this.verificationCodes = new Map(); // Store temporary verification codes
    }

    async handleUserPhoneRegister(message, args) {
        const phoneNumber = args[0];

        if (!phoneNumber) {
            return message.reply('❌ Please provide a phone number.\nUsage: `!userphone register <phone_number>`\nExample: `!userphone register +1234567890`');
        }

        // Basic phone number validation
        const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return message.reply('❌ Invalid phone number format. Please use international format.\nExample: `+1234567890` or `+1 (234) 567-8900`');
        }

        try {
            // Check if user already has a profile
            const existingProfile = await this.db.getUserProfile(message.author.id);
            if (existingProfile && existingProfile.verified) {
                return message.reply('✅ You already have a verified phone number registered.');
            }

            // Create or update user profile with phone number
            const verificationCode = await this.db.createUserProfile(message.author.id, phoneNumber);

            // Store the code temporarily (in a real implementation, you'd send via SMS)
            this.verificationCodes.set(message.author.id, {
                code: verificationCode,
                phoneNumber,
                timestamp: Date.now()
            });

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📱 Phone Registration')
                .setDescription('Your phone number has been registered! Please verify it to complete the process.')
                .addFields(
                    { name: 'Phone Number', value: phoneNumber, inline: true },
                    { name: 'Status', value: '⏳ Pending Verification', inline: true }
                )
                .setFooter({ text: 'Use !userphone verify <code> to verify your number' });

            await message.reply({ embeds: [embed] });

            // In a real implementation, you would send the verification code via SMS
            // For demo purposes, we'll send it via DM
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xffd700)
                    .setTitle('📱 Verification Code')
                    .setDescription(`Your verification code is: **${verificationCode}**`)
                    .addFields(
                        { name: 'Phone Number', value: phoneNumber, inline: true },
                        { name: 'Valid For', value: '10 minutes', inline: true }
                    )
                    .setFooter({ text: 'Use !userphone verify <code> in the server to verify' });

                await message.author.send({ embeds: [dmEmbed] });
                await message.reply('📨 A verification code has been sent to your DMs (in a real implementation, this would be sent via SMS).');
            } catch (error) {
                await message.reply('⚠️ Could not send verification code via DM. Please enable DMs from server members or use the code in your server logs.');
                console.log(`Verification code for ${message.author.tag}: ${verificationCode}`);
            }

        } catch (error) {
            console.error('Error registering phone number:', error);
            return message.reply('❌ An error occurred while registering your phone number.');
        }
    }

    async handleUserPhoneVerify(message, args) {
        const providedCode = args[0];

        if (!providedCode) {
            return message.reply('❌ Please provide the verification code.\nUsage: `!userphone verify <code>`');
        }

        try {
            // Check temporary storage first
            const tempData = this.verificationCodes.get(message.author.id);
            if (tempData) {
                // Check if code is expired (10 minutes)
                if (Date.now() - tempData.timestamp > 10 * 60 * 1000) {
                    this.verificationCodes.delete(message.author.id);
                    return message.reply('❌ Verification code has expired. Please register again.');
                }

                if (tempData.code === providedCode) {
                    // Verify in database
                    const success = await this.db.verifyUserPhone(message.author.id, providedCode);
                    
                    if (success) {
                        this.verificationCodes.delete(message.author.id);
                        
                        const embed = new EmbedBuilder()
                            .setColor(0x00ff00)
                            .setTitle('✅ Phone Verified')
                            .setDescription('Your phone number has been successfully verified!')
                            .addFields(
                                { name: 'Phone Number', value: tempData.phoneNumber, inline: true },
                                { name: 'Status', value: '✅ Verified', inline: true },
                                { name: 'Verified At', value: new Date().toLocaleString(), inline: true }
                            )
                            .setFooter({ text: 'You can now use global chat and other verified features' });

                        return message.reply({ embeds: [embed] });
                    }
                }
            }

            // Fallback to database verification
            const success = await this.db.verifyUserPhone(message.author.id, providedCode);
            
            if (success) {
                const profile = await this.db.getUserProfile(message.author.id);
                
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle('✅ Phone Verified')
                    .setDescription('Your phone number has been successfully verified!')
                    .addFields(
                        { name: 'Phone Number', value: profile.phone_number, inline: true },
                        { name: 'Status', value: '✅ Verified', inline: true }
                    )
                    .setFooter({ text: 'You can now use global chat and other verified features' });

                return message.reply({ embeds: [embed] });
            } else {
                return message.reply('❌ Invalid verification code. Please check and try again.');
            }

        } catch (error) {
            console.error('Error verifying phone number:', error);
            return message.reply('❌ An error occurred while verifying your phone number.');
        }
    }

    async handleUserPhoneStatus(message, args) {
        try {
            const profile = await this.db.getUserProfile(message.author.id);
            
            if (!profile) {
                return message.reply('❌ You have not registered a phone number yet.\nUse `!userphone register <phone_number>` to get started.');
            }

            const embed = new EmbedBuilder()
                .setColor(profile.verified ? 0x00ff00 : 0xffd700)
                .setTitle('📱 Phone Status')
                .addFields(
                    { name: 'Phone Number', value: profile.phone_number, inline: true },
                    { name: 'Status', value: profile.verified ? '✅ Verified' : '⏳ Pending Verification', inline: true },
                    { name: 'Registered', value: new Date(profile.created_at).toLocaleString(), inline: true }
                );

            if (!profile.verified) {
                embed.setDescription('Your phone number is registered but not verified yet.')
                    .setFooter({ text: 'Use !userphone verify <code> to verify your number' });
            } else {
                embed.setDescription('Your phone number is registered and verified!');
            }

            return message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error getting phone status:', error);
            return message.reply('❌ An error occurred while checking your phone status.');
        }
    }

    async handleUserPhoneUpdate(message, args) {
        const newPhoneNumber = args[0];

        if (!newPhoneNumber) {
            return message.reply('❌ Please provide a new phone number.\nUsage: `!userphone update <new_phone_number>`');
        }

        // Basic phone number validation
        const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
        if (!phoneRegex.test(newPhoneNumber)) {
            return message.reply('❌ Invalid phone number format. Please use international format.\nExample: `+1234567890` or `+1 (234) 567-8900`');
        }

        try {
            const profile = await this.db.getUserProfile(message.author.id);
            
            if (!profile) {
                return message.reply('❌ You have not registered a phone number yet.\nUse `!userphone register <phone_number>` to get started.');
            }

            // Create new verification code for the new number
            const verificationCode = await this.db.createUserProfile(message.author.id, newPhoneNumber);

            // Store the code temporarily
            this.verificationCodes.set(message.author.id, {
                code: verificationCode,
                phoneNumber: newPhoneNumber,
                timestamp: Date.now()
            });

            const embed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('📱 Phone Number Updated')
                .setDescription('Your phone number has been updated! Please verify the new number.')
                .addFields(
                    { name: 'Old Number', value: profile.phone_number, inline: true },
                    { name: 'New Number', value: newPhoneNumber, inline: true },
                    { name: 'Status', value: '⏳ Pending Verification', inline: true }
                )
                .setFooter({ text: 'Use !userphone verify <code> to verify your new number' });

            await message.reply({ embeds: [embed] });

            // Send verification code via DM
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xffd700)
                    .setTitle('📱 New Number Verification Code')
                    .setDescription(`Your verification code for the new number is: **${verificationCode}**`)
                    .addFields(
                        { name: 'New Phone Number', value: newPhoneNumber, inline: true },
                        { name: 'Valid For', value: '10 minutes', inline: true }
                    )
                    .setFooter({ text: 'Use !userphone verify <code> in the server to verify' });

                await message.author.send({ embeds: [dmEmbed] });
                await message.reply('📨 A verification code has been sent to your DMs.');
            } catch (error) {
                await message.reply('⚠️ Could not send verification code via DM. Please enable DMs from server members.');
                console.log(`Verification code for ${message.author.tag}: ${verificationCode}`);
            }

        } catch (error) {
            console.error('Error updating phone number:', error);
            return message.reply('❌ An error occurred while updating your phone number.');
        }
    }

    async handleUserPhoneHelp(message, args) {
        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('📱 UserPhone Commands')
            .setDescription('Manage your phone verification (Yggdrasil-like system)')
            .addFields(
                {
                    name: '**Available Commands**',
                    value: [
                        '`!userphone register <phone_number>` - Register your phone number',
                        '`!userphone verify <code>` - Verify your phone number with the code',
                        '`!userphone status` - Check your phone verification status',
                        '`!userphone update <new_phone>` - Update your phone number',
                        '`!userphone help` - Show this help message'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '**Phone Format**',
                    value: [
                        'Use international format: `+1234567890`',
                        'Or with formatting: `+1 (234) 567-8900`',
                        'Country code is recommended'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '**Benefits of Verification**',
                    value: [
                        '✅ Access to global chat',
                        '✅ Enhanced security features',
                        '✅ Trusted user status',
                        '✅ Additional bot features'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: 'UserPhone System | Secure phone verification for Discord' });

        return message.reply({ embeds: [embed] });
    }

    async handleUserPhoneCommand(message, args) {
        const subcommand = args[0]?.toLowerCase();
        const subArgs = args.slice(1);

        switch (subcommand) {
            case 'register':
                return this.handleUserPhoneRegister(message, subArgs);
            case 'verify':
                return this.handleUserPhoneVerify(message, subArgs);
            case 'status':
                return this.handleUserPhoneStatus(message, subArgs);
            case 'update':
                return this.handleUserPhoneUpdate(message, subArgs);
            case 'help':
            default:
                return this.handleUserPhoneHelp(message, subArgs);
        }
    }

    // Check if user is verified (for use in other parts of the bot)
    async isUserVerified(userId) {
        try {
            const profile = await this.db.getUserProfile(userId);
            return profile && profile.verified;
        } catch (error) {
            console.error('Error checking user verification:', error);
            return false;
        }
    }

    // Cleanup expired verification codes
    cleanupExpiredCodes() {
        const now = Date.now();
        const expiredTime = 10 * 60 * 1000; // 10 minutes

        for (const [userId, data] of this.verificationCodes.entries()) {
            if (now - data.timestamp > expiredTime) {
                this.verificationCodes.delete(userId);
            }
        }
    }
}

module.exports = UserPhoneCommands;