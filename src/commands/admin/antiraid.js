const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Activa o desactiva el sistema anti-raid')
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Activa el sistema anti-raid')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Desactiva el sistema anti-raid')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('Configura los parámetros anti-raid')
                .addIntegerOption(option =>
                    option
                        .setName('max_joins')
                        .setDescription('Máximo de joins por minuto')
                        .setMinValue(1)
                        .setMaxValue(50)
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option
                        .setName('min_account_age')
                        .setDescription('Edad mínima de cuenta en días')
                        .setMinValue(0)
                        .setMaxValue(365)
                        .setRequired(false)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const settings = await client.db.getGuildSettings(interaction.guild.id);
        
        switch (subcommand) {
            case 'enable':
                await enableAntiRaid(interaction, client, settings);
                break;
            case 'disable':
                await disableAntiRaid(interaction, client, settings);
                break;
            case 'config':
                await configAntiRaid(interaction, client, settings);
                break;
        }
    },
};

async function enableAntiRaid(interaction, client, settings) {
    try {
        await client.db.updateGuildSettings(interaction.guild.id, { anti_raid: 1 });
        
        const embed = new EmbedBuilder()
            .setTitle('Anti-Raid Activado')
            .setColor('#00ff00')
            .setDescription('El sistema anti-raid ha sido activado')
            .addFields(
                { name: 'Estado', value: 'Activado', inline: true },
                { name: 'Máximo joins/minuto', value: settings.max_joins_per_minute.toString(), inline: true },
                { name: 'Edad mínima cuenta', value: `${settings.min_account_age_days} días`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Anti-Raid - Protección activa' });

        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error al activar anti-raid:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ff0000')
            .setDescription('Hubo un error al activar el sistema anti-raid')
            .setTimestamp();

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

async function disableAntiRaid(interaction, client, settings) {
    try {
        await client.db.updateGuildSettings(interaction.guild.id, { anti_raid: 0 });
        
        const embed = new EmbedBuilder()
            .setTitle('Anti-Raid Desactivado')
            .setColor('#ff9900')
            .setDescription('El sistema anti-raid ha sido desactivado')
            .addFields(
                { name: 'Estado', value: 'Desactivado', inline: true },
                { name: 'Advertencia', value: 'El servidor ya no está protegido contra raids', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Anti-Raid - Protección desactivada' });

        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error al desactivar anti-raid:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ff0000')
            .setDescription('Hubo un error al desactivar el sistema anti-raid')
            .setTimestamp();

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

async function configAntiRaid(interaction, client, settings) {
    const maxJoins = interaction.options.getInteger('max_joins');
    const minAccountAge = interaction.options.getInteger('min_account_age');
    
    const updates = {};
    
    if (maxJoins !== null) {
        updates.max_joins_per_minute = maxJoins;
    }
    
    if (minAccountAge !== null) {
        updates.min_account_age_days = minAccountAge;
    }
    
    if (Object.keys(updates).length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('Configuración Anti-Raid')
            .setColor('#0099ff')
            .setDescription('Configuración actual del sistema anti-raid')
            .addFields(
                { name: 'Estado', value: settings.anti_raid ? 'Activado' : 'Desactivado', inline: true },
                { name: 'Máximo joins/minuto', value: settings.max_joins_per_minute.toString(), inline: true },
                { name: 'Edad mínima cuenta', value: `${settings.min_account_age_days} días`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Anti-Raid - Configuración' });

        return interaction.reply({ embeds: [embed] });
    }
    
    try {
        await client.db.updateGuildSettings(interaction.guild.id, updates);
        
        const embed = new EmbedBuilder()
            .setTitle('Configuración Anti-Raid Actualizada')
            .setColor('#00ff00')
            .setDescription('Los parámetros anti-raid han sido actualizados')
            .addFields(
                { name: 'Máximo joins/minuto', value: updates.max_joins_per_minute?.toString() || settings.max_joins_per_minute.toString(), inline: true },
                { name: 'Edad mínima cuenta', value: updates.min_account_age_days ? `${updates.min_account_age_days} días` : `${settings.min_account_age_days} días`, inline: true },
                { name: 'Estado', value: settings.anti_raid ? 'Activado' : 'Desactivado', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Anti-Raid - Configuración actualizada' });

        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error al configurar anti-raid:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ff0000')
            .setDescription('Hubo un error al actualizar la configuración anti-raid')
            .setTimestamp();

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}
