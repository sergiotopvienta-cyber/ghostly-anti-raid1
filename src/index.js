const { Client, GatewayIntentBits, Collection, Events, ActivityType } = require('discord.js');
const fs = require('fs');
const http = require('node:http');
const zlib = require('node:zlib');
require('dotenv').config();

const { ensureWeeklyBackups } = require('./utils/security');
const Database = require('./utils/database');
const { createWebServer } = require('./web/server');

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
    const commandFiles = fs.readdirSync(`./src/commands/${folder}`).filter((file) => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./commands/${folder}/${file}`);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARN] El comando ./commands/${folder}/${file} no exporta data/execute.`);
        }
    }
}

const eventFiles = fs.readdirSync('./src/events').filter((file) => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

client.db = new Database();

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Ghostly Guard en linea como ${readyClient.user.tag}`);

    client.user.setActivity('Protegiendo servidores', { type: ActivityType.Watching });

    setInterval(() => {
        const activities = [
            'Anti-Raid activo',
            'Protegiendo servidores',
            'Detectando amenazas',
            'Seguridad 24/7'
        ];
        const activity = activities[Math.floor(Math.random() * activities.length)];
        client.user.setActivity(activity, { type: ActivityType.Watching });
    }, 30000);

    for (const [, guild] of client.guilds.cache) {
        await client.db.ensureGuildSettings(guild.id);
    }

    await ensureWeeklyBackups(client);
    setInterval(() => {
        ensureWeeklyBackups(client).catch((error) => {
            console.error('Error en el ciclo de backups:', error);
        });
    }, 6 * 60 * 60 * 1000);
});

process.on('unhandledRejection', (error) => {
    console.error('Error no manejado:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Excepcion no capturada:', error);
});

const port = Number(process.env.PORT) || 3000;

// Compression middleware
function createCompressedServer(handler) {
    return (req, res) => {
        // Check if client accepts gzip
        const acceptEncoding = req.headers['accept-encoding'] || '';
        const supportsGzip = acceptEncoding.includes('gzip');
        
        if (supportsGzip) {
            const gzip = zlib.createGzip();
            const originalWrite = res.write;
            const originalEnd = res.end;
            const chunks = [];
            
            res.write = function(chunk) {
                chunks.push(Buffer.from(chunk));
                return true;
            };
            
            res.end = function(chunk) {
                if (chunk) chunks.push(Buffer.from(chunk));
                const body = Buffer.concat(chunks);
                
                if (body.length > 1024) { // Only compress if > 1KB
                    res.setHeader('Content-Encoding', 'gzip');
                    gzip.write(body);
                    gzip.end();
                    gzip.pipe(res);
                } else {
                    originalWrite.call(res, body);
                    originalEnd.call(res);
                }
            };
        }
        
        handler(req, res);
    };
}

http
    .createServer(createCompressedServer(createWebServer(client)))
    .listen(port, '0.0.0.0', () => {
        console.log(`HTTP listo en el puerto ${port}`);
    });

client.login(process.env.DISCORD_TOKEN);
