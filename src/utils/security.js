const fs = require('fs');
const path = require('path');
const {
    AuditLogEvent,
    ChannelType,
    EmbedBuilder,
    OverwriteType,
    PermissionFlagsBits,
    UserFlagsBitField
} = require('discord.js');

function getAlertChannel(guild, settings) {
    return guild.channels.cache.get(settings.alert_channel || settings.log_channel);
}

async function isWhitelisted(client, guildId, userId) {
    if (!userId) return false;
    return client.db.isTrustedUser(guildId, userId, 'whitelist');
}

async function isProtectedOwner(client, guild, userId) {
    if (!userId) return false;
    if (userId === guild.ownerId) return true;
    return client.db.isTrustedUser(guild.id, userId, 'owner');
}

async function isAuthorizedBot(client, guildId, userId) {
    if (!userId) return false;
    return client.db.isTrustedUser(guildId, userId, 'bot');
}

async function fetchRecentAuditEntry(guild, type, targetId = null) {
    try {
        const logs = await guild.fetchAuditLogs({ limit: 6, type });
        return logs.entries.find((entry) => {
            const fresh = Date.now() - entry.createdTimestamp < 10000;
            const sameTarget = !targetId || entry.target?.id === targetId;
            return fresh && sameTarget;
        }) || null;
    } catch (error) {
        console.error('Error al leer audit logs:', error);
        return null;
    }
}

async function sendSecurityLog(guild, settings, payload) {
    const channel = getAlertChannel(guild, settings);
    if (!channel) return;

    try {
        await channel.send(payload);
    } catch (error) {
        console.error('Error al enviar log de seguridad:', error);
    }
}

async function notifyOwners(client, guild, settings, embed) {
    const recipients = new Set([guild.ownerId]);
    const extraOwners = await client.db.listTrustedUsers(guild.id, 'owner');

    for (const owner of extraOwners) {
        recipients.add(owner.user_id);
    }

    for (const userId of recipients) {
        try {
            const user = await client.users.fetch(userId);
            await user.send({ embeds: [embed] });
        } catch (error) {
            console.error(`No se pudo alertar al owner ${userId}:`, error.message);
        }
    }
}

async function createSecurityEvent(client, guild, settings, options) {
    const embed = new EmbedBuilder()
        .setTitle(options.title)
        .setColor(options.color || '#ff0000')
        .setDescription(options.description || null)
        .setTimestamp();

    if (options.fields?.length) {
        embed.addFields(options.fields);
    }

    if (options.footer) {
        embed.setFooter({ text: options.footer });
    }

    await client.db.logSecurityEvent({
        guildId: guild.id,
        type: options.type,
        severity: options.severity || 'info',
        actorId: options.actor?.id || null,
        actorTag: options.actor?.tag || null,
        targetId: options.target?.id || null,
        targetTag: options.target?.tag || null,
        details: options.description || options.title,
        metadata: options.metadata || null
    });

    await sendSecurityLog(guild, settings, { embeds: [embed] });

    if (options.alertOwners) {
        await notifyOwners(client, guild, settings, embed);
    }

    return embed;
}

async function applyLockdown(guild, enabled, reason = 'Sin motivo especificado') {
    const everyoneRole = guild.roles.everyone;
    const editableChannels = guild.channels.cache.filter((channel) => channel.manageable);

    for (const [, channel] of editableChannels) {
        try {
            if (channel.isTextBased()) {
                await channel.permissionOverwrites.edit(everyoneRole, {
                    SendMessages: enabled ? false : null,
                    AddReactions: enabled ? false : null,
                    CreatePublicThreads: enabled ? false : null,
                    CreatePrivateThreads: enabled ? false : null
                }, { reason });
            }

            if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
                await channel.permissionOverwrites.edit(everyoneRole, {
                    Connect: enabled ? false : null
                }, { reason });
            }
        } catch (error) {
            console.error(`No se pudo actualizar permisos en ${channel.name}:`, error.message);
        }
    }
}

function serializeRole(role) {
    return {
        id: role.id,
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        position: role.position,
        permissions: role.permissions.bitfield.toString(),
        mentionable: role.mentionable
    };
}

function serializeChannel(channel) {
    return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        topic: channel.topic || null,
        nsfw: Boolean(channel.nsfw),
        bitrate: channel.bitrate || null,
        userLimit: channel.userLimit || null,
        rateLimitPerUser: channel.rateLimitPerUser || 0,
        parentId: channel.parentId || null,
        position: channel.position,
        permissionOverwrites: channel.permissionOverwrites.cache.map((overwrite) => ({
            id: overwrite.id,
            type: overwrite.type,
            allow: overwrite.allow.bitfield.toString(),
            deny: overwrite.deny.bitfield.toString()
        }))
    };
}

async function createGuildBackup(client, guild, type = 'manual', createdBy = null) {
    const backupDir = path.join(__dirname, '../../data/backups');
    fs.mkdirSync(backupDir, { recursive: true });

    const payload = {
        guildId: guild.id,
        guildName: guild.name,
        createdAt: new Date().toISOString(),
        roles: guild.roles.cache
            .filter((role) => role.id !== guild.roles.everyone.id)
            .sort((a, b) => a.position - b.position)
            .map(serializeRole),
        channels: guild.channels.cache
            .sort((a, b) => a.position - b.position)
            .map(serializeChannel)
    };

    const fileName = `${guild.id}-${type}-${Date.now()}.json`;
    const filePath = path.join(backupDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

    await client.db.createBackupRecord(guild.id, type, filePath, createdBy);

    return filePath;
}

async function ensureWeeklyBackups(client) {
    for (const [, guild] of client.guilds.cache) {
        try {
            await client.db.ensureGuildSettings(guild.id);
            const latest = await client.db.getLatestBackup(guild.id, 'weekly');
            const lastCreated = latest ? new Date(latest.created_at).getTime() : 0;
            const oneWeek = 7 * 24 * 60 * 60 * 1000;

            if (!latest || (Date.now() - lastCreated) >= oneWeek) {
                await createGuildBackup(client, guild, 'weekly', client.user.id);
                const settings = await client.db.getGuildSettings(guild.id);

                await createSecurityEvent(client, guild, settings, {
                    type: 'WEEKLY_BACKUP_CREATED',
                    severity: 'info',
                    title: 'Backup semanal creado',
                    color: '#00b894',
                    description: 'Se generó una copia de seguridad automática del servidor.',
                    alertOwners: false
                });
            }
        } catch (error) {
            console.error(`Error creando backup semanal para ${guild.id}:`, error);
        }
    }
}

async function restoreDeletedRole(role) {
    return role.guild.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        permissions: role.permissions,
        mentionable: role.mentionable,
        reason: 'Restauracion automatica Ghostly Guard'
    });
}

async function restoreDeletedChannel(channel) {
    const permissionOverwrites = channel.permissionOverwrites.cache.map((overwrite) => ({
        id: overwrite.id,
        allow: overwrite.allow.bitfield,
        deny: overwrite.deny.bitfield,
        type: overwrite.type === OverwriteType.Member ? OverwriteType.Member : OverwriteType.Role
    }));

    return channel.guild.channels.create({
        name: channel.name,
        type: channel.type,
        topic: channel.topic || undefined,
        nsfw: channel.nsfw || false,
        bitrate: channel.bitrate || undefined,
        userLimit: channel.userLimit || undefined,
        rateLimitPerUser: channel.rateLimitPerUser || undefined,
        parent: channel.parentId || undefined,
        permissionOverwrites,
        reason: 'Restauracion automatica Ghostly Guard'
    });
}

async function isVerifiedDiscordBot(user) {
    try {
        const fetched = user.flags ? user : await user.fetch(true);
        return fetched.flags?.has(UserFlagsBitField.Flags.VerifiedBot) || false;
    } catch (error) {
        return false;
    }
}

async function enforcePermanentBan(member, client, reason) {
    try {
        await member.ban({ reason });
        return true;
    } catch (error) {
        console.error(`No se pudo banear de forma permanente a ${member.id}:`, error.message);
        return false;
    }
}

module.exports = {
    AuditLogEvent,
    PermissionFlagsBits,
    applyLockdown,
    createGuildBackup,
    createSecurityEvent,
    enforcePermanentBan,
    ensureWeeklyBackups,
    fetchRecentAuditEntry,
    isAuthorizedBot,
    isProtectedOwner,
    isVerifiedDiscordBot,
    isWhitelisted,
    notifyOwners,
    restoreDeletedChannel,
    restoreDeletedRole,
    sendSecurityLog
};
