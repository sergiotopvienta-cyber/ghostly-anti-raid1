const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alerts')
        .setDescription('Configurar sistema de alertas de seguridad')
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Establecer canal de alertas')
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('Canal donde se enviarán las alertas')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Enviar alerta de prueba'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Activar/desactivar tipos de alertas')
                .addStringOption(option =>
                    option.setName('tipo')
                        .setDescription('Tipo de alerta')
                        .setRequired(true)
                        .addChoices(
                            { name: '🚨 Raid Detectado', value: 'raid' },
                            { name: '🔒 Nuke Intentado', value: 'nuke' },
                            { name: '🤖 Bot No Autorizado', value: 'bot' },
                            { name: '🔗 Link Bloqueado', value: 'link' },
                            { name: '⚡ Spam Detectado', value: 'spam' },
                            { name: '👤 Alt Account', value: 'alt' },
                            { name: '🚫 Ban Aplicado', value: 'ban' },
                            { name: '📝 Todos los Eventos', value: 'all' }
                        ))
                .addBooleanOption(option =>
                    option.setName('activar')
                        .setDescription('Activar o desactivar esta alerta')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Ver configuración actual de alertas'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        await interaction.deferReply({ ephemeral: true });

        switch (subcommand) {
            case 'channel':
                await setAlertChannel(interaction, client, guild);
                break;
            case 'test':
                await testAlert(interaction, client, guild);
                break;
            case 'toggle':
                await toggleAlert(interaction, client, guild);
                break;
            case 'status':
                await showAlertStatus(interaction, client, guild);
                break;
        }
    }
};

async function setAlertChannel(interaction, client, guild) {
    const channel = interaction.options.getChannel('canal');

    try {
        // Verificar permisos del bot en el canal
        const botMember = guild.members.cache.get(client.user.id);
        const botPermissions = channel.permissionsFor(botMember);

        if (!botPermissions.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
            return await interaction.editReply({
                content: `❌ No tengo permisos suficientes en ${channel}. Necesito: Ver Canal, Enviar Mensajes, Insertar Enlaces.`,
                ephemeral: true
            });
        }

        // Guardar en base de datos
        await client.db.updateGuildSettings(guild.id, { 
            alerts_channel: channel.id,
            alerts_enabled: 1 
        });

        const embed = new EmbedBuilder()
            .setTitle('✅ Canal de Alertas Configurado')
            .setColor('#57f287')
            .setDescription(`Las alertas de seguridad se enviarán a ${channel}`)
            .addFields(
                { name: '📢 Canal', value: `${channel} (\`${channel.id}\`)`, inline: true },
                { name: '✨ Estado', value: 'Activado', inline: true },
                { name: '💡 Próximo paso', value: 'Usa `/alerts test` para verificar la configuración' }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Enviar mensaje de confirmación al canal
        const confirmEmbed = new EmbedBuilder()
            .setTitle('🛡️ Ghostly Guard - Canal de Alertas')
            .setColor('#5865f2')
            .setDescription('Este canal ha sido configurado para recibir alertas de seguridad.')
            .addFields(
                { name: '⚙️ Configurado por', value: `<@${interaction.user.id}>`, inline: true },
                { name: '🕐 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            );

        await channel.send({ embeds: [confirmEmbed] }).catch(() => null);

    } catch (error) {
        console.error('Error configurando canal de alertas:', error);
        await interaction.editReply({
            content: '❌ Error al configurar el canal de alertas.',
            ephemeral: true
        });
    }
}

async function testAlert(interaction, client, guild) {
    try {
        const settings = await client.db.getGuildSettings(guild.id);
        
        if (!settings.alerts_channel) {
            return await interaction.editReply({
                content: '❌ No hay un canal de alertas configurado. Usa `/alerts channel` primero.',
                ephemeral: true
            });
        }

        const channel = guild.channels.cache.get(settings.alerts_channel);
        if (!channel) {
            return await interaction.editReply({
                content: '❌ El canal de alertas configurado ya no existe. Por favor configura uno nuevo.',
                ephemeral: true
            });
        }

        // Enviar alerta de prueba
        const testEmbed = new EmbedBuilder()
            .setTitle('🧪 Alerta de Prueba')
            .setColor('#f1c40f')
            .setDescription('Esta es una alerta de prueba del sistema Ghostly Guard.')
            .addFields(
                { name: '👤 Enviada por', value: `<@${interaction.user.id}>`, inline: true },
                { name: '🕐 Hora', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: '✅ Estado', value: 'Sistema funcionando correctamente' }
            )
            .setFooter({ text: 'Ghostly Guard - Sistema de Alertas' })
            .setTimestamp();

        await channel.send({ embeds: [testEmbed] });

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Alerta de Prueba Enviada')
            .setColor('#57f287')
            .setDescription(`La alerta de prueba se envió exitosamente a ${channel}`)
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
        console.error('Error enviando alerta de prueba:', error);
        await interaction.editReply({
            content: '❌ Error al enviar la alerta de prueba. Verifica los permisos del bot.',
            ephemeral: true
        });
    }
}

async function toggleAlert(interaction, client, guild) {
    const alertType = interaction.options.getString('tipo');
    const enabled = interaction.options.getBoolean('activar');

    try {
        const alertTypes = {
            raid: '🚨 Raid Detectado',
            nuke: '🔒 Nuke Intentado',
            bot: '🤖 Bot No Autorizado',
            link: '🔗 Link Bloqueado',
            spam: '⚡ Spam Detectado',
            alt: '👤 Alt Account',
            ban: '🚫 Ban Aplicado',
            all: '📝 Todos los Eventos'
        };

        if (alertType === 'all') {
            // Activar/desactivar todas
            const alertConfig = {};
            Object.keys(alertTypes).forEach(type => {
                if (type !== 'all') {
                    alertConfig[`alert_${type}`] = enabled ? 1 : 0;
                }
            });
            
            await client.db.updateGuildSettings(guild.id, alertConfig);

            const embed = new EmbedBuilder()
                .setTitle(enabled ? '✅ Todas las Alertas Activadas' : '🚫 Todas las Alertas Desactivadas')
                .setColor(enabled ? '#57f287' : '#ed4245')
                .setDescription(`Se han ${enabled ? 'activado' : 'desactivado'} todas las alertas de seguridad.`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else {
            // Activar/desactivar específica
            await client.db.updateGuildSettings(guild.id, { 
                [`alert_${alertType}`]: enabled ? 1 : 0 
            });

            const embed = new EmbedBuilder()
                .setTitle(enabled ? '✅ Alerta Activada' : '🚫 Alerta Desactivada')
                .setColor(enabled ? '#57f287' : '#ed4245')
                .setDescription(`**${alertTypes[alertType]}** ha sido ${enabled ? 'activada' : 'desactivada'}.`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error cambiando configuración de alertas:', error);
        await interaction.editReply({
            content: '❌ Error al actualizar la configuración de alertas.',
            ephemeral: true
        });
    }
}

async function showAlertStatus(interaction, client, guild) {
    try {
        const settings = await client.db.getGuildSettings(guild.id);
        
        const alertChannel = settings.alerts_channel 
            ? guild.channels.cache.get(settings.alerts_channel) 
            : null;

        const alertTypes = {
            raid: { name: '🚨 Raid Detectado', enabled: settings.alert_raid !== 0 },
            nuke: { name: '🔒 Nuke Intentado', enabled: settings.alert_nuke !== 0 },
            bot: { name: '🤖 Bot No Autorizado', enabled: settings.alert_bot !== 0 },
            link: { name: '🔗 Link Bloqueado', enabled: settings.alert_link !== 0 },
            spam: { name: '⚡ Spam Detectado', enabled: settings.alert_spam !== 0 },
            alt: { name: '👤 Alt Account', enabled: settings.alert_alt !== 0 },
            ban: { name: '🚫 Ban Aplicado', enabled: settings.alert_ban !== 0 }
        };

        const alertList = Object.entries(alertTypes)
            .map(([key, value]) => `${value.enabled ? '✅' : '❌'} ${value.name}`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle('📢 Configuración de Alertas')
            .setColor('#5865f2')
            .addFields(
                { 
                    name: '📋 Canal de Alertas', 
                    value: alertChannel ? `${alertChannel} (\`${alertChannel.id}\`)` : '❌ No configurado',
                    inline: false 
                },
                { 
                    name: '🔔 Tipos de Alertas', 
                    value: alertList || '❌ Ninguna alerta configurada',
                    inline: false 
                }
            )
            .setFooter({ text: 'Ghostly Guard - Sistema de Alertas' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error mostrando estado de alertas:', error);
        await interaction.editReply({
            content: '❌ Error al obtener la configuración de alertas.',
            ephemeral: true
        });
    }
}
