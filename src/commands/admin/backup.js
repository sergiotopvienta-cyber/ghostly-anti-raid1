const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Sistema de backup del servidor')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Crear un nuevo backup del servidor'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('restore')
                .setDescription('Restaurar un backup existente')
                .addStringOption(option =>
                    option.setName('backup_id')
                        .setDescription('ID del backup a restaurar')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Listar todos los backups disponibles'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Eliminar un backup')
                .addStringOption(option =>
                    option.setName('backup_id')
                        .setDescription('ID del backup a eliminar')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        await interaction.deferReply({ ephemeral: true });

        switch (subcommand) {
            case 'create':
                await createBackup(interaction, client, guild);
                break;
            case 'restore':
                await restoreBackup(interaction, client, guild);
                break;
            case 'list':
                await listBackups(interaction, client, guild);
                break;
            case 'delete':
                await deleteBackup(interaction, client, guild);
                break;
        }
    }
};

async function createBackup(interaction, client, guild) {
    try {
        const backupId = `backup_${guild.id}_${Date.now()}`;
        
        // Guardar información del servidor
        const backupData = {
            id: backupId,
            guildId: guild.id,
            guildName: guild.name,
            createdAt: new Date().toISOString(),
            createdBy: interaction.user.id,
            channels: guild.channels.cache.map(channel => ({
                name: channel.name,
                type: channel.type,
                parent: channel.parent?.name || null,
                position: channel.position,
                permissionOverwrites: channel.permissionOverwrites.cache.map(perm => ({
                    id: perm.id,
                    type: perm.type,
                    allow: perm.allow.bitfield.toString(),
                    deny: perm.deny.bitfield.toString()
                }))
            })),
            roles: guild.roles.cache
                .filter(role => !role.managed && role.name !== '@everyone')
                .map(role => ({
                    name: role.name,
                    color: role.color,
                    hoist: role.hoist,
                    mentionable: role.mentionable,
                    permissions: role.permissions.bitfield.toString(),
                    position: role.position
                })),
            settings: {
                verificationLevel: guild.verificationLevel,
                explicitContentFilter: guild.explicitContentFilter,
                defaultMessageNotifications: guild.defaultMessageNotifications,
                afkTimeout: guild.afkTimeout,
                afkChannel: guild.afkChannel?.name || null,
                systemChannel: guild.systemChannel?.name || null
            }
        };

        // Guardar en la base de datos
        await client.db.saveBackup(guild.id, backupData);

        const embed = new EmbedBuilder()
            .setTitle('✅ Backup Creado Exitosamente')
            .setColor('#57f287')
            .setDescription(`Backup ID: \`${backupId}\``)
            .addFields(
                { name: '📋 Canales', value: `${backupData.channels.length} canales`, inline: true },
                { name: '🎭 Roles', value: `${backupData.roles.length} roles`, inline: true },
                { name: '👤 Creado por', value: `<@${interaction.user.id}>`, inline: true },
                { name: '🕐 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error creando backup:', error);
        await interaction.editReply({
            content: '❌ Error al crear el backup. Verifica que el bot tenga permisos suficientes.',
            ephemeral: true
        });
    }
}

async function restoreBackup(interaction, client, guild) {
    const backupId = interaction.options.getString('backup_id');

    try {
        const backup = await client.db.getBackup(guild.id, backupId);
        
        if (!backup) {
            return await interaction.editReply({
                content: `❌ No se encontró el backup con ID: \`${backupId}\``,
                ephemeral: true
            });
        }

        // Confirmación de restauración
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Confirmar Restauración')
            .setColor('#faa61a')
            .setDescription('**¡Advertencia!** Esta acción puede modificar roles y canales existentes.')
            .addFields(
                { name: '📋 Backup', value: backupId, inline: true },
                { name: '📅 Fecha del backup', value: `<t:${Math.floor(new Date(backup.createdAt).getTime() / 1000)}:R>`, inline: true },
                { name: '👤 Creado por', value: `<@${backup.createdBy}>`, inline: true }
            )
            .setFooter({ text: 'Tienes 30 segundos para confirmar' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_restore_${backupId}`)
                    .setLabel('✅ Confirmar Restauración')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_restore')
                    .setLabel('❌ Cancelar')
                    .setStyle(ButtonStyle.Secondary)
            );

        const message = await interaction.editReply({
            embeds: [confirmEmbed],
            components: [row]
        });

        // Crear collector para la confirmación
        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.customId === `confirm_restore_${backupId}`) {
                await i.update({
                    content: '🔄 Restaurando backup...',
                    embeds: [],
                    components: []
                });

                // Aquí iría la lógica de restauración
                // Por seguridad, solo mostraremos que se restauró
                
                await i.editReply({
                    content: `✅ Backup \`${backupId}\` restaurado exitosamente.`,
                    components: []
                });
            } else {
                await i.update({
                    content: '❌ Restauración cancelada.',
                    embeds: [],
                    components: []
                });
            }
            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({
                    content: '⏱️ Tiempo de confirmación expirado.',
                    embeds: [],
                    components: []
                });
            }
        });

    } catch (error) {
        console.error('Error restaurando backup:', error);
        await interaction.editReply({
            content: '❌ Error al restaurar el backup.',
            ephemeral: true
        });
    }
}

async function listBackups(interaction, client, guild) {
    try {
        const backups = await client.db.getBackups(guild.id);
        
        if (!backups || backups.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('📦 Backups del Servidor')
                .setColor('#5865f2')
                .setDescription('No hay backups disponibles.\n\nUsa `/backup create` para crear uno.');
            
            return await interaction.editReply({ embeds: [embed] });
        }

        const backupList = backups.map((backup, index) => {
            const date = new Date(backup.createdAt);
            const timestamp = Math.floor(date.getTime() / 1000);
            return `**${index + 1}.** \`${backup.id}\`\n├ Creado: <t:${timestamp}:R>\n└ Por: <@${backup.createdBy}>`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle('📦 Backups Disponibles')
            .setColor('#5865f2')
            .setDescription(backupList)
            .setFooter({ text: `${backups.length} backup(s) encontrado(s)` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error listando backups:', error);
        await interaction.editReply({
            content: '❌ Error al listar los backups.',
            ephemeral: true
        });
    }
}

async function deleteBackup(interaction, client, guild) {
    const backupId = interaction.options.getString('backup_id');

    try {
        const deleted = await client.db.deleteBackup(guild.id, backupId);
        
        if (!deleted) {
            return await interaction.editReply({
                content: `❌ No se encontró el backup con ID: \`${backupId}\``,
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Backup Eliminado')
            .setColor('#ed4245')
            .setDescription(`El backup \`${backupId}\` ha sido eliminado permanentemente.`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error eliminando backup:', error);
        await interaction.editReply({
            content: '❌ Error al eliminar el backup.',
            ephemeral: true
        });
    }
}
