const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ms = require('ms');
const moment = require('moment');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        const settings = await client.db.getGuildSettings(member.guild.id);
        
        if (!settings.anti_raid) return;

        const accountAge = moment().diff(moment(member.user.createdAt), 'days');
        await client.db.trackJoin(member.guild.id, member.id, accountAge);

        const recentJoins = await client.db.getRecentJoins(member.guild.id, 1);
        
        if (recentJoins >= settings.max_joins_per_minute) {
            await handleRaid(member, client, settings, `Raid detectado: ${recentJoins} joins en 1 minuto`);
            return;
        }

        if (settings.anti_alts && accountAge < settings.min_account_age_days) {
            await handleAltAccount(member, client, settings, accountAge);
            return;
        }

        if (settings.anti_bots && member.user.bot) {
            await handleExternalBot(member, client, settings);
            return;
        }

        if (settings.verification_role) {
            const role = member.guild.roles.cache.get(settings.verification_role);
            if (role) {
                try {
                    await member.roles.add(role);
                } catch (error) {
                    console.error('Error al añadir rol de verificación:', error);
                }
            }
        }

        await logNewMember(member, client, settings);
    },
};

async function handleRaid(member, client, settings, reason) {
    try {
        const guild = member.guild;
        
        await member.ban({ reason: 'Raid detectado - Ghostly Anti-Raid' });
        
        await client.db.logRaid(guild.id, member.id, member.user.tag, 'BAN_AUTO', reason);

        const members = await guild.members.fetch();
        const recentMembers = members.filter(m => {
            const joinTime = m.joinedAt;
            const now = new Date();
            return (now - joinTime) < ms('5 minutes');
        });

        for (const [_, m] of recentMembers) {
            if (!m.permissions.has(PermissionFlagsBits.Administrator)) {
                try {
                    await m.ban({ reason: 'Raid detectado - Ghostly Anti-Raid' });
                    await client.db.logRaid(guild.id, m.id, m.user.tag, 'BAN_AUTO', 'Miembro durante raid');
                } catch (error) {
                    console.error(`Error al banear a ${m.user.tag}:`, error);
                }
            }
        }

        await sendRaidAlert(guild, client, settings, reason);
        
    } catch (error) {
        console.error('Error en manejo de raid:', error);
    }
}

async function handleAltAccount(member, client, settings, accountAge) {
    try {
        await member.kick(`Cuenta muy nueva (${accountAge} días) - Ghostly Anti-Raid`);
        
        await client.db.logRaid(member.guild.id, member.id, member.user.tag, 'KICK_AUTO', `Cuenta alternativa: ${accountAge} días`);
        
        if (settings.log_channel) {
            const logChannel = member.guild.channels.cache.get(settings.log_channel);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Cuenta Alternativa Detectada')
                    .setColor('#ff9900')
                    .setDescription(`Se ha expulsado a una cuenta alternativa`)
                    .addFields(
                        { name: 'Usuario', value: `${member.user.tag} (${member.id})`, inline: true },
                        { name: 'Edad de la cuenta', value: `${accountAge} días`, inline: true },
                        { name: 'Mínimo requerido', value: `${settings.min_account_age_days} días`, inline: true }
                    )
                    .setTimestamp();
                
                await logChannel.send({ embeds: [embed] });
            }
        }
    } catch (error) {
        console.error('Error en manejo de cuenta alternativa:', error);
    }
}

async function handleExternalBot(member, client, settings) {
    try {
        if (member.user.id === client.user.id) return;
        
        await member.kick('Bot externo detectado - Ghostly Anti-Raid');
        
        await client.db.logRaid(member.guild.id, member.id, member.user.tag, 'KICK_AUTO', 'Bot externo');
        
        if (settings.log_channel) {
            const logChannel = member.guild.channels.cache.get(settings.log_channel);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Bot Externo Detectado')
                    .setColor('#ff0066')
                    .setDescription(`Se ha expulsado un bot no autorizado`)
                    .addFields(
                        { name: 'Bot', value: `${member.user.tag} (${member.id})`, inline: true },
                        { name: 'Acción', value: 'Expulsión automática', inline: true }
                    )
                    .setTimestamp();
                
                await logChannel.send({ embeds: [embed] });
            }
        }
    } catch (error) {
        console.error('Error en manejo de bot externo:', error);
    }
}

async function logNewMember(member, client, settings) {
    if (!settings.log_channel) return;
    
    const logChannel = member.guild.channels.cache.get(settings.log_channel);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('Nuevo Miembro')
        .setColor('#00ff00')
        .setDescription(`${member.user.tag} se ha unido al servidor`)
        .addFields(
            { name: 'ID de Usuario', value: member.id, inline: true },
            { name: 'Edad de la cuenta', value: `${moment().diff(moment(member.user.createdAt), 'days')} días`, inline: true },
            { name: 'Total de miembros', value: member.guild.memberCount.toString(), inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error al enviar log de nuevo miembro:', error);
    }
}

async function sendRaidAlert(guild, client, settings, reason) {
    if (settings.log_channel) {
        const logChannel = guild.channels.cache.get(settings.log_channel);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('¡RAID DETECTADO!')
                .setColor('#ff0000')
                .setDescription('Se ha activado el sistema anti-raid automáticamente')
                .addFields(
                    { name: 'Motivo', value: reason, inline: false },
                    { name: 'Acciones tomadas', value: 'Miembros recientes baneados\nModo raid activado', inline: false },
                    { name: 'Recomendación', value: 'Revisa la configuración de seguridad y considera activar el modo de verificación', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Ghostly Anti-Raid - Protección activa' });

            await logChannel.send({ content: '@everyone ¡RAID DETECTADO!', embeds: [embed] });
        }
    }
}
