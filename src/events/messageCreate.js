const { Events, PermissionFlagsBits } = require('discord.js');
const ms = require('ms');

const { createSecurityEvent, isWhitelisted } = require('../utils/security');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const settings = await client.db.getGuildSettings(message.guild.id);
        const whitelisted = await isWhitelisted(client, message.guild.id, message.author.id);
        const bypass = whitelisted || message.member.permissions.has(PermissionFlagsBits.ManageMessages);

        if (settings.lockdown_active && !bypass) {
            await message.delete().catch(() => null);
            return;
        }

        await client.db.trackMessage(message.guild.id, message.author.id, message.channel.id);

        if (!bypass && settings.anti_flood) {
            const recentMessages = await client.db.getRecentMessages(message.guild.id, message.author.id, 1);
            if (recentMessages >= settings.max_messages_per_second) {
                return handleTimeoutThreat(message, client, settings, {
                    type: 'FLOOD_BLOCKED',
                    title: 'Flood detectado',
                    color: '#faa61a',
                    reason: 'Flood de mensajes',
                    duration: '5 minutes',
                    description: `${message.author.tag} supero el limite de mensajes por segundo.`
                });
            }
        }

        if (!bypass && settings.anti_mentions) {
            const mentionCount = message.mentions.users.size + message.mentions.roles.size;
            if (mentionCount > settings.max_mentions_per_message) {
                return handleTimeoutThreat(message, client, settings, {
                    type: 'MASS_MENTION_BLOCKED',
                    title: 'Menciones masivas detectadas',
                    color: '#eb459e',
                    reason: 'Menciones masivas',
                    duration: '10 minutes',
                    description: `${message.author.tag} envio ${mentionCount} menciones en un solo mensaje.`,
                    metadata: { mentionCount }
                });
            }
        }

        if (!bypass && settings.anti_links) {
            const links = message.content.match(/(https?:\/\/[^\s]+)/g);
            if (links?.length) {
                return handleTimeoutThreat(message, client, settings, {
                    type: 'LINK_BLOCKED',
                    title: 'Enlaces bloqueados',
                    color: '#9b59b6',
                    reason: 'Enlaces no permitidos',
                    duration: '5 minutes',
                    description: `${message.author.tag} envio ${links.length} enlace(s).`,
                    metadata: { links }
                });
            }
        }
    }
};

async function handleTimeoutThreat(message, client, settings, options) {
    await message.delete().catch(() => null);

    if (message.member.moderatable) {
        await message.member.timeout(ms(options.duration), `${options.reason} - Ghostly Guard`).catch(() => null);
    }

    await client.db.logRaid(message.guild.id, message.author.id, message.author.tag, 'TIMEOUT_AUTO', options.reason);
    await createSecurityEvent(client, message.guild, settings, {
        type: options.type,
        severity: 'high',
        title: options.title,
        color: options.color,
        description: options.description,
        target: message.author,
        metadata: {
            channelId: message.channel.id,
            duration: options.duration,
            ...options.metadata
        }
    });
}
