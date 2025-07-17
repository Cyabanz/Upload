const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor(dbPath = './database.sqlite') {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('Connected to SQLite database');
                this.initializeTables();
            }
        });
    }

    initializeTables() {
        // Global chat settings table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS global_chat_settings (
                guild_id TEXT PRIMARY KEY,
                enabled INTEGER DEFAULT 0,
                channel_id TEXT,
                webhook_url TEXT,
                webhook_id TEXT,
                webhook_token TEXT
            )
        `);

        // Global chat bans table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS global_chat_bans (
                user_id TEXT PRIMARY KEY,
                banned_by TEXT,
                reason TEXT,
                banned_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // User profiles table (Yggdrasil-like system)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                phone_number TEXT UNIQUE,
                verified INTEGER DEFAULT 0,
                verification_code TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Suspicious links table
        this.db.run(`
            CREATE TABLE IF NOT EXISTS suspicious_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT,
                reported_by TEXT,
                guild_id TEXT,
                channel_id TEXT,
                message_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Server admin settings
        this.db.run(`
            CREATE TABLE IF NOT EXISTS server_admins (
                guild_id TEXT,
                user_id TEXT,
                permissions TEXT DEFAULT 'basic',
                added_by TEXT,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (guild_id, user_id)
            )
        `);

        console.log('Database tables initialized');
    }

    // Global Chat Settings
    getGlobalChatSettings(guildId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM global_chat_settings WHERE guild_id = ?',
                [guildId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    setGlobalChatSettings(guildId, enabled, channelId, webhookUrl, webhookId, webhookToken) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO global_chat_settings 
                 (guild_id, enabled, channel_id, webhook_url, webhook_id, webhook_token) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [guildId, enabled ? 1 : 0, channelId, webhookUrl, webhookId, webhookToken],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // Global Chat Bans
    banUserFromGlobalChat(userId, bannedBy, reason) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO global_chat_bans (user_id, banned_by, reason) VALUES (?, ?, ?)',
                [userId, bannedBy, reason],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    unbanUserFromGlobalChat(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM global_chat_bans WHERE user_id = ?',
                [userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    isUserBannedFromGlobalChat(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM global_chat_bans WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                }
            );
        });
    }

    // User Profiles (Phone verification system)
    createUserProfile(userId, phoneNumber) {
        return new Promise((resolve, reject) => {
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            this.db.run(
                'INSERT OR REPLACE INTO user_profiles (user_id, phone_number, verification_code) VALUES (?, ?, ?)',
                [userId, phoneNumber, verificationCode],
                function(err) {
                    if (err) reject(err);
                    else resolve(verificationCode);
                }
            );
        });
    }

    verifyUserPhone(userId, code) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM user_profiles WHERE user_id = ? AND verification_code = ?',
                [userId, code],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        this.db.run(
                            'UPDATE user_profiles SET verified = 1, verification_code = NULL WHERE user_id = ?',
                            [userId],
                            function(updateErr) {
                                if (updateErr) reject(updateErr);
                                else resolve(true);
                            }
                        );
                    } else {
                        resolve(false);
                    }
                }
            );
        });
    }

    getUserProfile(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM user_profiles WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Suspicious Links
    addSuspiciousLink(url, reportedBy, guildId, channelId, messageId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO suspicious_links (url, reported_by, guild_id, channel_id, message_id) VALUES (?, ?, ?, ?, ?)',
                [url, reportedBy, guildId, channelId, messageId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    // Server Admins
    addServerAdmin(guildId, userId, permissions, addedBy) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO server_admins (guild_id, user_id, permissions, added_by) VALUES (?, ?, ?, ?)',
                [guildId, userId, permissions, addedBy],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    removeServerAdmin(guildId, userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM server_admins WHERE guild_id = ? AND user_id = ?',
                [guildId, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }

    getServerAdmin(guildId, userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM server_admins WHERE guild_id = ? AND user_id = ?',
                [guildId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    getAllGlobalChatSettings() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM global_chat_settings WHERE enabled = 1',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

module.exports = Database;