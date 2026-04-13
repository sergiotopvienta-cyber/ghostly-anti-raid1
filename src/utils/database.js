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
                anti_bot_verified_only INTEGER DEFAULT 1,
                lockdown_active INTEGER DEFAULT 0,
                log_channel TEXT,
                welcome_channel TEXT,
                verification_role TEXT,
                alert_channel TEXT,
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
            )`,

            `CREATE TABLE IF NOT EXISTS trusted_users (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                added_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (guild_id, user_id, type)
            )`,

            `CREATE TABLE IF NOT EXISTS permanent_bans (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                reason TEXT,
                added_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (guild_id, user_id)
            )`,

            `CREATE TABLE IF NOT EXISTS security_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                type TEXT NOT NULL,
                severity TEXT DEFAULT 'info',
                actor_id TEXT,
                actor_tag TEXT,
                target_id TEXT,
                target_tag TEXT,
                details TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS backups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'manual',
                file_path TEXT NOT NULL,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS ban_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                executor_id TEXT NOT NULL,
                banned_user_id TEXT NOT NULL,
                ban_time DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS message_content (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                message_time DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS autorol (
                guild_id TEXT PRIMARY KEY,
                role_id TEXT NOT NULL,
                set_by TEXT NOT NULL,
                set_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        this.db.serialize(() => {
            tables.forEach((table) => {
                this.db.run(table, (err) => {
                    if (err) {
                        console.error('Error al crear tabla:', err.message);
                    }
                });
            });

            this.runMigrations();
        });
    }

    runMigrations() {
        const migrations = [
            'ALTER TABLE guild_settings ADD COLUMN anti_bot_verified_only INTEGER DEFAULT 1',
            'ALTER TABLE guild_settings ADD COLUMN lockdown_active INTEGER DEFAULT 0',
            'ALTER TABLE guild_settings ADD COLUMN alert_channel TEXT'
        ];

        migrations.forEach((migration) => {
            this.db.run(migration, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error('Error en migracion SQLite:', err.message);
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
            anti_bot_verified_only: 1,
            lockdown_active: 0,
            log_channel: null,
            welcome_channel: null,
            verification_role: null,
            alert_channel: null,
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

        return new Promise(async (resolve, reject) => {
            try {
                await this.ensureGuildSettings(guildId);
            } catch (error) {
                reject(error);
                return;
            }

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

    ensureGuildSettings(guildId) {
        return new Promise((resolve, reject) => {
            const defaults = this.getDefaultSettings(guildId);
            const keys = Object.keys(defaults);
            const values = Object.values(defaults);
            const placeholders = keys.map(() => '?').join(', ');

            this.db.run(
                `INSERT OR IGNORE INTO guild_settings (${keys.join(', ')}) VALUES (${placeholders})`,
                values,
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
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

    logSecurityEvent(event) {
        const {
            guildId,
            type,
            severity = 'info',
            actorId = null,
            actorTag = null,
            targetId = null,
            targetTag = null,
            details = null,
            metadata = null
        } = event;

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO security_events (
                    guild_id, type, severity, actor_id, actor_tag, target_id, target_tag, details, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    guildId,
                    type,
                    severity,
                    actorId,
                    actorTag,
                    targetId,
                    targetTag,
                    details,
                    metadata ? JSON.stringify(metadata) : null
                ],
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

    getRecentSecurityEvents(guildId, limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM security_events
                 WHERE guild_id = ?
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [guildId, limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    getGlobalRecentSecurityEvents(limit = 20) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM security_events
                 ORDER BY created_at DESC
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    getSecurityEventCounts(guildId = null) {
        const query = guildId
            ? `SELECT severity, COUNT(*) AS total FROM security_events WHERE guild_id = ? GROUP BY severity`
            : `SELECT severity, COUNT(*) AS total FROM security_events GROUP BY severity`;
        const params = guildId ? [guildId] : [];

        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    addTrustedUser(guildId, userId, type, addedBy = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO trusted_users (guild_id, user_id, type, added_by) VALUES (?, ?, ?, ?)',
                [guildId, userId, type, addedBy],
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

    removeTrustedUser(guildId, userId, type) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM trusted_users WHERE guild_id = ? AND user_id = ? AND type = ?',
                [guildId, userId, type],
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

    listTrustedUsers(guildId, type) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM trusted_users WHERE guild_id = ? AND type = ? ORDER BY created_at DESC',
                [guildId, type],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    async isTrustedUser(guildId, userId, type) {
        const row = await new Promise((resolve, reject) => {
            this.db.get(
                'SELECT 1 FROM trusted_users WHERE guild_id = ? AND user_id = ? AND type = ?',
                [guildId, userId, type],
                (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                }
            );
        });

        return Boolean(row);
    }

    addPermanentBan(guildId, userId, reason = null, addedBy = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO permanent_bans (guild_id, user_id, reason, added_by) VALUES (?, ?, ?, ?)',
                [guildId, userId, reason, addedBy],
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

    removePermanentBan(guildId, userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM permanent_bans WHERE guild_id = ? AND user_id = ?',
                [guildId, userId],
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

    getPermanentBan(guildId, userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM permanent_bans WHERE guild_id = ? AND user_id = ?',
                [guildId, userId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row || null);
                    }
                }
            );
        });
    }

    listPermanentBans(guildId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM permanent_bans WHERE guild_id = ? ORDER BY created_at DESC',
                [guildId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    createBackupRecord(guildId, type, filePath, createdBy = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO backups (guild_id, type, file_path, created_by) VALUES (?, ?, ?, ?)',
                [guildId, type, filePath, createdBy],
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

    getLatestBackup(guildId, type = null) {
        const query = type
            ? 'SELECT * FROM backups WHERE guild_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1'
            : 'SELECT * FROM backups WHERE guild_id = ? ORDER BY created_at DESC LIMIT 1';
        const params = type ? [guildId, type] : [guildId];

        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    listBackups(guildId, limit = 5) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM backups WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?',
                [guildId, limit],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
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

    logBan(guildId, executorId, bannedUserId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO ban_tracking (guild_id, executor_id, banned_user_id) VALUES (?, ?, ?)',
                [guildId, executorId, bannedUserId],
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

    getRecentBans(guildId, executorId, milliseconds = 60000) {
        return new Promise((resolve, reject) => {
            const seconds = Math.floor(milliseconds / 1000);
            this.db.all(
                'SELECT COUNT(*) as count FROM ban_tracking WHERE guild_id = ? AND executor_id = ? AND ban_time > datetime("now", "-' + seconds + ' seconds")',
                [guildId, executorId],
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

    trackMessageContent(guildId, userId, content) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO message_content (guild_id, user_id, content) VALUES (?, ?, ?)',
                [guildId, userId, content],
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

    getDuplicateMessages(guildId, userId, content, seconds = 30) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT COUNT(*) as count FROM message_content WHERE guild_id = ? AND user_id = ? AND content = ? AND message_time > datetime("now", "-' + seconds + ' seconds")',
                [guildId, userId, content],
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

    setAutoRole(guildId, roleId, setBy) {
        const actorId = setBy || 'system';
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS autorol (
                        guild_id TEXT PRIMARY KEY,
                        role_id TEXT NOT NULL,
                        set_by TEXT NOT NULL,
                        set_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`,
                    (createErr) => {
                        if (createErr) {
                            reject(createErr);
                            return;
                        }

                        this.db.run(
                            'INSERT OR REPLACE INTO autorol (guild_id, role_id, set_by) VALUES (?, ?, ?)',
                            [guildId, roleId, actorId],
                            function(err) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(this.lastID);
                                }
                            }
                        );
                    }
                );
            });
        });
    }

    getAutoRole(guildId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM autorol WHERE guild_id = ?',
                [guildId],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row || null);
                    }
                }
            );
        });
    }

    removeAutoRole(guildId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM autorol WHERE guild_id = ?',
                [guildId],
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
