const { Events } = require('discord.js');
const moment = require('moment');

const {
    applyLockdown,
    createSecurityEvent,
    enforcePermanentBan,
    isAuthorizedBot,
    isVerifiedDiscordBot
} = require('../utils/security');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        const settings = await client.db.getGuildSettings(member.guild.id);
        const accountAge = moment().diff(moment(member.user.createdAt), 'days');

        await client.db.trackJoin(member.guild.id, member.id, accountAge);

        const permanentBan = await client.db.getPermanentBan(member.guild.id, member.id);
        if (permanentBan) {
            const banned = await enforcePermanentBan(member, client, permanentBan.reason || 'Ban permanente activo');
            if (banned) {
                await createSecurityEvent(client, member.guild, settings, {
                    type: 'PERMANENT_BAN_ENFORCED',
                    severity: 'critical',
                    title: 'Ban permanente aplicado al reingresar',
                    color: '#ed4245',
                    description: `El usuario ${member.user.tag} intento entrar de nuevo y fue baneado automaticamente.`,
                    target: member.user,
                    metadata: { reason: permanentBan.reason },
                    alertOwners: true
                });
            }
            return;
        }

        if (member.user.bot && settings.anti_bots) {
            const authorizedBot = await isAuthorizedBot(client, member.guild.id, member.id);
            const verifiedBot = await isVerifiedDiscordBot(member.user);
            const allowBot = authorizedBot || (settings.anti_bot_verified_only ? verifiedBot : false);

            if (!allowBot) {
                try {
                    await member.kick('Bot no autorizado por Ghostly Guard');
                } catch (error) {
                    console.error('Error expulsando bot no autorizado:', error);
                }

                await createSecurityEvent(client, member.guild, settings, {
                    type: 'UNAUTHORIZED_BOT_BLOCKED',
                    severity: 'high',
                    title: 'Bot no autorizado bloqueado',
                    color: '#faa61a',
                    description: `El bot ${member.user.tag} fue expulsado al no estar autorizado.`,
                    target: member.user,
                    metadata: { verifiedBot, anti_bot_verified_only: settings.anti_bot_verified_only },
                    alertOwners: true
                });
                return;
            }
        }

        if (!settings.anti_raid) {
            return assignVerificationRole(member, settings);
        }

        const recentJoins = await client.db.getRecentJoins(member.guild.id, 1);
        if (recentJoins >= settings.max_joins_per_minute) {
            await applyLockdown(member.guild, true, 'Raid detectado automaticamente');
            await client.db.updateGuildSettings(member.guild.id, { lockdown_active: 1 });

            await createSecurityEvent(client, member.guild, settings, {
                type: 'RAID_DETECTED',
                severity: 'critical',
                title: 'Raid detectado',
                color: '#ed4245',
                description: `Se detectaron ${recentJoins} entradas en menos de 1 minuto. Lockdown activado.`,
                target: member.user,
                metadata: { recentJoins, threshold: settings.max_joins_per_minute },
                alertOwners: true
            });

            try {
                await member.ban({ reason: 'Raid detectado por Ghostly Guard' });
            } catch (error) {
                console.error('Error baneando miembro durante raid:', error.message);
            }
            return;
        }

        if (settings.anti_alts && accountAge < settings.min_account_age_days) {
            try {
                await member.kick(`Cuenta muy nueva: ${accountAge} dias`);
            } catch (error) {
                console.error('Error expulsando cuenta nueva:', error.message);
            }

            await createSecurityEvent(client, member.guild, settings, {
                type: 'ALT_ACCOUNT_BLOCKED',
                severity: 'medium',
                title: 'Cuenta alternativa detectada',
                color: '#faa61a',
                description: `${member.user.tag} fue expulsado por tener una cuenta de ${accountAge} dias.`,
                target: member.user,
                metadata: { accountAge, minRequired: settings.min_account_age_days }
            });
            return;
        }

        await assignVerificationRole(member, settings);
        await createSecurityEvent(client, member.guild, settings, {
            type: 'MEMBER_JOIN',
            severity: 'info',
            title: 'Nuevo miembro',
            color: '#57f287',
            description: `${member.user.tag} entro al servidor.`,
            target: member.user,
            metadata: { accountAge, memberCount: member.guild.memberCount }
        });
    }
};

async function assignVerificationRole(member, settings) {
    if (!settings.verification_role) return;

    const role = member.guild.roles.cache.get(settings.verification_role);
    if (!role) return;

    try {
        await member.roles.add(role);
    } catch (error) {
        console.error('Error asignando rol de verificacion:', error.message);
    }
}
