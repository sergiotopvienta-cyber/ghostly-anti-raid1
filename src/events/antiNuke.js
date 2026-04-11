const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client) {
        const settings = await client.db.getGuildSettings(newMember.guild.id);
        
        if (!settings.anti_nuke) return;

        if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
            await handleRoleChanges(oldMember, newMember, client, settings);
        }
    },
};

async function handleRoleChanges(oldMember, newMember, client, settings) {
    const executor = await getAuditLogEntry(newMember.guild, 'MEMBER_ROLE_UPDATE', newMember.user.id);
    
    if (!executor) return;
    
    if (executor.executor.permissions.has(PermissionFlagsBits.Administrator)) return;
    
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));

    if (removedRoles.size > 5 || addedRoles.size > 5) {
        await handleMassRoleChange(newMember.guild, executor, oldMember, newMember, client, settings, removedRoles, addedRoles);
    }
}

async function handleMassRoleChange(guild, executor, oldMember, newMember, client, settings, removedRoles, addedRoles) {
    try {
        await executor.executor.timeout(ms('1 hour'), 'Cambio masivo de roles detectado - Ghostly Anti-Raid');
        
        await client.db.logRaid(guild.id, executor.executor.id, executor.executor.user.tag, 'TIMEOUT_AUTO', 'Cambio masivo de roles');

        for (const [_, role] of removedRoles) {
            try {
                await newMember.roles.add(role, 'Restauración automática - Ghostly Anti-Raid');
            } catch (error) {
                console.error('Error al restaurar rol:', error);
            }
        }

        for (const [_, role] of addedRoles) {
            try {
                await newMember.roles.remove(role, 'Restauración automática - Ghostly Anti-Raid');
            } catch (error) {
                console.error('Error al remover rol añadido:', error);
            }
        }

        if (settings.log_channel) {
            const logChannel = guild.channels.cache.get(settings.log_channel);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Cambio Masivo de Roles Detectado')
                    .setColor('#ff0000')
                    .setDescription('Se ha detectado un cambio masivo de roles y ha sido revertido')
                    .addFields(
                        { name: 'Ejecutor', value: `${executor.executor.user.tag} (${executor.executor.id})`, inline: true },
                        { name: 'Víctima', value: `${newMember.user.tag} (${newMember.id})`, inline: true },
                        { name: 'Roles removidos', value: removedRoles.size.toString(), inline: true },
                        { name: 'Roles añadidos', value: addedRoles.size.toString(), inline: true },
                        { name: 'Acción', value: 'Executor timeout 1 hora + Roles revertidos', inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] });
            }
        }

    } catch (error) {
        console.error('Error en manejo de cambio masivo de roles:', error);
    }
}

async function getAuditLogEntry(guild, actionType, targetId) {
    try {
        const logs = await guild.fetchAuditLogs({
            limit: 10,
            type: actionType
        });

        return logs.entries.find(entry => 
            entry.target.id === targetId && 
            (Date.now() - entry.createdTimestamp) < 5000
        );
    } catch (error) {
        console.error('Error al obtener audit log:', error);
        return null;
    }
}

async function handleChannelDeletion(channel, client, settings) {
    const executor = await getAuditLogEntry(channel.guild, 'CHANNEL_DELETE', channel.id);
    
    if (!executor) return;
    
    if (executor.executor.permissions.has(PermissionFlagsBits.Administrator)) return;

    try {
        await executor.executor.timeout(ms('1 hour'), 'Eliminación masiva de canales detectada - Ghostly Anti-Raid');
        
        await client.db.logRaid(channel.guild.id, executor.executor.id, executor.executor.user.tag, 'TIMEOUT_AUTO', 'Eliminación de canal');

        if (settings.log_channel) {
            const logChannel = channel.guild.channels.cache.get(settings.log_channel);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .title('Eliminación de Canal Detectada')
                    .setColor('#ff0000')
                    .setDescription('Se ha detectado la eliminación de un canal')
                    .addFields(
                        { name: 'Ejecutor', value: `${executor.executor.user.tag} (${executor.executor.id})`, inline: true },
                        { name: 'Canal eliminado', value: `${channel.name} (${channel.id})`, inline: true },
                        { name: 'Tipo', value: channel.type === 'GUILD_TEXT' ? 'Texto' : 'Voz', inline: true },
                        { name: 'Acción', value: 'Executor timeout 1 hora', inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] });
            }
        }

    } catch (error) {
        console.error('Error en manejo de eliminación de canal:', error);
    }
}

async function handleRoleDeletion(role, client, settings) {
    const executor = await getAuditLogEntry(role.guild, 'ROLE_DELETE', role.id);
    
    if (!executor) return;
    
    if (executor.executor.permissions.has(PermissionFlagsBits.Administrator)) return;

    try {
        await executor.executor.timeout(ms('1 hour'), 'Eliminación masiva de roles detectada - Ghostly Anti-Raid');
        
        await client.db.logRaid(role.guild.id, executor.executor.id, executor.executor.user.tag, 'TIMEOUT_AUTO', 'Eliminación de rol');

        if (settings.log_channel) {
            const logChannel = role.guild.channels.cache.get(settings.log_channel);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Eliminación de Rol Detectada')
                    .setColor('#ff0000')
                    .setDescription('Se ha detectado la eliminación de un rol')
                    .addFields(
                        { name: 'Ejecutor', value: `${executor.executor.user.tag} (${executor.executor.id})`, inline: true },
                        { name: 'Rol eliminado', value: `${role.name} (${role.id})`, inline: true },
                        { name: 'Color', value: role.hexColor || 'N/A', inline: true },
                        { name: 'Acción', value: 'Executor timeout 1 hora', inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] });
            }
        }

    } catch (error) {
        console.error('Error en manejo de eliminación de rol:', error);
    }
}

module.exports.handleChannelDeletion = handleChannelDeletion;
module.exports.handleRoleDeletion = handleRoleDeletion;
