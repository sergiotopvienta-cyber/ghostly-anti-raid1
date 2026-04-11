const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class Database {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
        const dbPath = path.join(__dirname, '../../data/database.sqlite');
        const dataDir = path.dirname(dbPath);
        
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error al conectar con la base de datos:', err.message);
            } else {
                console.log('Conectado a la base de datos SQLite');
                this.createTables();
            }
        });
    }

    createTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id TEXT PRIMARY KEY,
                anti_raid INTEGER DEFAULT 1,
                anti_nuke INTEGER DEFAULT 1,
                anti_flood INTEGER DEFAULT 1,
                anti_bots INTEGER DEFAULT 1,
                anti_alts INTEGER DEFAULT 1,
                anti_links INTEGER DEFAULT 1,
                anti_mentions INTEGER DEFAULT 1,
                log_channel TEXT,
                welcome_channel TEXT,
                verification_role TEXT,
                max_joins_per_minute INTEGER DEFAULT 5,
                max_messages_per_second INTEGER DEFAULT 3,
                max_mentions_per_message INTEGER DEFAULT 5,
                min_account_age_days INTEGER DEFAULT 7,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS raid_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT,
                user_id TEXT,
                user_tag TEXT,
                action TEXT,
                reason TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS punishments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT,
                user_id TEXT,
                user_tag TEXT,
                punishment_type TEXT,
                reason TEXT,
                moderator_id TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME
            )`,
            
            `CREATE TABLE IF NOT EXISTS join_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT,
                user_id TEXT,
                join_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                account_age INTEGER
            )`,
            
            `CREATE TABLE IF NOT EXISTS message_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT,
                user_id TEXT,
                channel_id TEXT,
                message_time DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        tables.forEach(table => {
            this.db.run(table, (err) => {
                if (err) {
                    console.error('Error al crear tabla:', err.message);
                }
            });
        });
    }

    getGuildSettings(guildId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM guild_settings WHERE guild_id = ?',
                [guildId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row || this.getDefaultSettings(guildId));
                    }
                }
            );
        });
    }

    getDefaultSettings(guildId) {
        return {
            guild_id: guildId,
            anti_raid: 1,
            anti_nuke: 1,
            anti_flood: 1,
            anti_bots: 1,
            anti_alts: 1,
            anti_links: 1,
            anti_mentions: 1,
            log_channel: null,
            welcome_channel: null,
            verification_role: null,
            max_joins_per_minute: 5,
            max_messages_per_second: 3,
            max_mentions_per_message: 5,
            min_account_age_days: 7
        };
    }

    updateGuildSettings(guildId, settings) {
        const keys = Object.keys(settings).filter(key => key !== 'guild_id');
        const values = keys.map(key => settings[key]);
        const setClause = keys.map(key => `${key} = ?`).join(', ');

        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE guild_settings SET ${setClause} WHERE guild_id = ?`,
                [...values, guildId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                }
            );
        });
    }

    createGuildSettings(guildId) {
        const defaults = this.getDefaultSettings(guildId);
        const keys = Object.keys(defaults);
        const values = Object.values(defaults);
        const placeholders = keys.map(() => '?').join(', ');

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO guild_settings (${keys.join(', ')}) VALUES (${placeholders})`,
                values,
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    logRaid(guildId, userId, userTag, action, reason) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO raid_logs (guild_id, user_id, user_tag, action, reason) VALUES (?, ?, ?, ?, ?)',
                [guildId, userId, userTag, action, reason],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    trackJoin(guildId, userId, accountAge) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO join_tracking (guild_id, user_id, account_age) VALUES (?, ?, ?)',
                [guildId, userId, accountAge],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    getRecentJoins(guildId, minutes = 1) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT COUNT(*) as count FROM join_tracking WHERE guild_id = ? AND join_time > datetime("now", "-' + minutes + ' minutes")',
                [guildId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows[0].count);
                    }
                }
            );
        });
    }

    trackMessage(guildId, userId, channelId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO message_tracking (guild_id, user_id, channel_id) VALUES (?, ?, ?)',
                [guildId, userId, channelId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    getRecentMessages(guildId, userId, seconds = 1) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT COUNT(*) as count FROM message_tracking WHERE guild_id = ? AND user_id = ? AND message_time > datetime("now", "-' + seconds + ' seconds")',
                [guildId, userId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows[0].count);
                    }
                }
            );
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error al cerrar la base de datos:', err.message);
                } else {
                    console.log('Conexión a la base de datos cerrada');
                }
            });
        }
    }
}

module.exports = Database;
