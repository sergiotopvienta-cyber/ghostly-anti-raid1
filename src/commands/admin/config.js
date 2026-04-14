const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Ver y gestionar configuración del servidor')
        .addSubcommand(subcommand =>
            subcommand
                .setName('server')
                .setDescription('Ver configuración completa del servidor'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'server') {
            await showServerConfig(interaction, client);
        }
    }
};

async function showServerConfig(interaction, client) {
    const guild = interaction.guild;
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const settings = await client.db.getGuildSettings(guild.id);
        
        // Funciones de protección
        const protectionFeatures = [
            { name: '🛡️ Anti-Raid', value: settings.anti_raid, desc: 'Bloquea raids masivos' },
            { name: '💥 Anti-Nuke', value: settings.anti_nuke, desc: 'Previene destrucción del servidor' },
            { name: '💬 Anti-Flood', value: settings.anti_flood, desc: 'Bloquea spam de mensajes' },
            { name: '🤖 Anti-Bots', value: settings.anti_bots, desc: 'Bloquea bots no autorizados' },
            { name: '✅ Solo Bots Verificados', value: settings.anti_bot_verified_only, desc: 'Solo permite bots verificados por Discord' },
            { name: '👤 Anti-Cuentas Nuevas', value: settings.anti_alts, desc: 'Bloquea cuentas recién creadas' },
            { name: '⚠️ Anti-Nombres Sospechosos', value: settings.anti_suspicious_names, desc: 'Detecta nombres de spam/bots' },
            { name: '🔗 Anti-Links', value: settings.anti_links, desc: 'Bloquea links maliciosos' },
            { name: '📢 Anti-Menciones Spam', value: settings.anti_mentions, desc: 'Limita menciones masivas' },
            { name: '🔒 Lockdown', value: settings.lockdown_active, desc: 'Modo lockdown del servidor' }
        ];
        
        const activeFeatures = protectionFeatures.filter(f => f.value);
        const inactiveFeatures = protectionFeatures.filter(f => !f.value);
        
        // Construir campos del embed
        const fields = [];
        
        // Funciones Activadas
        if (activeFeatures.length > 0) {
            fields.push({
                name: '✅ Funciones Activadas',
                value: activeFeatures.map(f => `**${f.name}**\n*${f.desc}*`).join('\n\n'),
                inline: false
            });
        }
        
        // Funciones Desactivadas
        if (inactiveFeatures.length > 0) {
            // Si hay muchas, las mostramos en bloques más pequeños
            const inactiveList = inactiveFeatures.map(f => `❌ ${f.name}`);
            fields.push({
                name: '⚪ Funciones Desactivadas',
                value: inactiveList.join('\n'),
                inline: false
            });
        }
        
        // Límites y Umbrales
        const limits = [];
        if (settings.max_joins_per_minute) limits.push(`⚡ Máximo joins/minuto: **${settings.max_joins_per_minute}**`);
        if (settings.max_messages_per_second) limits.push(`📨 Máximo msgs/segundo: **${settings.max_messages_per_second}**`);
        if (settings.max_mentions_per_message) limits.push(`💬 Máximo menciones: **${settings.max_mentions_per_message}**`);
        if (settings.min_account_age_days) limits.push(`📅 Mínimo días cuenta: **${settings.min_account_age_days}**`);
        
        if (limits.length > 0) {
            fields.push({
                name: '📊 Límites Configurados',
                value: limits.join('\n'),
                inline: false
            });
        }
        
        // Canales Configurados
        const channels = [];
        if (settings.log_channel) {
            const logChannel = guild.channels.cache.get(settings.log_channel);
            channels.push(`📝 Logs: ${logChannel ? `<#${settings.log_channel}>` : '*Canal no encontrado*'}`);
        }
        if (settings.alert_channel) {
            const alertChannel = guild.channels.cache.get(settings.alert_channel);
            channels.push(`🚨 Alertas: ${alertChannel ? `<#${settings.alert_channel}>` : '*Canal no encontrado*'}`);
        }
        if (settings.welcome_channel) {
            const welcomeChannel = guild.channels.cache.get(settings.welcome_channel);
            channels.push(`👋 Bienvenida: ${welcomeChannel ? `<#${settings.welcome_channel}>` : '*Canal no encontrado*'}`);
        }
        
        if (channels.length > 0) {
            fields.push({
                name: '📢 Canales Configurados',
                value: channels.join('\n') || '*Ninguno configurado*',
                inline: false
            });
        }
        
        // Rol de Verificación
        if (settings.verification_role) {
            const role = guild.roles.cache.get(settings.verification_role);
            fields.push({
                name: '🎭 Rol de Verificación',
                value: role ? `<@&${settings.verification_role}>` : '*Rol no encontrado*',
                inline: true
            });
        }
        
        // Estadísticas
        const [trustedCount, banCount, backupCount] = await Promise.all([
            client.db.listTrustedUsers(guild.id, 'whitelist').then(r => r.length),
            client.db.listPermanentBans(guild.id).then(r => r.length),
            client.db.listBackups(guild.id).then(r => r.length)
        ]);
        
        fields.push({
            name: '📈 Estadísticas del Servidor',
            value: `👥 Whitelist: **${trustedCount}** usuarios\n🚫 Bans permanentes: **${banCount}**\n💾 Backups: **${backupCount}**`,
            inline: false
        });
        
        const embed = new EmbedBuilder()
            .setTitle(`⚙️ Configuración de ${guild.name}`)
            .setColor(activeFeatures.length > 5 ? '#57f287' : activeFeatures.length > 0 ? '#f1c40f' : '#ed4245')
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(fields)
            .setFooter({ 
                text: `💡 Usa /securityscan para ver tu nivel de seguridad • ID: ${guild.id}`, 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();
        
        // Botones de acción rápida (opcional, puedes agregarlos después)
        await interaction.editReply({ 
            embeds: [embed],
            content: `📊 **Nivel de Protección:** ${activeFeatures.length}/10 funciones activadas`
        });
        
    } catch (error) {
        console.error('Error obteniendo configuración:', error);
        await interaction.editReply({
            content: '❌ Error al obtener la configuración del servidor.',
            ephemeral: true
        });
    }
}
