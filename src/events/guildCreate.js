const { Events, EmbedBuilder } = require('discord.js');
const { createGuildBackup } = require('../utils/security');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild, client) {
        console.log(`Bot anadido al servidor: ${guild.name} (${guild.id})`);

        try {
            await client.db.ensureGuildSettings(guild.id);
            await createGuildBackup(client, guild, 'initial', client.user.id);
        } catch (error) {
            console.error('Error al preparar configuracion inicial:', error);
        }

        const owner = await guild.fetchOwner();
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('Ghostly Guard esta listo')
            .setColor('#57f287')
            .setDescription('Gracias por anadir Ghostly Guard. Ya puedes empezar a configurar la seguridad.')
            .addFields(
                { name: 'Comandos base', value: '`/setup`, `/settings`, `/security`' },
                { name: 'Recomendado', value: 'Configura un canal de logs y otro de alertas antes de ponerlo en produccion.' }
            )
            .setTimestamp();

        try {
            await owner.send({ embeds: [welcomeEmbed] });
        } catch (error) {
            console.log('No se pudo enviar DM al owner del servidor.');
        }
    }
};
