const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot) return;
        
        if (!message.guild) return;

        const settings = await client.db.getGuildSettings(message.guild.id);
        
        await client.db.trackMessage(message.guild.id, message.author.id, message.channel.id);

        if (settings.anti_flood) {
            const recentMessages = await client.db.getRecentMessages(message.guild.id, message.author.id, 1);
            if (recentMessages >= settings.max_messages_per_second) {
                await handleFlood(message, client, settings);
                return;
            }
        }

        if (settings.anti_mentions) {
            const mentionCount = message.mentions.users.size + message.mentions.roles.size;
            if (mentionCount > settings.max_mentions_per_message) {
                await handleMassMentions(message, client, settings, mentionCount);
                return;
            }
        }

        if (settings.anti_links) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const links = message.content.match(urlRegex);
            if (links && links.length > 0) {
                await handleLinks(message, client, settings, links);
                return;
            }
        }
    },
};

async function handleFlood(message, client, settings) {
    try {
        await message.delete();
        
        const member = message.member;
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await member.timeout(ms('5 minutes'), 'Flood de mensajes - Ghostly Anti-Raid');
            
            await client.db.logRaid(message.guild.id, message.author.id, message.author.tag, 'TIMEOUT_AUTO', 'Flood de mensajes');
        }

        if (settings.log_channel) {
            const logChannel = message.guild.channels.cache.get(settings.log_channel);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Flood Detectado')
                    .setColor('#ff6600')
                    .setDescription(`Se ha detectado flood de mensajes`)
                    .addFields(
                        { name: 'Usuario', value: `${message.author.tag} (${message.author.id})`, inline: true },
                        { name: 'Canal', value: `${message.channel}`, inline: true },
                        { name: 'Acción', value: 'Mensaje eliminado + Timeout 5 min', inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] });
            }
        }

        const warningEmbed = new EmbedBuilder()
            .setTitle('Flood Detectado')
            .setColor('#ff6600')
            .setDescription('Por favor, no envíes mensajes tan rápido')
            .setTimestamp();

        try {
            await message.author.send({ embeds: [warningEmbed] });
        } catch (error) {
            // No se puede enviar DM
        }

    } catch (error) {
        console.error('Error en manejo de flood:', error);
    }
}

async function handleMassMentions(message, client, settings, mentionCount) {
    try {
        await message.delete();
        
        const member = message.member;
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await member.timeout(ms('10 minutes'), 'Menciones masivas - Ghostly Anti-Raid');
            
            await client.db.logRaid(message.guild.id, message.author.id, message.author.tag, 'TIMEOUT_AUTO', `Menciones masivas: ${mentionCount}`);
        }

        if (settings.log_channel) {
            const logChannel = message.guild.channels.cache.get(settings.log_channel);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Menciones Masivas Detectadas')
                    .setColor('#ff0066')
                    .setDescription(`Se han detectado menciones masivas`)
                    .addFields(
                        { name: 'Usuario', value: `${message.author.tag} (${message.author.id})`, inline: true },
                        { name: 'Canal', value: `${message.channel}`, inline: true },
                        { name: 'Menciones', value: `${mentionCount}/${settings.max_mentions_per_message}`, inline: true },
                        { name: 'Acción', value: 'Mensaje eliminado + Timeout 10 min', inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] });
            }
        }

        const warningEmbed = new EmbedBuilder()
            .setTitle('Menciones Masivas Detectadas')
            .setColor('#ff0066')
            .setDescription(`Has excedido el límite de menciones (${settings.max_mentions_per_message})`)
            .setTimestamp();

        try {
            await message.author.send({ embeds: [warningEmbed] });
        } catch (error) {
            // No se puede enviar DM
        }

    } catch (error) {
        console.error('Error en manejo de menciones masivas:', error);
    }
}

async function handleLinks(message, client, settings, links) {
    try {
        await message.delete();
        
        const member = message.member;
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await member.timeout(ms('5 minutes'), 'Enlaces detectados - Ghostly Anti-Raid');
            
            await client.db.logRaid(message.guild.id, message.author.id, message.author.tag, 'TIMEOUT_AUTO', `Enlaces: ${links.length}`);
        }

        if (settings.log_channel) {
            const logChannel = message.guild.channels.cache.get(settings.log_channel);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Enlaces Detectados')
                    .setColor('#9900ff')
                    .setDescription(`Se han detectado enlaces no permitidos`)
                    .addFields(
                        { name: 'Usuario', value: `${message.author.tag} (${message.author.id})`, inline: true },
                        { name: 'Canal', value: `${message.channel}`, inline: true },
                        { name: 'Enlaces', value: links.length.toString(), inline: true },
                        { name: 'Acción', value: 'Mensaje eliminado + Timeout 5 min', inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] });
            }
        }

        const warningEmbed = new EmbedBuilder()
            .setTitle('Enlaces No Permitidos')
            .setColor('#9900ff')
            .setDescription('No está permitido enviar enlaces en este servidor')
            .setTimestamp();

        try {
            await message.author.send({ embeds: [warningEmbed] });
        } catch (error) {
            // No se puede enviar DM
        }

    } catch (error) {
        console.error('Error en manejo de enlaces:', error);
    }
}
