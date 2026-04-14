const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createGuildBackup } = require('../utils/security');
const i18n = require('../utils/i18n');

module.exports = {
    name: Events.GuildCreate,
    async execute(guild, client) {
        console.log(`🛡️ Bot añadido al servidor: ${guild.name} (${guild.id})`);

        try {
            await client.db.ensureGuildSettings(guild.id);
            await createGuildBackup(client, guild, 'initial', client.user.id);
        } catch (error) {
            console.error('Error al preparar configuración inicial:', error);
        }

        try {
            const owner = await guild.fetchOwner();
            
            // Embed de bienvenida con selección de idioma
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('🛡️ ¡Ghostly Guard ha llegado!')
                .setColor('#f1c40f')
                .setDescription(
                    '**¡Gracias por añadirme a tu servidor!**\n\n' +
                    'Estoy aquí para proteger tu comunidad las 24 horas del día, los 7 días de la semana.'
                )
                .addFields(
                    {
                        name: '🌍 Selecciona tu idioma / Select your language',
                        value: 'Por favor, elige el idioma en el que trabajaré en este servidor.\n' +
                               'Please choose the language I will work in on this server.'
                    },
                    {
                        name: '🛡️ Mis funciones principales',
                        value: '• **Anti-Raid**: Detecto y bloqueo raids masivos\n' +
                               '• **Anti-Nuke**: Protejo contra destrucción del servidor\n' +
                               '• **Anti-Spam**: Filtro mensajes sospechosos\n' +
                               '• **Anti-Bots**: Bloqueo bots no autorizados\n' +
                               '• **Backups**: Creo copias de seguridad automáticas\n' +
                               '• **Logs**: Registro todas las actividades de seguridad'
                    },
                    {
                        name: '⚙️ Configuración rápida',
                        value: 'Una vez seleccionado el idioma, usa estos comandos:\n' +
                               '`/config server` - Ver configuración actual\n' +
                               '`/alerts channel` - Configurar canal de alertas\n' +
                               '`/securityscan` - Analizar seguridad del servidor'
                    }
                )
                .setFooter({
                    text: `ID del servidor: ${guild.id} • Ghostly Guard Protección`,
                    iconURL: client.user.displayAvatarURL()
                })
                .setTimestamp();

            // Botones de selección de idioma
            const languageRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`setlang_${guild.id}_es`)
                        .setLabel('🇪🇸 Español')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`setlang_${guild.id}_en`)
                        .setLabel('🇺🇸 English')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setURL('https://discord.gg/FcbH8m4D')
                        .setLabel('💬 Soporte Discord')
                        .setStyle(ButtonStyle.Link)
                );

            // Enviar DM al owner
            await owner.send({
                embeds: [welcomeEmbed],
                components: [languageRow]
            });

            console.log(`✅ Mensaje de bienvenida enviado al owner de ${guild.name}`);

        } catch (error) {
            console.log(`⚠️ No se pudo enviar DM al owner de ${guild.name}:`, error.message);
            
            // Intentar enviar mensaje en el primer canal de texto disponible
            try {
                const systemChannel = guild.systemChannel || 
                    guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(guild.members.me).has('SendMessages'));
                
                if (systemChannel) {
                    const fallbackEmbed = new EmbedBuilder()
                        .setTitle('🛡️ Ghostly Guard está listo')
                        .setColor('#f1c40f')
                        .setDescription(
                            '¡Gracias por añadirme! Para configurar el idioma y ver las opciones, ' +
                            'el owner del servidor debe revisar sus mensajes privados.'
                        )
                        .addFields(
                            {
                                name: '⚙️ Comandos principales',
                                value: '`/config server` - Ver configuración\n' +
                                       '`/securityscan` - Analizar seguridad\n' +
                                       '`/alerts channel` - Configurar alertas'
                            }
                        )
                        .setFooter({ text: 'Ghostly Guard Protección' })
                        .setTimestamp();

                    await systemChannel.send({ embeds: [fallbackEmbed] });
                }
            } catch (channelError) {
                console.log('No se pudo enviar mensaje en ningún canal.');
            }
        }
    }
};
