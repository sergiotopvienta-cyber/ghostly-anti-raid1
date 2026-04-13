const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('securityscan')
        .setDescription('Escanear el servidor y obtener recomendaciones de seguridad')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        const guild = interaction.guild;
        
        await interaction.deferReply({ ephemeral: true });

        try {
            // Realizar el escaneo
            const scanResults = await performSecurityScan(guild, client);
            
            // Generar el embed de resultados
            const embed = generateScanEmbed(scanResults, guild);
            
            // Crear botones de acción rápida
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('fix_all_issues')
                        .setLabel('🔧 Corregir Todo')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(scanResults.score === 100),
                    new ButtonBuilder()
                        .setCustomId('view_details')
                        .setLabel('📋 Ver Detalles')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setURL('https://discord.gg/FcbH8m4D')
                        .setLabel('💬 Soporte')
                        .setStyle(ButtonStyle.Link)
                );

            await interaction.editReply({ 
                embeds: [embed], 
                components: [row] 
            });

        } catch (error) {
            console.error('Error en security scan:', error);
            await interaction.editReply({
                content: '❌ Error al realizar el escaneo de seguridad.',
                ephemeral: true
            });
        }
    }
};

async function performSecurityScan(guild, client) {
    const results = {
        score: 0,
        totalChecks: 0,
        passed: 0,
        warnings: [],
        critical: [],
        info: [],
        recommendations: []
    };

    // 1. Verificar permisos del bot
    const botMember = guild.members.cache.get(client.user.id);
    const botPermissions = botMember.permissions;
    
    const requiredPerms = [
        'KickMembers',
        'BanMembers',
        'ManageRoles',
        'ManageChannels',
        'ViewAuditLog',
        'ManageMessages'
    ];

    const missingPerms = requiredPerms.filter(perm => !botPermissions.has(perm));
    
    if (missingPerms.length === 0) {
        results.passed++;
        results.info.push('✅ Bot tiene todos los permisos necesarios');
    } else {
        results.critical.push(`❌ Faltan permisos: ${missingPerms.join(', ')}`);
        results.recommendations.push('Otorga los permisos faltantes al bot en Configuración del Servidor > Roles');
    }
    results.totalChecks++;

    // 2. Verificar configuración de seguridad
    const settings = await client.db.getGuildSettings(guild.id);
    
    const securityFeatures = {
        anti_raid: '🚨 Anti-Raid',
        anti_nuke: '🔒 Anti-Nuke',
        anti_links: '🔗 Anti-Links',
        anti_bots: '🤖 Anti-Bots',
        anti_alts: '👤 Anti-Alts'
    };

    let enabledFeatures = 0;
    for (const [key, label] of Object.entries(securityFeatures)) {
        if (settings[key]) {
            enabledFeatures++;
        } else {
            results.warnings.push(`⚠️ ${label} está desactivado`);
        }
    }

    if (enabledFeatures === 5) {
        results.passed++;
        results.info.push('✅ Todas las protecciones están activas');
    } else {
        results.recommendations.push(`Activa las protecciones faltantes con /settings`);
    }
    results.totalChecks++;

    // 3. Verificar canal de alertas
    if (settings.alerts_channel) {
        const alertChannel = guild.channels.cache.get(settings.alerts_channel);
        if (alertChannel) {
            results.passed++;
            results.info.push(`✅ Canal de alertas configurado: ${alertChannel}`);
        } else {
            results.warnings.push('⚠️ El canal de alertas configurado ya no existe');
            results.recommendations.push('Configura un nuevo canal de alertas con /alerts channel');
        }
    } else {
        results.warnings.push('⚠️ No hay canal de alertas configurado');
        results.recommendations.push('Configura un canal de alertas con /alerts channel');
    }
    results.totalChecks++;

    // 4. Verificar roles de administrador
    const adminRoles = guild.roles.cache.filter(role => 
        role.permissions.has('Administrator') && !role.managed
    );

    if (adminRoles.size === 0) {
        results.critical.push('❌ No hay roles con permiso de Administrador');
    } else if (adminRoles.size > 3) {
        results.warnings.push(`⚠️ Hay ${adminRoles.size} roles con permiso de Administrador`);
        results.recommendations.push('Considera reducir la cantidad de roles con permiso de Administrador');
    } else {
        results.passed++;
        results.info.push(`✅ ${adminRoles.size} roles con permiso de Administrador (cantidad razonable)`);
    }
    results.totalChecks++;

    // 5. Verificar roles con permisos peligrosos
    const dangerousRoles = guild.roles.cache.filter(role => {
        const perms = role.permissions;
        return (perms.has('KickMembers') || perms.has('BanMembers') || 
                perms.has('ManageRoles') || perms.has('ManageChannels')) &&
               !perms.has('Administrator') && !role.managed;
    });

    if (dangerousRoles.size > 5) {
        results.warnings.push(`⚠️ Hay ${dangerousRoles.size} roles con permisos de moderación`);
        results.recommendations.push('Revisa que solo usuarios de confianza tengan roles con permisos de moderación');
    } else {
        results.passed++;
        results.info.push(`✅ Cantidad razonable de roles con permisos de moderación`);
    }
    results.totalChecks++;

    // 6. Verificar nivel de verificación del servidor
    if (guild.verificationLevel === 'NONE' || guild.verificationLevel === 'LOW') {
        results.warnings.push('⚠️ Nivel de verificación del servidor es bajo');
        results.recommendations.push('Considera aumentar el nivel de verificación en Configuración del Servidor > Seguridad');
    } else {
        results.passed++;
        results.info.push(`✅ Nivel de verificación: ${guild.verificationLevel}`);
    }
    results.totalChecks++;

    // 7. Verificar filtro de contenido explícito
    if (guild.explicitContentFilter === 'DISABLED') {
        results.warnings.push('⚠️ Filtro de contenido explícito desactivado');
        results.recommendations.push('Activa el filtro de contenido explícito en Configuración del Servidor > Seguridad');
    } else {
        results.passed++;
        results.info.push(`✅ Filtro de contenido: ${guild.explicitContentFilter}`);
    }
    results.totalChecks++;

    // 8. Verificar 2FA para moderación
    if (!guild.mfaLevel) {
        results.warnings.push('⚠️ 2FA no es requerido para acciones de moderación');
        results.recommendations.push('Considera activar "Requerir 2FA para acciones de moderación" para mayor seguridad');
    } else {
        results.passed++;
        results.info.push('✅ 2FA requerido para acciones de moderación');
    }
    results.totalChecks++;

    // Calcular puntuación
    results.score = Math.round((results.passed / results.totalChecks) * 100);

    return results;
}

function generateScanEmbed(results, guild) {
    // Determinar color según puntuación
    const color = results.score >= 80 ? '#57f287' : 
                  results.score >= 50 ? '#faa61a' : '#ed4245';
    
    const grade = results.score >= 90 ? 'A+' : 
                  results.score >= 80 ? 'A' : 
                  results.score >= 70 ? 'B' : 
                  results.score >= 60 ? 'C' : 
                  results.score >= 50 ? 'D' : 'F';

    const embed = new EmbedBuilder()
        .setTitle(`🛡️ Security Scan: ${guild.name}`)
        .setColor(color)
        .setDescription(`**Puntuación: ${results.score}/100** (${grade})\n${getProgressBar(results.score)}`)
        .setThumbnail(guild.iconURL())
        .addFields(
            { 
                name: '✅ Pasadas', 
                value: `${results.passed}/${results.totalChecks}`, 
                inline: true 
            },
            { 
                name: '⚠️ Advertencias', 
                value: `${results.warnings.length}`, 
                inline: true 
            },
            { 
                name: '❌ Críticas', 
                value: `${results.critical.length}`, 
                inline: true 
            }
        );

    // Agregar críticas si hay
    if (results.critical.length > 0) {
        embed.addFields({
            name: '🚨 Problemas Críticos',
            value: results.critical.slice(0, 5).join('\n') + 
                   (results.critical.length > 5 ? `\n*...y ${results.critical.length - 5} más*` : ''),
            inline: false
        });
    }

    // Agregar advertencias si hay
    if (results.warnings.length > 0) {
        embed.addFields({
            name: '⚠️ Advertencias',
            value: results.warnings.slice(0, 5).join('\n') + 
                   (results.warnings.length > 5 ? `\n*...y ${results.warnings.length - 5} más*` : ''),
            inline: false
        });
    }

    // Agregar recomendaciones si hay
    if (results.recommendations.length > 0) {
        const uniqueRecs = [...new Set(results.recommendations)];
        embed.addFields({
            name: '💡 Recomendaciones',
            value: uniqueRecs.slice(0, 3).join('\n• ') + 
                   (uniqueRecs.length > 3 ? `\n*...y ${uniqueRecs.length - 3} más*` : ''),
            inline: false
        });
    }

    embed.setFooter({ 
        text: 'Ghostly Guard Security Scanner • Escaneo completo', 
        iconURL: guild.client.user.displayAvatarURL() 
    })
    .setTimestamp();

    return embed;
}

function getProgressBar(score) {
    const filled = Math.round(score / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}
