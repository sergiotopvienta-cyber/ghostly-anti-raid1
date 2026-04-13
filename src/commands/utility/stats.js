const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Muestra estadísticas del servidor y del bot'),
        
    async execute(interaction, client) {
        const guild = interaction.guild;
        
        // Obtener estadísticas de seguridad de la base de datos
        const securityStats = await client.db.getSecurityStats(guild.id) || {
            blockedRaids: 0,
            blockedLinks: 0,
            blockedBots: 0,
            kicksApplied: 0,
            bansApplied: 0,
            timeoutsApplied: 0
        };
        
        // Obtener configuración de seguridad
        const settings = await client.db.getGuildSettings(guild.id);
        
        const totalMembers = guild.memberCount;
        const humans = guild.members.cache.filter(member => !member.user.bot).size;
        const bots = guild.members.cache.filter(member => member.user.bot).size;
        const channels = guild.channels.cache.size;
        const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const roles = guild.roles.cache.size;
        
        // Calcular nivel de seguridad
        const securityFeatures = [
            settings.anti_raid,
            settings.anti_nuke,
            settings.anti_links,
            settings.anti_bots,
            settings.anti_alts
        ].filter(Boolean).length;
        
        const securityLevel = securityFeatures === 5 ? '🔒 Máximo' : 
                             securityFeatures >= 3 ? '🛡️ Alto' : 
                             securityFeatures >= 1 ? '⚠️ Medio' : '❌ Bajo';
        
        const embed = new EmbedBuilder()
            .setTitle(`📊 Estadísticas de ${guild.name}`)
            .setColor('#f1c40f')
            .setThumbnail(guild.iconURL())
            .addFields(
                { 
                    name: '📋 Información General', 
                    value: `**ID:** \`${guild.id}\`\n**Creado:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>\n**Dueño:** <@${guild.ownerId}>`, 
                    inline: false 
                },
                { 
                    name: '👥 Miembros', 
                    value: `**Total:** ${totalMembers.toLocaleString()}\n**Humanos:** ${humans.toLocaleString()}\n**Bots:** ${bots}\n**Ratio:** ${((humans/totalMembers)*100).toFixed(1)}%`, 
                    inline: true 
                },
                { 
                    name: '💬 Canales', 
                    value: `**Total:** ${channels}\n**Texto:** ${textChannels}\n**Voz:** ${voiceChannels}\n**Categorías:** ${guild.channels.cache.filter(c => c.type === 4).size}`, 
                    inline: true 
                },
                { 
                    name: '🎭 Otros', 
                    value: `**Roles:** ${roles}\n**Emojis:** ${guild.emojis.cache.size}/${guild.premiumTier * 50 + 50}\n**Boosts:** ${guild.premiumSubscriptionCount || 0} (Nivel ${guild.premiumTier})`, 
                    inline: true 
                },
                { 
                    name: '🛡️ Nivel de Seguridad', 
                    value: `${securityLevel}\n${securityFeatures}/5 protecciones activas`,
                    inline: false 
                }
            );
        
        // Agregar campo de seguridad solo si hay datos
        if (securityStats.blockedRaids > 0 || securityStats.blockedLinks > 0 || securityStats.blockedBots > 0) {
            embed.addFields({
                name: '🚨 Amenazas Bloqueadas',
                value: `**Raids:** ${securityStats.blockedRaids.toLocaleString()}\n**Links:** ${securityStats.blockedLinks.toLocaleString()}\n**Bots:** ${securityStats.blockedBots.toLocaleString()}`,
                inline: true
            });
        }
        
        // Agregar campo de moderación
        const totalActions = (securityStats.kicksApplied || 0) + 
                            (securityStats.bansApplied || 0) + 
                            (securityStats.timeoutsApplied || 0);
        
        if (totalActions > 0) {
            embed.addFields({
                name: '🔨 Acciones de Moderación',
                value: `**Kicks:** ${securityStats.kicksApplied || 0}\n**Bans:** ${securityStats.bansApplied || 0}\n**Timeouts:** ${securityStats.timeoutsApplied || 0}`,
                inline: true
            });
        }
        
        embed.addFields({
            name: '🤖 Bot Info',
            value: `**Uptime:** ${getUptime(client)}\n**Memoria:** ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n**Ping:** ${client.ws.ping}ms`,
            inline: false
        });

        embed.setTimestamp()
            .setFooter({ 
                text: `Ghostly Guard • ${client.guilds.cache.size.toLocaleString()} servidores protegidos`, 
                iconURL: client.user.displayAvatarURL() 
            });

        await interaction.reply({ embeds: [embed] });
    },
};

function getUptime(client) {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}
