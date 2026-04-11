const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configura los canales principales del bot')
        .addChannelOption(option =>
            option
                .setName('log_channel')
                .setDescription('Canal para enviar logs de seguridad')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addChannelOption(option =>
            option
                .setName('welcome_channel')
                .setDescription('Canal para mensajes de bienvenida')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addRoleOption(option =>
            option
                .setName('verification_role')
                .setDescription('Rol para miembros verificados')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        
    async execute(interaction, client) {
        const logChannel = interaction.options.getChannel('log_channel');
        const welcomeChannel = interaction.options.getChannel('welcome_channel');
        const verificationRole = interaction.options.getRole('verification_role');
        
        const settings = await client.db.getGuildSettings(interaction.guild.id);
        
        const updates = {};
        
        if (logChannel) {
            updates.log_channel = logChannel.id;
        }
        
        if (welcomeChannel) {
            updates.welcome_channel = welcomeChannel.id;
        }
        
        if (verificationRole) {
            updates.verification_role = verificationRole.id;
        }
        
        if (Object.keys(updates).length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('Configuración Actual')
                .setColor('#0099ff')
                .setDescription('Configuración actual del servidor')
                .addFields(
                    { 
                        name: 'Canal de Logs', 
                        value: settings.log_channel ? `<#${settings.log_channel}>` : 'No configurado', 
                        inline: true 
                    },
                    { 
                        name: 'Canal de Bienvenida', 
                        value: settings.welcome_channel ? `<#${settings.welcome_channel}>` : 'No configurado', 
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

            return interaction.reply({ embeds: [embed] });
        }
        
        try {
            await client.db.updateGuildSettings(interaction.guild.id, updates);
            
            const embed = new EmbedBuilder()
                .setTitle('Configuración Actualizada')
                .setColor('#00ff00')
                .setDescription('La configuración ha sido actualizada correctamente')
                .addFields(
                    { 
                        name: 'Canal de Logs', 
                        value: logChannel ? `<#${logChannel.id}>` : (settings.log_channel ? `<#${settings.log_channel}>` : 'No configurado'), 
                        inline: true 
                    },
                    { 
                        name: 'Canal de Bienvenida', 
                        value: welcomeChannel ? `<#${welcomeChannel.id}>` : (settings.welcome_channel ? `<#${settings.welcome_channel}>` : 'No configurado'), 
                        inline: true 
                    },
                    { 
                        name: 'Rol de Verificación', 
                        value: verificationRole ? `<@&${verificationRole.id}>` : (settings.verification_role ? `<@&${settings.verification_role}>` : 'No configurado'), 
                        inline: true 
                    }
                )
                .setTimestamp()
                .setFooter({ text: 'Ghostly Anti-Raid - Configuración' });

            await interaction.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error al actualizar configuración:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('Error')
                .setColor('#ff0000')
                .setDescription('Hubo un error al actualizar la configuración')
                .setTimestamp();

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};
