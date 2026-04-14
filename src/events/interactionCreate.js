const { Events, Collection, EmbedBuilder } = require('discord.js');
const i18n = require('../utils/i18n');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // Manejar botones de selección de idioma
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('setlang_')) {
                const parts = interaction.customId.split('_');
                const guildId = parts[1];
                const lang = parts[2];
                
                // Verificar que el usuario es el owner
                const guild = client.guilds.cache.get(guildId);
                if (!guild || guild.ownerId !== interaction.user.id) {
                    return interaction.reply({
                        content: '❌ Solo el owner del servidor puede cambiar el idioma.',
                        ephemeral: true
                    });
                }
                
                // Guardar idioma en la base de datos
                await client.db.setGuildLanguage(guildId, lang);
                i18n.setGuildLanguage(guildId, lang);
                
                // Actualizar mensaje con confirmación
                const confirmEmbed = new EmbedBuilder()
                    .setTitle(lang === 'es' ? '✅ Idioma actualizado' : '✅ Language updated')
                    .setColor('#57f287')
                    .setDescription(
                        lang === 'es' 
                            ? `El idioma del servidor ha sido establecido a **Español** 🇪🇸.\n\nAhora puedes usar el comando \`/config server\` para ver la configuración.`
                            : `Server language has been set to **English** 🇺🇸.\n\nYou can now use \`/config server\` to view the configuration.`
                    )
                    .setFooter({ text: 'Ghostly Guard' })
                    .setTimestamp();
                
                await interaction.update({ embeds: [confirmEmbed], components: [] });
                
                // Enviar mensaje adicional con instrucciones
                const instructionsEmbed = new EmbedBuilder()
                    .setTitle(lang === 'es' ? '⚙️ Próximos pasos' : '⚙️ Next steps')
                    .setColor('#f1c40f')
                    .addFields(
                        {
                            name: lang === 'es' ? '1️⃣ Configurar alertas' : '1️⃣ Configure alerts',
                            value: lang === 'es' 
                                ? 'Usa `/alerts channel` para establecer donde recibirás notificaciones de seguridad.'
                                : 'Use `/alerts channel` to set where you will receive security notifications.'
                        },
                        {
                            name: lang === 'es' ? '2️⃣ Escanear seguridad' : '2️⃣ Scan security',
                            value: lang === 'es'
                                ? 'Usa `/securityscan` para ver qué tan seguro está tu servidor.'
                                : 'Use `/securityscan` to see how secure your server is.'
                        },
                        {
                            name: lang === 'es' ? '3️⃣ Ver configuración' : '3️⃣ View configuration',
                            value: lang === 'es'
                                ? 'Usa `/config server` para ver todas las funciones activadas.'
                                : 'Use `/config server` to see all enabled features.'
                        }
                    )
                    .setFooter({ 
                        text: lang === 'es' ? '¿Necesitas ayuda? Únete al soporte' : 'Need help? Join support', 
                        iconURL: client.user.displayAvatarURL() 
                    });
                
                await interaction.followUp({ embeds: [instructionsEmbed], ephemeral: true });
                return;
            }
        }

        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No se encontró el comando: ${interaction.commandName}`);
            return;
        }

        const { cooldowns } = client;

        if (!cooldowns.has(command.data.name)) {
            cooldowns.set(command.data.name, new Collection());
        }

        const now = Date.now();
        const timestamps = cooldowns.get(command.data.name);
        const cooldownAmount = (command.cooldown || 3) * 1000;

        if (timestamps.has(interaction.user.id)) {
            const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

            if (now < expirationTime) {
                const expiredTimestamp = Math.round(expirationTime / 1000);
                return interaction.reply({
                    content: `Por favor espera, estás en cooldown para \`${command.data.name}\`. Puedes usarlo de nuevo <t:${expiredTimestamp}:R>.`,
                    ephemeral: true
                });
            }
        }

        timestamps.set(interaction.user.id, now);
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(error);
            const errorMessage = {
                content: 'Hubo un error al ejecutar este comando.',
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },
};
