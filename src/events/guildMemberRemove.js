const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member, client) {
        const settings = await client.db.getGuildSettings(member.guild.id);
        
        if (!settings.log_channel) return;
        
        const logChannel = member.guild.channels.cache.get(settings.log_channel);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('Miembro Abandonó')
            .setColor('#ff9900')
            .setDescription(`${member.user.tag} ha abandonado el servidor`)
            .addFields(
                { name: 'ID de Usuario', value: member.id, inline: true },
                { name: 'Tiempo en el servidor', value: getDuration(member.joinedAt), inline: true },
                { name: 'Total de miembros', value: member.guild.memberCount.toString(), inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        try {
            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error al enviar log de miembro abandonando:', error);
        }
    },
};

function getDuration(joinDate) {
    const now = new Date();
    const joined = new Date(joinDate);
    const duration = now - joined;
    
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
        return `${days} día${days !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
        return `${hours} hora${hours !== 1 ? 's' : ''}`;
    } else {
        return 'Menos de 1 hora';
    }
}
