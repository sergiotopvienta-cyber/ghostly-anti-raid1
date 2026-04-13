const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { clientId, guildId } = require('./config.json');
require('dotenv').config();

const commandsByName = new Map();
const foldersPath = path.join(__dirname, 'src', 'commands');
const commandFolders = fs.readdirSync(foldersPath).filter((folder) => folder !== 'prefix');

console.log('Cargando comandos desde:', foldersPath);
console.log('Carpetas encontradas:', commandFolders);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

    console.log(`\nCarpeta ${folder}:`);
    console.log('Archivos encontrados:', commandFiles);

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        console.log(`Cargando comando: ${file}`);
        
        try {
            const command = require(filePath);

            if (!('data' in command) || !('execute' in command)) {
                console.log(`[WARN] El comando en ${filePath} no exporta data/execute.`);
                continue;
            }

            const json = command.data.toJSON();
            console.log(`✅ Comando cargado: /${json.name}`);

            if (commandsByName.has(json.name)) {
                console.log(`[WARN] Comando duplicado detectado y reemplazado: ${json.name} (${filePath})`);
            }

            commandsByName.set(json.name, json);
        } catch (error) {
            console.error(`[ERROR] Error cargando comando ${file}:`, error.message);
        }
    }
}

const commands = [...commandsByName.values()];
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

console.log(`\nTotal de comandos a registrar: ${commands.length}`);
console.log('Comandos:', commands.map(c => `/${c.name}`).join(', '));

(async () => {
    try {
        // Verificar que tenemos las credenciales necesarias
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('DISCORD_TOKEN no está definido en las variables de entorno');
        }
        if (!process.env.CLIENT_ID) {
            throw new Error('CLIENT_ID no está definido en las variables de entorno');
        }

        console.log(`\n=== Iniciando registro de comandos ===`);
        console.log(`Client ID: ${process.env.CLIENT_ID}`);
        
        // Primero registrar comandos globales
        console.log(`\nRegistrando ${commands.length} comandos globales...`);
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log('\n=== Comandos registrados exitosamente ===');
        console.log(`Total de comandos registrados: ${data.length}`);
        console.log('Comandos:');
        for (const command of data) {
            console.log(`  - /${command.name}`);
        }

        console.log('\n=== Registro completado ===');
        console.log('Nota: Los comandos globales pueden tardar hasta 1 hora en aparecer en todos los servidores.');
        console.log('Para registro instantáneo en un servidor específico, usa el modo de desarrollo.');

    } catch (error) {
        console.error('\n=== ERROR EN REGISTRO DE COMANDOS ===');
        console.error('Mensaje de error:', error.message);
        
        if (error.code === 50001) {
            console.error('Error: Acceso denegado. Verifica que el bot tenga los permisos necesarios.');
        } else if (error.code === 10013) {
            console.error('Error: Token inválido. Verifica tu DISCORD_TOKEN.');
        } else if (error.code === 10014) {
            console.error('Error: Aplicación no encontrada. Verifica tu CLIENT_ID.');
        }
        
        console.error('Stack completo:', error.stack);
        process.exitCode = 1;
    }
})();
