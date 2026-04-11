const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Muestra la configuracion actual del bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        const settings = await client.db.getGuildSettings(interaction.guild.id);
        const recentEvents = await client.db.getRecentSecurityEvents(interaction.guild.id, 5);

        const embed = new EmbedBuilder()
            .setTitle('Configuracion de Ghostly Guard')
            .setColor('#5865f2')
            .setDescription('Estado actual de proteccion y monitoreo.')
            .addFields(
                { name: 'Anti-Raid', value: settings.anti_raid ? 'Activado' : 'Desactivado', inline: true },
                { name: 'Anti-Nuke', value: settings.anti_nuke ? 'Activado' : 'Desactivado', inline: true },
                { name: 'Lockdown', value: settings.lockdown_active ? 'Activo' : 'Inactivo', inline: true },
                { name: 'Anti-Flood', value: settings.anti_flood ? 'Activado' : 'Desactivado', inline: true },
                { name: 'Anti-Bots', value: settings.anti_bots ? 'Activado' : 'Desactivado', inline: true },
                { name: 'Solo bots verificados', value: settings.anti_bot_verified_only ? 'Si' : 'No', inline: true },
                { name: 'Edad minima cuenta', value: `${settings.min_account_age_days} dias`, inline: true },
                { name: 'Max joins/minuto', value: `${settings.max_joins_per_minute}`, inline: true },
                { name: 'Max mensajes/segundo', value: `${settings.max_messages_per_second}`, inline: true },
                { name: 'Canal logs', value: settings.log_channel ? `<#${settings.log_channel}>` : 'No configurado', inline: true },
                { name: 'Canal alertas', value: settings.alert_channel ? `<#${settings.alert_channel}>` : 'No configurado', inline: true },
                { name: 'Rol verificacion', value: settings.verification_role ? `<@&${settings.verification_role}>` : 'No configurado', inline: true },
                { name: 'Whitelist', value: `${(await client.db.listTrustedUsers(interaction.guild.id, 'whitelist')).length} usuarios`, inline: true },
                { name: 'Owners extra', value: `${(await client.db.listTrustedUsers(interaction.guild.id, 'owner')).length} usuarios`, inline: true },
                { name: 'Bots autorizados', value: `${(await client.db.listTrustedUsers(interaction.guild.id, 'bot')).length} bots`, inline: true },
                { name: 'Bans permanentes', value: `${(await client.db.listPermanentBans(interaction.guild.id)).length} ids`, inline: true },
                {
                    name: 'Ultimos incidentes',
                    value: recentEvents.length
                        ? recentEvents.map((event) => `• ${event.type} (${event.severity})`).join('\n')
                        : 'Sin incidentes recientes',
                    inline: false
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
