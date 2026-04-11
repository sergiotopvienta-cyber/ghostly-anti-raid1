const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Muestra la latencia del bot'),
        
    async execute(interaction, client) {
        const sent = await interaction.reply({ 
            content: 'Calculando ping...', 
            fetchReply: true 
        });

        const timeDiff = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);

        const embed = new EmbedBuilder()
            .setTitle('Pong! - Latencia del Bot')
            .setColor('#00ff00')
            .setDescription('Estadísticas de rendimiento del bot')
            .addFields(
                { 
                    name: 'Latencia del Bot', 
                    value: `${timeDiff}ms`, 
                    inline: true 
                },
                { 
                    name: 'Latencia de la API', 
                    value: `${apiLatency}ms`, 
                    inline: true 
                },
                { 
                    name: 'Estado', 
                    value: timeDiff < 100 ? 'Excelente' : timeDiff < 200 ? 'Bueno' : 'Regular', 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Anti-Raid - Estado del sistema' });

        await interaction.editReply({ embeds: [embed] });
    },
};
