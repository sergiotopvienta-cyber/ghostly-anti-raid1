const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorol')
        .setDescription('Configurar el rol automático para nuevos miembros')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Establecer el rol automático')
                .addRoleOption(option =>
                    option
                        .setName('rol')
                        .setDescription('El rol que se asignará automáticamente')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Eliminar el rol automático')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Ver el estado del rol automático')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'set':
                await setAutoRole(interaction, client);
                break;
            case 'remove':
                await removeAutoRole(interaction, client);
                break;
            case 'status':
                await showAutoRoleStatus(interaction, client);
                break;
        }
    }
};

async function setAutoRole(interaction, client) {
    const role = interaction.options.getRole('rol');
    
    if (role.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription('No puedes asignar un rol que esté por encima de tu rol más alto.')
            .setTimestamp();
        
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    if (role.managed) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription('No puedes usar roles gestionados por bots como rol automático.')
            .setTimestamp();
        
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    const botMember = interaction.guild.members.me;
    if (!botMember) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription('No pude obtener la información del bot en el servidor.')
            .setTimestamp();
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription('No tengo el permiso **Gestionar Roles**. Actívalo para poder asignar el rol automáticamente.')
            .setTimestamp();
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    if (role.position >= botMember.roles.highest.position) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription('Ese rol está por encima (o igual) al rol más alto del bot. Sube el rol del bot por encima para que pueda asignarlo.')
            .setTimestamp();
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    try {
        await client.db.setAutoRole(interaction.guild.id, role.id, interaction.user.id);

        const successEmbed = new EmbedBuilder()
            .setTitle('Rol Automático Configurado')
            .setColor('#57f287')
            .setDescription(`El rol **${role.name}** será asignado automáticamente a todos los nuevos miembros.`)
            .addFields(
                { name: 'Rol', value: `<@&${role.id}>`, inline: true },
                { name: 'Configurado por', value: interaction.user.tag, inline: true },
                { name: 'Fecha', value: new Date().toLocaleDateString('es-ES'), inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Guard - AutoRol' });

        await interaction.reply({ embeds: [successEmbed] });

        await client.db.logRaid(
            interaction.guild.id,
            interaction.user.id,
            interaction.user.tag,
            'AUTOROL_SET',
            `Rol automático configurado: ${role.name}`
        );

    } catch (error) {
        console.error('Error al configurar autorol:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription(`Hubo un error al configurar el rol automático.\n\nDetalle: ${String(error?.message || error)}`)
            .setTimestamp();
        
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

async function removeAutoRole(interaction, client) {
    try {
        const currentAutoRole = await client.db.getAutoRole(interaction.guild.id);
        
        if (!currentAutoRole) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('Error')
                .setColor('#ed4245')
                .setDescription('No hay ningún rol automático configurado en este servidor.')
                .setTimestamp();
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        await client.db.removeAutoRole(interaction.guild.id);

        const successEmbed = new EmbedBuilder()
            .setTitle('Rol Automático Eliminado')
            .setColor('#57f287')
            .setDescription('El rol automático ha sido eliminado correctamente.')
            .addFields(
                { name: 'Eliminado por', value: interaction.user.tag, inline: true },
                { name: 'Fecha', value: new Date().toLocaleDateString('es-ES'), inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Ghostly Guard - AutoRol' });

        await interaction.reply({ embeds: [successEmbed] });

        await client.db.logRaid(
            interaction.guild.id,
            interaction.user.id,
            interaction.user.tag,
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
        
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}

async function showAutoRoleStatus(interaction, client) {
    try {
        const autoRoleData = await client.db.getAutoRole(interaction.guild.id);
        
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

        await interaction.reply({ embeds: [statusEmbed] });

    } catch (error) {
        console.error('Error al mostrar estado del autorol:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle('Error')
            .setColor('#ed4245')
            .setDescription('Hubo un error al obtener el estado del rol automático. Por favor, intenta de nuevo.')
            .setTimestamp();
        
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
}
