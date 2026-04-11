require('dotenv').config();
const { REST, Routes } = require('discord.js');

const commands = [
    {
        name: 'ping',
        description: 'Muestra la latencia del bot'
    },
    {
        name: 'help',
        description: 'Muestra la ayuda del bot'
    },
    {
        name: 'settings',
        description: 'Muestra la configuración actual'
    }
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Registrando comandos de prueba...');
        
        const { clientId } = require('./config.json');
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
        
        console.log(`Se registraron ${data.length} comandos exitosamente!`);
    } catch (error) {
        console.error('Error:', error);
    }
})();
