const { Events } = require('discord.js');
const moment = require('moment');

const {
    applyLockdown,
    createSecurityEvent,
    enforcePermanentBan,
    isAuthorizedBot,
    isVerifiedDiscordBot
} = require('../utils/security');

// Patrones sospechosos de nombres de usuario (bots coordinados)
const SUSPICIOUS_PATTERNS = [
    /\d{4,}$/, // Termina con 4+ números (ej: usuario1234)
    /^[a-z]+\d{3,}$/i, // Letras + 3+ números (ej: abc123)
    /(.{2,})\1{2,}/i, // Caracteres repetidos (ej: aaa, bbb)
    /(free|nitro|gift|steam|discord|giveaway|prize|winner|claim)/i, // Palabras de scam
    /[\u{1F300}-\u{1F9FF}]/u, // Emojis en nombre (bots de spam)
];

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

        // Bypass anti-alt para usuarios autorizados con cuentas nuevas
        const isAuthorizedNewAccount = await client.db.isTrustedUser(member.guild.id, member.user.id, 'newaccount');
        
        if (settings.anti_alts && accountAge < settings.min_account_age_days && !isAuthorizedNewAccount) {
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

        // Detección de nombres sospechosos (bots/scam) - solo si está activado
        if (settings.anti_suspicious_names) {
            const suspiciousScore = SUSPICIOUS_PATTERNS.reduce((score, pattern) => {
                return score + (pattern.test(member.user.username) ? 1 : 0);
            }, 0);

            if (suspiciousScore >= 2) {
                try {
                    await member.kick('Nombre de usuario sospechoso detectado');
                } catch (error) {
                    console.error('Error expulsando usuario con nombre sospechoso:', error.message);
                }

                await createSecurityEvent(client, member.guild, settings, {
                    type: 'SUSPICIOUS_NAME',
                    severity: 'medium',
                    title: 'Nombre sospechoso detectado',
                    color: '#e67e22',
                    description: `${member.user.tag} fue expulsado por tener un nombre sospechoso de spam/bot.`,
                    target: member.user,
                    metadata: { username: member.user.username, suspiciousScore }
                });
                return;
            }
        }

        await assignVerificationRole(member, settings);
        await assignAutoRole(member, client);
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

async function assignAutoRole(member, client) {
    try {
        const autoRoleData = await client.db.getAutoRole(member.guild.id);
        if (!autoRoleData) return;

        const role = member.guild.roles.cache.get(autoRoleData.role_id);
        if (!role) {
            console.error(`Rol automático no encontrado: ${autoRoleData.role_id}`);
            return;
        }

        if (member.roles.cache.has(autoRoleData.role_id)) return;

        await member.roles.add(role, 'Rol automático asignado por Ghostly Guard');
        
        const settings = await client.db.getGuildSettings(member.guild.id);
        await createSecurityEvent(client, member.guild, settings, {
            type: 'AUTOROL_ASSIGNED',
            severity: 'info',
            title: 'Rol Automático Asignado',
            color: '#57f287',
            description: `Se asignó el rol **${role.name}** automáticamente a ${member.user.tag}.`,
            target: member.user,
            metadata: { roleId: role.id, roleName: role.name }
        });

    } catch (error) {
        console.error('Error asignando rol automático:', error.message);
    }
}
