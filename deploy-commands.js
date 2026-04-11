const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { clientId, guildId } = require('./config.json');
require('dotenv').config();

const commandsByName = new Map();
const foldersPath = path.join(__dirname, 'src', 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if (!('data' in command) || !('execute' in command)) {
            console.log(`[WARN] El comando en ${filePath} no exporta data/execute.`);
            continue;
        }

        const json = command.data.toJSON();

        if (commandsByName.has(json.name)) {
            console.log(`[WARN] Comando duplicado detectado y reemplazado: ${json.name} (${filePath})`);
        }

        commandsByName.set(json.name, json);
    }
}

const commands = [...commandsByName.values()];
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Limpiando comandos del servidor de prueba ${guildId}...`);
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });

        console.log(`Registrando ${commands.length} comandos globales para la aplicacion ${clientId}...`);
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );

        console.log('Comandos globales registrados:');
        for (const command of data) {
            console.log(`- /${command.name}`);
        }

        console.log('Registro completado.');
        console.log('Nota: los comandos globales pueden tardar un poco en aparecer en todos los servidores.');
    } catch (error) {
        console.error('Error registrando comandos globales:', error);
        process.exitCode = 1;
    }
})();
