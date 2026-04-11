const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configura los canales principales del bot')
        .addChannelOption((option) =>
            option
                .setName('log_channel')
                .setDescription('Canal para logs de seguridad')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addChannelOption((option) =>
            option
                .setName('welcome_channel')
                .setDescription('Canal para mensajes de bienvenida')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addChannelOption((option) =>
            option
                .setName('alert_channel')
                .setDescription('Canal para alertas criticas')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addRoleOption((option) =>
            option
                .setName('verification_role')
                .setDescription('Rol para miembros verificados')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        const logChannel = interaction.options.getChannel('log_channel');
        const welcomeChannel = interaction.options.getChannel('welcome_channel');
        const alertChannel = interaction.options.getChannel('alert_channel');
        const verificationRole = interaction.options.getRole('verification_role');
        const settings = await client.db.getGuildSettings(interaction.guild.id);

        const updates = {};

        if (logChannel) updates.log_channel = logChannel.id;
        if (welcomeChannel) updates.welcome_channel = welcomeChannel.id;
        if (alertChannel) updates.alert_channel = alertChannel.id;
        if (verificationRole) updates.verification_role = verificationRole.id;

        if (Object.keys(updates).length > 0) {
            await client.db.updateGuildSettings(interaction.guild.id, updates);
        }

        const refreshed = await client.db.getGuildSettings(interaction.guild.id);
        const embed = new EmbedBuilder()
            .setTitle(Object.keys(updates).length ? 'Configuracion actualizada' : 'Configuracion actual')
            .setColor(Object.keys(updates).length ? '#57f287' : '#5865f2')
            .setDescription('Canales y roles principales de Ghostly Guard.')
            .addFields(
                { name: 'Canal de logs', value: refreshed.log_channel ? `<#${refreshed.log_channel}>` : 'No configurado', inline: true },
                { name: 'Canal de bienvenida', value: refreshed.welcome_channel ? `<#${refreshed.welcome_channel}>` : 'No configurado', inline: true },
                { name: 'Canal de alertas', value: refreshed.alert_channel ? `<#${refreshed.alert_channel}>` : 'No configurado', inline: true },
                { name: 'Rol de verificacion', value: refreshed.verification_role ? `<@&${refreshed.verification_role}>` : 'No configurado', inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
