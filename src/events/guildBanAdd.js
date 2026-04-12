const { Events, PermissionFlagsBits } = require('discord.js');
const { AuditLogEvent, createSecurityEvent, fetchRecentAuditEntry, isProtectedOwner, isWhitelisted } = require('../utils/security');

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban, client) {
        const settings = await client.db.getGuildSettings(ban.guild.id);
        if (!settings.anti_nuke) return;

        const entry = await fetchRecentAuditEntry(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
        if (!entry?.executor) return;

        const executor = entry.executor;
        if (await shouldIgnoreActor(client, ban.guild, executor.id)) return;

        const recentBans = await client.db.getRecentBans(ban.guild.id, executor.id, 60000);
        
        if (recentBans >= settings.max_bans_per_minute || recentBans >= 5) {
            const executorMember = await ban.guild.members.fetch(executor.id).catch(() => null);
            if (executorMember?.moderatable) {
                await executorMember.timeout(60 * 60 * 1000, 'Baneo masivo detectado');
            }

            await ban.guild.members.unban(ban.user.id, 'Restauración automática Ghostly Guard').catch(() => null);

            await createSecurityEvent(client, ban.guild, settings, {
                type: 'MASS_BAN_BLOCKED',
                severity: 'critical',
                title: 'Baneo masivo detectado y prevenido',
                color: '#ed4245',
                description: `${executor.tag} realizó ${recentBans} baneos en el último minuto. Se ha aplicado timeout y se han desbaneado los usuarios.`,
                actor: executor,
                target: ban.user,
                metadata: {
                    banCount: recentBans,
                    userId: ban.user.id,
                    userTag: ban.user.tag
                },
                alertOwners: true
            });
        }

        await client.db.logBan(ban.guild.id, executor.id, ban.user.id);
    }
};

async function shouldIgnoreActor(client, guild, userId) {
    if (!userId) return true;
    if (await isProtectedOwner(client, guild, userId)) return true;
    if (await isWhitelisted(client, guild.id, userId)) return true;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;

    return member.id === guild.members.me?.id;
}
