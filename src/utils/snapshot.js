const fs = require('fs');
const path = require('path');

class SnapshotManager {
    constructor(client) {
        this.client = client;
        this.snapshots = new Map();
        this.init();
    }

    init() {
        setInterval(() => {
            this.autoSnapshotAllGuilds();
        }, 3600000); // Cada hora
    }

    async autoSnapshotAllGuilds() {
        for (const guild of this.client.guilds.cache.values()) {
            try {
                const settings = await this.client.db.getGuildSettings(guild.id);
                if (settings.anti_nuke) {
                    await this.createSnapshot(guild.id, 'auto');
                }
            } catch (error) {
                console.error(`Error al crear snapshot para guild ${guild.id}:`, error.message);
            }
        }
    }

    async createSnapshot(guildId, type = 'manual', createdBy = null) {
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return null;

        const snapshot = {
            id: `${guildId}-${Date.now()}`,
            guildId,
            type,
            createdBy,
            createdAt: new Date(),
            channels: [],
            roles: []
        };

        for (const channel of guild.channels.cache.values()) {
            snapshot.channels.push({
                id: channel.id,
                name: channel.name,
                type: channel.type,
                parentId: channel.parentId,
                position: channel.position,
                topic: channel.topic,
                nsfw: channel.nsfw,
                rateLimitPerUser: channel.rateLimitPerUser,
                permissionOverwrites: channel.permissionOverwrites.cache.map(perm => ({
                    id: perm.id,
                    type: perm.type,
                    allow: perm.allow.bitfield.toString(),
                    deny: perm.deny.bitfield.toString()
                }))
            });
        }

        for (const role of guild.roles.cache.values()) {
            snapshot.roles.push({
                id: role.id,
                name: role.name,
                color: role.hexColor,
                hoist: role.hoist,
                position: role.position,
                permissions: role.permissions.bitfield.toString(),
                mentionable: role.mentionable
            });
        }

        this.snapshots.set(snapshot.id, snapshot);

        const filePath = await this.saveSnapshotToFile(snapshot);
        await this.client.db.createBackup(guildId, filePath, type, createdBy);

        return snapshot;
    }

    async saveSnapshotToFile(snapshot) {
        const dataDir = path.join(__dirname, '../../data/snapshots');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const fileName = `${snapshot.guildId}-${Date.now()}.json`;
        const filePath = path.join(dataDir, fileName);

        fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));

        return filePath;
    }

    async restoreSnapshot(snapshotId) {
        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) {
            const filePath = await this.loadSnapshotFromFile(snapshotId);
            if (!filePath) return null;
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.snapshots.set(snapshotId, data);
            return this.restoreSnapshot(snapshotId);
        }

        const guild = this.client.guilds.cache.get(snapshot.guildId);
        if (!guild) return null;

        try {
            for (const roleData of snapshot.roles) {
                const existingRole = guild.roles.cache.get(roleData.id);
                if (!existingRole) {
                    await guild.roles.create({
                        name: roleData.name,
                        color: roleData.color,
                        hoist: roleData.hoist,
                        position: roleData.position,
                        permissions: BigInt(roleData.permissions),
                        mentionable: roleData.mentionable,
                        reason: 'Restauración desde snapshot Ghostly Guard'
                    }).catch(() => null);
                }
            }

            for (const channelData of snapshot.channels) {
                const existingChannel = guild.channels.cache.get(channelData.id);
                if (!existingChannel) {
                    const parent = channelData.parentId ? guild.channels.cache.get(channelData.parentId) : null;
                    
                    if (channelData.type === 0) {
                        await guild.channels.create({
                            name: channelData.name,
                            type: channelData.type,
                            parent: parent,
                            position: channelData.position,
                            topic: channelData.topic,
                            nsfw: channelData.nsfw,
                            rateLimitPerUser: channelData.rateLimitPerUser,
                            permissionOverwrites: channelData.permissionOverwrites.map(perm => ({
                                id: perm.id,
                                type: perm.type,
                                allow: BigInt(perm.allow),
                                deny: BigInt(perm.deny)
                            })),
                            reason: 'Restauración desde snapshot Ghostly Guard'
                        }).catch(() => null);
                    }
                }
            }

            return true;
        } catch (error) {
            console.error('Error al restaurar snapshot:', error.message);
            return false;
        }
    }

    async loadSnapshotFromFile(snapshotId) {
        const dataDir = path.join(__dirname, '../../data/snapshots');
        const files = fs.readdirSync(dataDir);
        
        for (const file of files) {
            if (file.includes(snapshotId)) {
                return path.join(dataDir, file);
            }
        }

        return null;
    }

    async getLatestSnapshot(guildId) {
        for (const [id, snapshot] of this.snapshots) {
            if (snapshot.guildId === guildId) {
                return snapshot;
            }
        }

        const dataDir = path.join(__dirname, '../../data/snapshots');
        if (!fs.existsSync(dataDir)) return null;

        const files = fs.readdirSync(dataDir)
            .filter(f => f.startsWith(guildId))
            .sort((a, b) => b.localeCompare(a));

        if (files.length > 0) {
            const filePath = path.join(dataDir, files[0]);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.snapshots.set(data.id, data);
            return data;
        }

        return null;
    }

    async cleanupOldSnapshots(guildId, keepCount = 5) {
        const dataDir = path.join(__dirname, '../../data/snapshots');
        if (!fs.existsSync(dataDir)) return;

        const files = fs.readdirSync(dataDir)
            .filter(f => f.startsWith(guildId))
            .sort((a, b) => b.localeCompare(a));

        if (files.length > keepCount) {
            for (let i = keepCount; i < files.length; i++) {
                const filePath = path.join(dataDir, files[i]);
                fs.unlinkSync(filePath);
                
                const snapshotId = files[i].replace('.json', '');
                this.snapshots.delete(snapshotId);
            }
        }
    }
}

module.exports = SnapshotManager;
