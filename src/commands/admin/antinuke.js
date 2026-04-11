const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antinuke')
        .setDescription('Activa o desactiva el sistema anti-nuke')
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Activa el sistema anti-nuke')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Desactiva el sistema anti-nuke')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const settings = await client.db.getGuildSettings(interaction.guild.id);
        
        switch (subcommand) {
            case 'enable':
                await enableAntiNuke(interaction, client, settings);
                break;
            case 'disable':
                await disableAntiNuke(interaction, client, settings);
                break;
        }
    },
};

async function enableAntiNuke(interaction, client, settings) {
    try {
        await client.db.updateGuildSettings(interaction.guild.id, { anti_nuke: 1 });
        
        const embed = new EmbedBuilder()
            .setTitle('Anti-Nuke Activado')
            .setColor('#00ff00')
            .setDescription('El sistema anti-nuke ha sido activado')
            .addFields(
                { name: 'Protecciones activas', value: 'Anti-ban masivo\nAnti-kick masivo\nAnti-eliminación de roles\nAnti-eliminación de canales\nAnti-cambio masivo de roles', inline: false },
                { name: 'Estado', value: 'Activado', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Anti-Raid - Protección anti-nuke activa' });

        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error al activar anti-nuke:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor(0xff0000)
            .setDescription('Hubo un error al activar el sistema anti-nuke')
            .setTimestamp();

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

async function disableAntiNuke(interaction, client, settings) {
    try {
        await client.db.updateGuildSettings(interaction.guild.id, { anti_nuke: 0 });
        
        const embed = new EmbedBuilder()
            .setTitle('Anti-Nuke Desactivado')
            .setColor('#ff9900')
            .setDescription('El sistema anti-nuke ha sido desactivado')
            .addFields(
                { name: 'Estado', value: 'Desactivado', inline: true },
                { name: 'Advertencia', value: 'El servidor ya no está protegido contra ataques nuke', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Anti-Raid - Protección anti-nuke desactivada' });

        await interaction.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error al desactivar anti-nuke:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor(0xff0000)
            .setDescription('Hubo un error al desactivar el sistema anti-nuke')
            .setTimestamp();

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}
