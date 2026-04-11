const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild, client) {
        console.log(`Bot añadido al servidor: ${guild.name} (ID: ${guild.id})`);
        
        try {
            await client.db.createGuildSettings(guild.id);
            console.log(`Configuración por defecto creada para ${guild.name}`);
        } catch (error) {
            console.error('Error al crear configuración del servidor:', error);
        }

        const owner = await guild.fetchOwner();
        
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('¡Ghostly Anti-Raid está listo!')
            .setColor('#00ff00')
            .setDescription('Gracias por añadir Ghostly Anti-Raid a tu servidor. Estoy aquí para proteger tu comunidad.')
            .addFields(
                { name: 'Configuración Rápida', value: 'Usa `/setup` para configurar los canales de logs y verificación' },
                { name: 'Comandos Principales', value: '```/settings - Ver configuración\n/antiraid - Activar/desactivar anti-raid\n/antinuke - Activar/desactivar anti-nuke```' },
                { name: 'Soporte', value: '¿Necesitas ayuda? Únete a nuestro servidor de soporte' }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Anti-Raid - Protección 24/7' });

        try {
            await owner.send({ embeds: [welcomeEmbed] });
        } catch (error) {
            console.log('No se pudo enviar mensaje DM al owner del servidor');
        }
    },
};
