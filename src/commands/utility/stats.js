const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Muestra estadísticas del servidor y del bot'),
        
    async execute(interaction, client) {
        const guild = interaction.guild;
        
        const totalMembers = guild.memberCount;
        const humans = guild.members.cache.filter(member => !member.user.bot).size;
        const bots = guild.members.cache.filter(member => member.user.bot).size;
        const channels = guild.channels.cache.size;
        const textChannels = guild.channels.cache.filter(c => c.type === 'GUILD_TEXT').size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 'GUILD_VOICE').size;
        const roles = guild.roles.cache.size;
        
        const embed = new EmbedBuilder()
            .setTitle('Estadísticas del Servidor')
            .setColor('#0099ff')
            .setDescription('Estadísticas detalladas del servidor y del bot')
            .addFields(
                { 
                    name: 'Información del Servidor', 
                    value: `**Nombre:** ${guild.name}\n**ID:** ${guild.id}\n**Creado:** ${moment(guild.createdTimestamp).format('DD/MM/YYYY')}\n**Dueño:** <@${guild.ownerId}>`, 
                    inline: false 
                },
                { 
                    name: 'Miembros', 
                    value: `**Total:** ${totalMembers}\n**Humanos:** ${humans}\n**Bots:** ${bots}\n**Ratio:** ${((humans/totalMembers)*100).toFixed(1)}% humanos`, 
                    inline: true 
                },
                { 
                    name: 'Canales', 
                    value: `**Total:** ${channels}\n**Texto:** ${textChannels}\n**Voz:** ${voiceChannels}`, 
                    inline: true 
                },
                { 
                    name: 'Otros', 
                    value: `**Roles:** ${roles}\n**Emojis:** ${guild.emojis.cache.size}\n**Boosts:** ${guild.premiumSubscriptionCount || 0}`, 
                    inline: true 
                },
                { 
                    name: 'Bot', 
                    value: `**Uptime:** ${getUptime(client)}\n**Memoria:** ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n**Servidores:** ${client.guilds.cache.size}`, 
                    inline: false 
                }
            )
            .setThumbnail(guild.iconURL())
            .setTimestamp()
            .setFooter({ text: 'Ghostly Anti-Raid - Estadísticas' });

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
