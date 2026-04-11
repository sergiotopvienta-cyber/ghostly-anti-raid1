const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Muestra la configuración actual del bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction, client) {
        const settings = await client.db.getGuildSettings(interaction.guild.id);
        
        const embed = new EmbedBuilder()
            .setTitle('Configuración de Ghostly Anti-Raid')
            .setColor('#0099ff')
            .setDescription('Configuración actual de protección del servidor')
            .addFields(
                { 
                    name: 'Anti-Raid', 
                    value: settings.anti_raid ? 'Activado' : 'Desactivado', 
                    inline: true 
                },
                { 
                    name: 'Anti-Nuke', 
                    value: settings.anti_nuke ? 'Activado' : 'Desactivado', 
                    inline: true 
                },
                { 
                    name: 'Anti-Flood', 
                    value: settings.anti_flood ? 'Activado' : 'Desactivado', 
                    inline: true 
                },
                { 
                    name: 'Anti-Bots', 
                    value: settings.anti_bots ? 'Activado' : 'Desactivado', 
                    inline: true 
                },
                { 
                    name: 'Anti-Alts', 
                    value: settings.anti_alts ? 'Activado' : 'Desactivado', 
                    inline: true 
                },
                { 
                    name: 'Anti-Links', 
                    value: settings.anti_links ? 'Activado' : 'Desactivado', 
                    inline: true 
                },
                { 
                    name: 'Anti-Menciones', 
                    value: settings.anti_mentions ? 'Activado' : 'Desactivado', 
                    inline: true 
                },
                { 
                    name: 'Máximo joins/minuto', 
                    value: settings.max_joins_per_minute.toString(), 
                    inline: true 
                },
                { 
                    name: 'Máximo mensajes/segundo', 
                    value: settings.max_messages_per_second.toString(), 
                    inline: true 
                },
                { 
                    name: 'Máximo menciones/mensaje', 
                    value: settings.max_mentions_per_message.toString(), 
                    inline: true 
                },
                { 
                    name: 'Edad mínima cuenta (días)', 
                    value: settings.min_account_age_days.toString(), 
                    inline: true 
                },
                { 
                    name: 'Canal de Logs', 
                    value: settings.log_channel ? `<#${settings.log_channel}>` : 'No configurado', 
                    inline: true 
                },
                { 
                    name: 'Rol de Verificación', 
                    value: settings.verification_role ? `<@&${settings.verification_role}>` : 'No configurado', 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Anti-Raid - Configuración' });

        await interaction.reply({ embeds: [embed] });
    },
};
