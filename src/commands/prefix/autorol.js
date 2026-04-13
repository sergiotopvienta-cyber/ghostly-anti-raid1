const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'autorol',
    description: 'Configurar el rol automático para nuevos miembros',
    usage: '!autorol set @rol | !autorol remove | !autorol status',
    permissions: [PermissionFlagsBits.Administrator],

    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('Error')
                .setColor('#ed4245')
                .setDescription('Necesitas permisos de administrador para usar este comando.')
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }

        const subcommand = args[0]?.toLowerCase();

        switch (subcommand) {
            case 'set':
                await setAutoRole(message, args, client);
                break;
            case 'remove':
                await removeAutoRole(message, client);
                break;
            case 'status':
                await showAutoRoleStatus(message, client);
                break;
            default:
                const helpEmbed = new EmbedBuilder()
                    .setTitle('Comando Autorol')
                    .setColor('#f1c40f')
                    .setDescription('Uso del comando autorol:')
                    .addFields(
                        { 
                            name: '!autorol set @rol', 
                            value: 'Establece el rol automático para nuevos miembros', 
                            inline: false 
                        },
                        { 
                            name: '!autorol remove', 
                            value: 'Elimina el rol automático', 
                            inline: false 
                        },
                        { 
                            name: '!autorol status', 
                            value: 'Muestra el estado actual del rol automático', 
                            inline: false 
                        }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Ghostly Guard - Comandos' });
                
                return message.reply({ embeds: [helpEmbed] });
        }
    }
};

async function setAutoRole(message, args, client) {
    const role = message.mentions.roles.first();
    
    if (!role) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription('Debes mencionar un rol. Ejemplo: `!autorol set @Miembro`')
            .setTimestamp();
        
        return message.reply({ embeds: [errorEmbed] });
    }

    if (role.position >= message.member.roles.highest.position && message.author.id !== message.guild.ownerId) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription('No puedes asignar un rol que esté por encima de tu rol más alto.')
            .setTimestamp();
        
        return message.reply({ embeds: [errorEmbed] });
    }

    if (role.managed) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription('No puedes usar roles gestionados por bots como rol automático.')
            .setTimestamp();
        
        return message.reply({ embeds: [errorEmbed] });
    }

    try {
        await client.db.setAutoRole(message.guild.id, role.id);

        const successEmbed = new EmbedBuilder()
            .setTitle('Rol Automático Configurado')
            .setColor('#57f287')
            .setDescription(`El rol **${role.name}** será asignado automáticamente a todos los nuevos miembros.`)
            .addFields(
                { name: 'Rol', value: `<@&${role.id}>`, inline: true },
                { name: 'Configurado por', value: message.author.tag, inline: true },
                { name: 'Fecha', value: new Date().toLocaleDateString('es-ES'), inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Guard - AutoRol' });

        await message.reply({ embeds: [successEmbed] });

        await client.db.logRaid(
            message.guild.id,
            message.author.id,
            message.author.tag,
            'AUTOROL_SET',
            `Rol automático configurado: ${role.name}`
        );

    } catch (error) {
        console.error('Error al configurar autorol:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription('Hubo un error al configurar el rol automático. Por favor, intenta de nuevo.')
            .setTimestamp();
        
        await message.reply({ embeds: [errorEmbed] });
    }
}

async function removeAutoRole(message, client) {
    try {
        const currentAutoRole = await client.db.getAutoRole(message.guild.id);
        
        if (!currentAutoRole) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('Error')
                .setColor('#ed4245')
                .setDescription('No hay ningún rol automático configurado en este servidor.')
                .setTimestamp();
            
            return message.reply({ embeds: [errorEmbed] });
        }

        await client.db.removeAutoRole(message.guild.id);

        const successEmbed = new EmbedBuilder()
            .setTitle('Rol Automático Eliminado')
            .setColor('#57f287')
            .setDescription('El rol automático ha sido eliminado correctamente.')
            .addFields(
                { name: 'Eliminado por', value: message.author.tag, inline: true },
                { name: 'Fecha', value: new Date().toLocaleDateString('es-ES'), inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Guard - AutoRol' });

        await message.reply({ embeds: [successEmbed] });

        await client.db.logRaid(
            message.guild.id,
            message.author.id,
            message.author.tag,
            'AUTOROL_REMOVE',
            'Rol automático eliminado'
        );

    } catch (error) {
        console.error('Error al eliminar autorol:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription('Hubo un error al eliminar el rol automático. Por favor, intenta de nuevo.')
            .setTimestamp();
        
        await message.reply({ embeds: [errorEmbed] });
    }
}

async function showAutoRoleStatus(message, client) {
    try {
        const autoRoleData = await client.db.getAutoRole(message.guild.id);
        
        const statusEmbed = new EmbedBuilder()
            .setTitle('Estado del Rol Automático')
            .setColor(autoRoleData ? '#57f287' : '#faa61a')
            .setDescription(autoRoleData 
                ? `El rol automático está **activado** y asignará <@&${autoRoleData.role_id}> a los nuevos miembros.`
                : 'No hay ningún rol automático configurado en este servidor.')
            .addFields(
                { 
                    name: 'Estado', 
                    value: autoRoleData ? 'Activado' : 'Desactivado', 
                    inline: true 
                },
                { 
                    name: 'Rol', 
                    value: autoRoleData ? `<@&${autoRoleData.role_id}>` : 'No configurado', 
                    inline: true 
                },
                { 
                    name: 'Configurado por', 
                    value: autoRoleData ? `<@${autoRoleData.set_by}>` : 'N/A', 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Guard - AutoRol' });

        await message.reply({ embeds: [statusEmbed] });

    } catch (error) {
        console.error('Error al mostrar estado del autorol:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription('Hubo un error al obtener el estado del rol automático. Por favor, intenta de nuevo.')
            .setTimestamp();
        
        await message.reply({ embeds: [errorEmbed] });
    }
}
