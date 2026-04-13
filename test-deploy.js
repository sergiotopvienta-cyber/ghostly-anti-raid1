require('dotenv').config();
const { REST, Routes } = require('discord.js');

// Test simple con solo el comando autorol
const commands = [
    {
        name: 'autorol',
        description: 'Configurar el rol automático para nuevos miembros',
        options: [
            {
                name: 'set',
                description: 'Establecer el rol automático',
                type: 1, // SUB_COMMAND
                options: [
                    {
                        name: 'rol',
                        description: 'El rol que se asignará automáticamente',
                        type: 8, // ROLE
                        required: true
                    }
                ]
            },
            {
                name: 'remove',
                description: 'Eliminar el rol automático',
                type: 1 // SUB_COMMAND
            },
            {
                name: 'status',
                description: 'Ver el estado del rol automático',
                type: 1 // SUB_COMMAND
            }
        ],
        default_member_permissions: 8 // Administrator
    }
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('=== TEST DEPLOY AUTOROL ===');
        console.log('Verificando variables de entorno...');
        
        if (!process.env.DISCORD_TOKEN) {
            console.error('ERROR: DISCORD_TOKEN no está definido');
            process.exit(1);
        }
        
        if (!process.env.CLIENT_ID) {
            console.error('ERROR: CLIENT_ID no está definido');
            process.exit(1);
        }
        
        console.log(`Client ID: ${process.env.CLIENT_ID}`);
        console.log('Token: [OK]');
        
        console.log('\nRegistrando comando /autorol...');
        
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        
        console.log(`\n=== ÉXITO ===`);
        console.log(`Se registraron ${data.length} comandos exitosamente!`);
        console.log('Comandos registrados:');
        for (const cmd of data) {
            console.log(`  - /${cmd.name}`);
        }
        console.log('\nEl comando /autorol debería aparecer en Discord en unos minutos.');
        
    } catch (error) {
        console.error('\n=== ERROR ===');
        console.error('Mensaje:', error.message);
        console.error('Código:', error.code);
        console.error('Stack:', error.stack);
        
        if (error.code === 50001) {
            console.error('\nSOLUCIÓN: El bot necesita el permiso "applications.commands" en Discord.');
        } else if (error.code === 10013) {
            console.error('\nSOLUCIÓN: Token inválido. Verifica tu DISCORD_TOKEN.');
        } else if (error.code === 10014) {
            console.error('\nSOLUCIÓN: Client ID inválido. Verifica tu CLIENT_ID.');
        }
        
        process.exit(1);
    }
})();
