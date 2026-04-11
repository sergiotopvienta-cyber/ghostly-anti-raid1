const { Client, GatewayIntentBits, Collection, Events, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('node:http');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();
client.cooldowns = new Collection();

const commandFolders = fs.readdirSync('./src/commands');
for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(`./src/commands/${folder}`).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./commands/${folder}/${file}`);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[ADVERTENCIA] El comando en ./commands/${folder}/${file} carece de propiedad "data" o "execute".`);
        }
    }
}

const eventFiles = fs.readdirSync('./src/events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

const Database = require('./utils/database');
const db = new Database();

client.db = db;

client.once(Events.ClientReady, c => {
    console.log(`✅ Ghostly Anti-Raid está en línea como ${c.user.tag}`);
    
    client.user.setActivity('🛡️ Protegiendo servidores', { type: ActivityType.Watching });
    
    setInterval(() => {
        const activities = [
            '🛡️ Anti-Raid Activo',
            '⚔️ Protegiendo servidores',
            '🔍 Detectando amenazas',
            '🚨 Seguridad 24/7'
        ];
        const activity = activities[Math.floor(Math.random() * activities.length)];
        client.user.setActivity(activity, { type: ActivityType.Watching });
    }, 30000);
});

process.on('unhandledRejection', error => {
    console.error('Error no manejado:', error);
});

process.on('uncaughtException', error => {
    console.error('Excepción no capturada:', error);
});

const port = Number(process.env.PORT) || 3000;
http
    .createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Ghostly Anti-Raid Bot is running');
    })
    .listen(port, '0.0.0.0', () => {
        console.log(`🌐 HTTP listo en el puerto ${port}`);
    });

client.login(process.env.DISCORD_TOKEN);
