const { Events } = require('discord.js');

const {
    AuditLogEvent,
    createSecurityEvent,
    fetchRecentAuditEntry,
    isProtectedOwner,
    isWhitelisted,
    restoreDeletedChannel,
    restoreDeletedRole
} = require('../utils/security');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client) {
        const settings = await client.db.getGuildSettings(newMember.guild.id);
        if (!settings.anti_nuke) return;

        if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
            await handleRoleChanges(oldMember, newMember, client, settings);
        }
    }
};

async function handleRoleChanges(oldMember, newMember, client, settings) {
    const entry = await fetchRecentAuditEntry(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
    if (!entry?.executor) return;

    const executor = entry.executor;
    if (await shouldIgnoreActor(client, newMember.guild, executor.id)) return;

    const removedRoles = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id));
    const addedRoles = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));

    if (removedRoles.size > 3 || addedRoles.size > 3) {
        const memberExecutor = await newMember.guild.members.fetch(executor.id).catch(() => null);
        if (memberExecutor?.moderatable) {
            await memberExecutor.timeout(60 * 60 * 1000, 'Cambio masivo de roles detectado');
        }

        for (const [, role] of removedRoles) {
            await newMember.roles.add(role, 'Restauracion automatica Ghostly Guard').catch(() => null);
        }

        for (const [, role] of addedRoles) {
            await newMember.roles.remove(role, 'Restauracion automatica Ghostly Guard').catch(() => null);
        }

        await createSecurityEvent(client, newMember.guild, settings, {
            type: 'MASS_ROLE_CHANGE_REVERTED',
            severity: 'critical',
            title: 'Cambio masivo de roles revertido',
            color: '#ed4245',
            description: `Se revirtieron cambios de roles hechos por ${executor.tag}.`,
            actor: executor,
            target: newMember.user,
            metadata: {
                removedRoles: removedRoles.map((role) => role.name),
                addedRoles: addedRoles.map((role) => role.name)
            },
            alertOwners: true
        });
    }
}

async function handleChannelDeletion(channel, client) {
    const settings = await client.db.getGuildSettings(channel.guild.id);
    if (!settings.anti_nuke) return;

    const entry = await fetchRecentAuditEntry(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    if (!entry?.executor) return;
    if (await shouldIgnoreActor(client, channel.guild, entry.executor.id)) return;

    await restoreDeletedChannel(channel).catch((error) => {
        console.error('No se pudo restaurar el canal eliminado:', error.message);
    });

    const executorMember = await channel.guild.members.fetch(entry.executor.id).catch(() => null);
    if (executorMember?.moderatable) {
        await executorMember.timeout(60 * 60 * 1000, 'Eliminacion de canal detectada');
    }

    await createSecurityEvent(client, channel.guild, settings, {
        type: 'CHANNEL_RESTORED',
        severity: 'critical',
        title: 'Canal restaurado automaticamente',
        color: '#ed4245',
        description: `Se detecto la eliminacion del canal ${channel.name} y se intento restaurar.`,
        actor: entry.executor,
        metadata: { channelId: channel.id, channelName: channel.name },
        alertOwners: true
    });
}

async function handleRoleDeletion(role, client) {
    const settings = await client.db.getGuildSettings(role.guild.id);
    if (!settings.anti_nuke) return;

    const entry = await fetchRecentAuditEntry(role.guild, AuditLogEvent.RoleDelete, role.id);
    if (!entry?.executor) return;
    if (await shouldIgnoreActor(client, role.guild, entry.executor.id)) return;

    await restoreDeletedRole(role).catch((error) => {
        console.error('No se pudo restaurar el rol eliminado:', error.message);
    });

    const executorMember = await role.guild.members.fetch(entry.executor.id).catch(() => null);
    if (executorMember?.moderatable) {
        await executorMember.timeout(60 * 60 * 1000, 'Eliminacion de rol detectada');
    }

    await createSecurityEvent(client, role.guild, settings, {
        type: 'ROLE_RESTORED',
        severity: 'critical',
        title: 'Rol restaurado automaticamente',
        color: '#ed4245',
        description: `Se detecto la eliminacion del rol ${role.name} y se intento restaurar.`,
        actor: entry.executor,
        metadata: { roleId: role.id, roleName: role.name },
        alertOwners: true
    });
}

async function shouldIgnoreActor(client, guild, userId) {
    if (!userId) return true;
    if (await isProtectedOwner(client, guild, userId)) return true;
    if (await isWhitelisted(client, guild.id, userId)) return true;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;

    return member.id === guild.members.me?.id;
}

module.exports.handleChannelDeletion = handleChannelDeletion;
module.exports.handleRoleDeletion = handleRoleDeletion;
