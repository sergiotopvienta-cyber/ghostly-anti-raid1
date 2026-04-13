const { Client, GatewayIntentBits, Collection, Events, ActivityType, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('node:http');
require('dotenv').config();

const { ensureWeeklyBackups } = require('./utils/security');
const Database = require('./utils/database');
const { createWebServer } = require('./web/server');
const SnapshotManager = require('./utils/snapshot');

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
client.snapshotManager = new SnapshotManager(client);

async function registerGuildCommands(client) {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID || client.application?.id;

    if (!token || !clientId) {
        console.error('No se pudo registrar comandos por servidor: faltan DISCORD_TOKEN o CLIENT_ID');
        return;
    }

    const commandsByName = new Map();
    const foldersPath = path.join(__dirname, 'commands');
    const commandFolders = fs.readdirSync(foldersPath).filter((folder) => folder !== 'prefix');

    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                if (!('data' in command) || !('execute' in command)) continue;
                const json = command.data.toJSON();
                commandsByName.set(json.name, json);
            } catch (error) {
                console.error(`Error cargando comando ${filePath}:`, error.message);
            }
        }
    }

    const commands = [...commandsByName.values()];
    const rest = new REST().setToken(token);

    for (const [, guild] of client.guilds.cache) {
        try {
            await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: commands });
            await new Promise((resolve) => setTimeout(resolve, 1100));
        } catch (error) {
            console.error(`Error registrando comandos en guild ${guild.id}:`, error.message);
        }
    }
}

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

    await registerGuildCommands(client);

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

http
    .createServer(createWebServer(client))
    .listen(port, '0.0.0.0', () => {
        console.log(`HTTP listo en el puerto ${port}`);
    });

client.login(process.env.DISCORD_TOKEN);
