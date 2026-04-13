require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== DEPLOY COMANDOS PARA RAILWAY ===');

// Verificar variables de entorno de Railway
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!DISCORD_TOKEN) {
    console.error('ERROR: DISCORD_TOKEN no está configurado en Railway');
    console.error('Ve a tu proyecto Railway -> Variables -> Agrega DISCORD_TOKEN');
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error('ERROR: CLIENT_ID no está configurado en Railway');
    console.error('Ve a tu proyecto Railway -> Variables -> Agrega CLIENT_ID');
    process.exit(1);
}

console.log('Variables de entorno OK');
console.log(`Client ID: ${CLIENT_ID}`);

// Cargar todos los comandos
const commandsByName = new Map();
const foldersPath = path.join(__dirname, 'src', 'commands');
const commandFolders = fs.readdirSync(foldersPath);

console.log('\nCargando comandos...');

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        
        try {
            const command = require(filePath);

            if (!('data' in command) || !('execute' in command)) {
                console.log(`[WARN] El comando en ${filePath} no exporta data/execute.`);
                continue;
            }

            const json = command.data.toJSON();
            console.log(`  - /${json.name}`);
            commandsByName.set(json.name, json);
        } catch (error) {
            console.error(`[ERROR] Error cargando comando ${file}:`, error.message);
        }
    }
}

const commands = [...commandsByName.values()];
const rest = new REST().setToken(DISCORD_TOKEN);

console.log(`\nTotal de comandos: ${commands.length}`);

(async () => {
    try {
        console.log('\nRegistrando comandos en Discord...');
        
        // Registrar comandos globales
        const data = await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );

        console.log('\n=== COMANDOS REGISTRADOS EXITOSAMENTE ===');
        console.log(`Total: ${data.length} comandos`);
        
        console.log('\nComandos disponibles:');
        for (const command of data) {
            console.log(`  - /${command.name}`);
        }

        console.log('\n=== INSTRUCCIONES ===');
        console.log('1. Los comandos pueden tardar hasta 1 hora en aparecer globalmente');
        console.log('2. Para registro instantáneo en un servidor específico, contacta al soporte de Discord');
        console.log('3. Reinicia tu bot en Railway para asegurar que tome los nuevos comandos');
        
        console.log('\n=== COMANDO AUTOROL ===');
        const autorolCommand = data.find(cmd => cmd.name === 'autorol');
        if (autorolCommand) {
            console.log('  - /autorol está disponible con subcomandos:');
            console.log('    * /autorol set <rol>');
            console.log('    * /autorol remove');
            console.log('    * /autorol status');
        } else {
            console.log('  - /autorol NO se encontró en el registro');
        }

    } catch (error) {
        console.error('\n=== ERROR EN REGISTRO ===');
        console.error('Mensaje:', error.message);
        console.error('Código:', error.code);
        
        if (error.code === 50001) {
            console.error('\nSOLUCIÓN: El bot necesita el permiso "applications.commands"');
            console.error('Re-invita el bot a tu servidor con este permiso activado');
        } else if (error.code === 10013) {
            console.error('\nSOLUCIÓN: Token inválido. Verifica DISCORD_TOKEN en Railway');
        } else if (error.code === 10014) {
            console.error('\nSOLUCIÓN: Client ID inválido. Verifica CLIENT_ID en Railway');
        } else if (error.code === 'ECONNRESET') {
            console.error('\nSOLUCIÓN: Error de conexión. Intenta de nuevo en unos minutos');
        } else if (error.code === 'ETIMEDOUT') {
            console.error('\nSOLUCIÓN: Timeout. Intenta de nuevo');
        }
        
        process.exit(1);
    }
})();
