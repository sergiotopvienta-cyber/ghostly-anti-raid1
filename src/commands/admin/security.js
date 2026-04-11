const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const {
    applyLockdown,
    createGuildBackup,
    createSecurityEvent
} = require('../../utils/security');

const TRUSTED_TYPES = {
    whitelist: 'whitelist',
    owner: 'owner',
    bot: 'bot'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('security')
        .setDescription('Administra whitelist, bans, lockdown, owners, bots y backups')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('whitelist-add')
                .setDescription('Agrega un usuario a la whitelist')
                .addUserOption((option) =>
                    option.setName('user').setDescription('Usuario a agregar').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('whitelist-remove')
                .setDescription('Elimina un usuario de la whitelist')
                .addUserOption((option) =>
                    option.setName('user').setDescription('Usuario a quitar').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('whitelist-list').setDescription('Muestra la whitelist actual')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('banid-add')
                .setDescription('Banea por ID y bloquea futuras entradas')
                .addStringOption((option) =>
                    option.setName('user_id').setDescription('ID del usuario').setRequired(true)
                )
                .addStringOption((option) =>
                    option.setName('reason').setDescription('Motivo del ban permanente').setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('banid-remove')
                .setDescription('Quita un ban permanente por ID')
                .addStringOption((option) =>
                    option.setName('user_id').setDescription('ID del usuario').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('banid-list').setDescription('Lista los baneos permanentes')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('owner-add')
                .setDescription('Agrega un propietario secundario para alertas')
                .addUserOption((option) =>
                    option.setName('user').setDescription('Usuario a autorizar').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('owner-remove')
                .setDescription('Quita un propietario secundario')
                .addUserOption((option) =>
                    option.setName('user').setDescription('Usuario a quitar').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('owner-list').setDescription('Lista propietarios secundarios')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('bot-add')
                .setDescription('Autoriza un bot por ID')
                .addStringOption((option) =>
                    option.setName('user_id').setDescription('ID del bot').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('bot-remove')
                .setDescription('Quita un bot autorizado')
                .addStringOption((option) =>
                    option.setName('user_id').setDescription('ID del bot').setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('bot-list').setDescription('Lista bots autorizados')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('lockdown')
                .setDescription('Activa o desactiva el lockdown')
                .addStringOption((option) =>
                    option
                        .setName('state')
                        .setDescription('Estado del lockdown')
                        .setRequired(true)
                        .addChoices(
                            { name: 'on', value: 'on' },
                            { name: 'off', value: 'off' },
                            { name: 'status', value: 'status' }
                        )
                )
                .addStringOption((option) =>
                    option.setName('reason').setDescription('Motivo').setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('backup-create')
                .setDescription('Crea un backup manual del servidor')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('backup-list')
                .setDescription('Lista los ultimos backups')
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const settings = await client.db.getGuildSettings(guildId);

        if (subcommand.startsWith('whitelist-')) {
            return handleTrustedUser(interaction, client, TRUSTED_TYPES.whitelist, 'whitelist');
        }

        if (subcommand.startsWith('owner-')) {
            return handleTrustedUser(interaction, client, TRUSTED_TYPES.owner, 'propietarios secundarios');
        }

        if (subcommand.startsWith('bot-')) {
            return handleBotTrust(interaction, client);
        }

        if (subcommand.startsWith('banid-')) {
            return handlePermanentBan(interaction, client, settings);
        }

        if (subcommand === 'lockdown') {
            return handleLockdown(interaction, client, settings);
        }

        if (subcommand === 'backup-create' || subcommand === 'backup-list') {
            return handleBackups(interaction, client, settings);
        }

        return interaction.reply({ content: 'Subcomando no reconocido.', ephemeral: true });
    }
};

async function handleTrustedUser(interaction, client, type, label) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (type === 'owner' && interaction.guild.ownerId !== interaction.user.id) {
        return interaction.reply({
            content: 'Solo el propietario del servidor puede administrar owners secundarios.',
            ephemeral: true
        });
    }

    if (subcommand.endsWith('-list')) {
        const rows = await client.db.listTrustedUsers(guildId, type);
        const embed = new EmbedBuilder()
            .setTitle(`Lista de ${label}`)
            .setColor('#5865f2')
            .setDescription(rows.length ? rows.map((row) => `• <@${row.user_id}> \`${row.user_id}\``).join('\n') : 'No hay usuarios registrados.')
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const isAdd = subcommand.endsWith('-add');

    if (isAdd) {
        await client.db.addTrustedUser(guildId, user.id, type, interaction.user.id);
    } else {
        await client.db.removeTrustedUser(guildId, user.id, type);
    }

    return interaction.reply({
        content: isAdd
            ? `${user.tag} fue agregado a ${label}.`
            : `${user.tag} fue eliminado de ${label}.`,
        ephemeral: true
    });
}

async function handleBotTrust(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'bot-list') {
        const rows = await client.db.listTrustedUsers(guildId, 'bot');
        const embed = new EmbedBuilder()
            .setTitle('Bots autorizados')
            .setColor('#5865f2')
            .setDescription(rows.length ? rows.map((row) => `• <@${row.user_id}> \`${row.user_id}\``).join('\n') : 'No hay bots autorizados.')
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const userId = interaction.options.getString('user_id');
    const isAdd = subcommand === 'bot-add';

    if (isAdd) {
        await client.db.addTrustedUser(guildId, userId, 'bot', interaction.user.id);
    } else {
        await client.db.removeTrustedUser(guildId, userId, 'bot');
    }

    return interaction.reply({
        content: isAdd
            ? `El bot \`${userId}\` fue autorizado.`
            : `El bot \`${userId}\` fue eliminado de autorizados.`,
        ephemeral: true
    });
}

async function handlePermanentBan(interaction, client, settings) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'banid-list') {
        const rows = await client.db.listPermanentBans(guild.id);
        const embed = new EmbedBuilder()
            .setTitle('Ban por ID permanentes')
            .setColor('#ed4245')
            .setDescription(rows.length ? rows.map((row) => `• \`${row.user_id}\` - ${row.reason || 'Sin motivo'}`).join('\n') : 'No hay baneos permanentes.')
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const userId = interaction.options.getString('user_id');

    if (subcommand === 'banid-add') {
        const reason = interaction.options.getString('reason') || 'Ban permanente configurado por seguridad';
        await client.db.addPermanentBan(guild.id, userId, reason, interaction.user.id);

        try {
            await guild.members.ban(userId, { reason });
        } catch (error) {
            console.error(`No se pudo aplicar ban inmediato a ${userId}:`, error.message);
        }

        await createSecurityEvent(client, guild, settings, {
            type: 'PERMANENT_BAN_ADDED',
            severity: 'high',
            title: 'Ban permanente agregado',
            color: '#ed4245',
            description: `Se bloqueó al usuario \`${userId}\` para que no vuelva a entrar.`,
            actor: interaction.user,
            target: { id: userId, tag: userId },
            metadata: { reason },
            alertOwners: true
        });

        return interaction.reply({
            content: `El usuario \`${userId}\` quedó baneado de forma permanente.`,
            ephemeral: true
        });
    }

    await client.db.removePermanentBan(guild.id, userId);
    return interaction.reply({
        content: `El usuario \`${userId}\` fue retirado de la lista de ban permanente.`,
        ephemeral: true
    });
}

async function handleLockdown(interaction, client, settings) {
    const guild = interaction.guild;
    const state = interaction.options.getString('state');
    const reason = interaction.options.getString('reason') || `Lockdown ejecutado por ${interaction.user.tag}`;

    if (state === 'status') {
        return interaction.reply({
            content: settings.lockdown_active ? 'El lockdown esta activo.' : 'El lockdown esta desactivado.',
            ephemeral: true
        });
    }

    const enabled = state === 'on';
    await applyLockdown(guild, enabled, reason);
    await client.db.updateGuildSettings(guild.id, { lockdown_active: enabled ? 1 : 0 });

    await createSecurityEvent(client, guild, settings, {
        type: enabled ? 'LOCKDOWN_ENABLED' : 'LOCKDOWN_DISABLED',
        severity: enabled ? 'high' : 'info',
        title: enabled ? 'Lockdown activado' : 'Lockdown desactivado',
        color: enabled ? '#ed4245' : '#57f287',
        description: reason,
        actor: interaction.user,
        alertOwners: enabled
    });

    return interaction.reply({
        content: enabled ? 'Lockdown activado correctamente.' : 'Lockdown desactivado correctamente.',
        ephemeral: true
    });
}

async function handleBackups(interaction, client, settings) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'backup-list') {
        const backups = await client.db.listBackups(guild.id, 5);
        const embed = new EmbedBuilder()
            .setTitle('Ultimos backups')
            .setColor('#00b894')
            .setDescription(
                backups.length
                    ? backups.map((backup) => `• ${backup.type} - ${backup.created_at} - \`${backup.file_path}\``).join('\n')
                    : 'No hay backups registrados.'
            )
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const filePath = await createGuildBackup(client, guild, 'manual', interaction.user.id);
    await createSecurityEvent(client, guild, settings, {
        type: 'MANUAL_BACKUP_CREATED',
        severity: 'info',
        title: 'Backup manual creado',
        color: '#00b894',
        description: `Se creó una copia de seguridad manual en \`${filePath}\`.`,
        actor: interaction.user
    });

    return interaction.reply({
        content: `Backup creado correctamente en \`${filePath}\`.`,
        ephemeral: true
    });
}
