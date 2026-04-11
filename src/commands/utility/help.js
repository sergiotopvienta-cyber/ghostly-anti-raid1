const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Muestra la lista de comandos disponibles')
        .addStringOption(option =>
            option
                .setName('category')
                .setDescription('Categoría de comandos')
                .addChoices(
                    { name: 'Administración', value: 'admin' },
                    { name: 'Utilidad', value: 'utility' },
                    { name: 'Seguridad', value: 'security' }
                )
                .setRequired(false)
        ),
        
    async execute(interaction, client) {
        const category = interaction.options.getString('category');
        
        if (category === 'admin') {
            await showAdminCommands(interaction);
        } else if (category === 'utility') {
            await showUtilityCommands(interaction);
        } else if (category === 'security') {
            await showSecurityCommands(interaction);
        } else {
            await showMainHelp(interaction);
        }
    },
};

async function showMainHelp(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('Ghostly Anti-Raid - Ayuda')
        .setColor(0x0099ff)
        .setDescription('Bot anti-raid completo para proteger tu servidor Discord')
        .addFields(
            { 
                name: 'Comandos Principales', 
                value: '`/settings` - Ver configuración\n`/setup` - Configurar canales\n`/antiraid` - Configurar anti-raid\n`/antinuke` - Configurar anti-nuke', 
                inline: false 
            },
            { 
                name: 'Categorías', 
                value: '`/help admin` - Comandos de administración\n`/help utility` - Comandos de utilidad\n`/help security` - Comandos de seguridad', 
                inline: false 
            },
            { 
                name: 'Características', 
                value: 'Anti-Raid automático\nAnti-Nuke protección\nAnti-Flood y spam\nDetección de bots y alts\nSistema de logs completo\nVerificación de miembros', 
                inline: false 
            },
            { 
                name: 'Soporte', 
                value: '¿Necesitas ayuda? Contacta al administrador del servidor', 
                inline: false 
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Ghostly Anti-Raid - Protección 24/7' });

    await interaction.reply({ embeds: [embed] });
}

async function showAdminCommands(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('Comandos de Administración')
        .setColor('#ff6600')
        .setDescription('Comandos para administrar el bot (requieren permisos de administrador)')
        .addFields(
            { 
                name: '`/settings`', 
                value: 'Muestra la configuración actual del bot', 
                inline: false 
            },
            { 
                name: '`/setup`', 
                value: 'Configura los canales principales (logs, bienvenida, rol de verificación)', 
                inline: false 
            },
            { 
                name: '`/antiraid enable/disable`', 
                value: 'Activa o desactiva el sistema anti-raid', 
                inline: false 
            },
            { 
                name: '`/antiraid config`', 
                value: 'Configura parámetros anti-raid (máximo joins, edad mínima)', 
                inline: false 
            },
            { 
                name: '`/antinuke enable/disable`', 
                value: 'Activa o desactiva el sistema anti-nuke', 
                inline: false 
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Ghostly Anti-Raid - Administración' });

    await interaction.reply({ embeds: [embed] });
}

async function showUtilityCommands(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('Comandos de Utilidad')
        .setColor('#00ff00')
        .setDescription('Comandos de uso general')
        .addFields(
            { 
                name: '`/help`', 
                value: 'Muestra este mensaje de ayuda', 
                inline: false 
            },
            { 
                name: '`/ping`', 
                value: 'Muestra la latencia del bot', 
                inline: false 
            },
            { 
                name: '`/stats`', 
                value: 'Muestra estadísticas del servidor', 
                inline: false 
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Ghostly Anti-Raid - Utilidad' });

    await interaction.reply({ embeds: [embed] });
}

async function showSecurityCommands(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('Comandos de Seguridad')
        .setColor('#ff0000')
        .setDescription('Comandos relacionados con la seguridad del servidor')
        .addFields(
            { 
                name: '`/check`', 
                value: 'Verifica la seguridad de un usuario', 
                inline: false 
            },
            { 
                name: '`/raidmode`', 
                value: 'Activa el modo raid de emergencia', 
                inline: false 
            },
            { 
                name: '`/lockdown`', 
                value: 'Bloquea el servidor temporalmente', 
                inline: false 
            }
        )
        .setTimestamp()
        .setFooter({ text: 'Ghostly Anti-Raid - Seguridad' });

    await interaction.reply({ embeds: [embed] });
}
