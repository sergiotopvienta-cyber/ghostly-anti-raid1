const { Events, PermissionFlagsBits } = require('discord.js');
const ms = require('ms');

const { createSecurityEvent, isWhitelisted } = require('../utils/security');

const BANNED_WORDS = ['scam', 'nitro free', 'free nitro', 'steam scam', 'discord scam', 'hack', 'crack', 'exploit'];
const EMOJI_PATTERN = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

const cooldowns = new Map();
const prefix = '!';

function loadPrefixCommands() {
    const commands = new Map();
    const fs = require('fs');
    const path = require('path');
    
    const commandsPath = path.join(__dirname, '../commands/prefix');
    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            commands.set(command.name, command);
        }
    }
    
    return commands;
}

const prefixCommands = loadPrefixCommands();

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // Manejar comandos con prefijo
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const command = prefixCommands.get(commandName);

            if (command) {
                try {
                    await command.execute(message, args, client);
                } catch (error) {
                    console.error(`Error ejecutando comando ${commandName}:`, error);
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('Error')
                        .setColor('#ed4245')
                        .setDescription('Hubo un error al ejecutar el comando.')
                        .setTimestamp();
                    
                    await message.reply({ embeds: [errorEmbed] });
                }
                return;
            }
        }

        const settings = await client.db.getGuildSettings(message.guild.id);
        const whitelisted = await isWhitelisted(client, message.guild.id, message.author.id);
        const bypass = whitelisted || message.member.permissions.has(PermissionFlagsBits.ManageMessages);

        if (settings.lockdown_active && !bypass) {
            await message.delete().catch(() => null);
            return;
        }

        if (!bypass) {
            const cooldownKey = `${message.guild.id}-${message.author.id}`;
            const now = Date.now();
            const userCooldown = cooldowns.get(cooldownKey);

            if (userCooldown && now < userCooldown) {
                const remainingTime = Math.ceil((userCooldown - now) / 1000);
                return message.reply(`Debes esperar ${remainingTime} segundos antes de enviar otro mensaje.`).then(msg => {
                    setTimeout(() => msg.delete().catch(() => null), 3000);
                }).catch(() => null);
            }

            cooldowns.set(cooldownKey, now + 2000);
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
            const links = message.content.match(/(https?:\/\/[^\s]+|discord\.gg\/[^\s]+|discord\.com\/invite\/[^\s]+|discord\.com\/developers\/invite\/[^\s]+|www\.[^\s]+|[a-z0-9]+\.[a-z]{2,}(?:\/[^\s]*)?)/gi);
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

        if (!bypass) {
            await client.db.trackMessageContent(message.guild.id, message.author.id, message.content);

            const duplicateCount = await client.db.getDuplicateMessages(message.guild.id, message.author.id, message.content, 30);
            if (duplicateCount >= 3) {
                return handleTimeoutThreat(message, client, settings, {
                    type: 'DUPLICATE_BLOCKED',
                    title: 'Contenido duplicado detectado',
                    color: '#e67e22',
                    reason: 'Spam de contenido duplicado',
                    duration: '5 minutes',
                    description: `${message.author.tag} envio el mismo mensaje ${duplicateCount} veces.`,
                    metadata: { duplicateCount }
                });
            }
        }

        if (!bypass) {
            const lowerContent = message.content.toLowerCase();
            for (const word of BANNED_WORDS) {
                if (lowerContent.includes(word)) {
                    return handleTimeoutThreat(message, client, settings, {
                        type: 'BANNED_WORD_BLOCKED',
                        title: 'Palabra prohibida detectada',
                        color: '#c0392b',
                        reason: 'Contenido prohibido',
                        duration: '10 minutes',
                        description: `${message.author.tag} uso una palabra prohibida: ${word}`,
                        metadata: { bannedWord: word }
                    });
                }
            }
        }

        if (!bypass) {
            const emojiMatches = message.content.match(EMOJI_PATTERN);
            if (emojiMatches && emojiMatches.length > 10) {
                return handleTimeoutThreat(message, client, settings, {
                    type: 'EMOJI_SPAM_BLOCKED',
                    title: 'Spam de emojis detectado',
                    color: '#f39c12',
                    reason: 'Spam de emojis',
                    duration: '5 minutes',
                    description: `${message.author.tag} envio ${emojiMatches.length} emojis en un solo mensaje.`,
                    metadata: { emojiCount: emojiMatches.length }
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
