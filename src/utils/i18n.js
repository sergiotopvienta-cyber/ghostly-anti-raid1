const translations = {
    es: {
        welcome: {
            title: '¡Ghostly Guard ha llegado! 🛡️',
            description: 'Gracias por añadirme a tu servidor. Estoy aquí para proteger tu comunidad 24/7.',
            selectLanguage: '**Por favor, selecciona el idioma para este servidor:**',
            languages: {
                es: '🇪🇸 Español',
                en: '🇺🇸 English'
            },
            features: '🛡️ **Mis funciones principales:**',
            featureList: [
                'Anti-Raid: Detecto y bloqueo raids masivos',
                'Anti-Nuke: Protejo contra destrucción del servidor',
                'Anti-Spam: Filtro de mensajes sospechosos',
                'Anti-Bots: Bloqueo bots no autorizados',
                'Backups: Creo copias de seguridad automáticas',
                'Logs: Registro de todas las actividades de seguridad'
            ],
            setup: '⚙️ **Configuración inicial:**',
            setupSteps: [
                'Usa `/config server` para ver la configuración actual',
                'Usa `/alerts channel` para configurar alertas',
                'Usa `/securityscan` para analizar la seguridad'
            ],
            support: '¿Necesitas ayuda? Únete al soporte: {{supportUrl}}',
            premium: '💎 **Ghostly Premium** disponible con funciones avanzadas. Usa `/premium` para más info.'
        },
        commands: {
            config: {
                title: 'Configuración del Servidor',
                protectionLevel: 'Nivel de Protección',
                activeFeatures: '✅ Funciones Activadas',
                inactiveFeatures: '⚪ Funciones Desactivadas',
                limits: '📊 Límites Configurados',
                channels: '📢 Canales Configurados',
                stats: '📈 Estadísticas'
            },
            backup: {
                title: 'Sistema de Backups',
                created: '✅ Backup creado correctamente',
                restored: '✅ Backup restaurado',
                list: '📋 Lista de Backups',
                noBackups: 'No hay backups disponibles'
            },
            alerts: {
                title: 'Sistema de Alertas',
                test: '📤 Alerta de prueba enviada',
                toggled: '✅ Alerta {{type}} {{status}}',
                status: 'Estado de Alertas'
            },
            securityscan: {
                title: '🔍 Escaneo de Seguridad',
                score: 'Puntuación de Seguridad',
                gradeA: 'A+ - Excelente',
                gradeB: 'B - Buena',
                gradeC: 'C - Regular',
                gradeD: 'D - Baja',
                gradeF: 'F - Crítica',
                recommendations: '📋 Recomendaciones'
            }
        },
        errors: {
            noPermission: '❌ No tienes permisos para usar este comando.',
            guildOnly: '❌ Este comando solo funciona en servidores.',
            cooldown: '⏰ Por favor espera {{time}} segundos antes de usar este comando de nuevo.',
            error: '❌ Ha ocurrido un error. Por favor intenta de nuevo más tarde.'
        }
    },
    en: {
        welcome: {
            title: 'Ghostly Guard has arrived! 🛡️',
            description: 'Thanks for adding me to your server. I\'m here to protect your community 24/7.',
            selectLanguage: '**Please select the language for this server:**',
            languages: {
                es: '🇪🇸 Español',
                en: '🇺🇸 English'
            },
            features: '🛡️ **My main features:**',
            featureList: [
                'Anti-Raid: Detect and block mass raids',
                'Anti-Nuke: Protect against server destruction',
                'Anti-Spam: Filter suspicious messages',
                'Anti-Bots: Block unauthorized bots',
                'Backups: Create automatic security copies',
                'Logs: Record all security activities'
            ],
            setup: '⚙️ **Initial setup:**',
            setupSteps: [
                'Use `/config server` to view current configuration',
                'Use `/alerts channel` to setup alerts',
                'Use `/securityscan` to analyze security'
            ],
            support: 'Need help? Join support: {{supportUrl}}',
            premium: '💎 **Ghostly Premium** available with advanced features. Use `/premium` for more info.'
        },
        commands: {
            config: {
                title: 'Server Configuration',
                protectionLevel: 'Protection Level',
                activeFeatures: '✅ Active Features',
                inactiveFeatures: '⚪ Inactive Features',
                limits: '📊 Configured Limits',
                channels: '📢 Configured Channels',
                stats: '📈 Statistics'
            },
            backup: {
                title: 'Backup System',
                created: '✅ Backup created successfully',
                restored: '✅ Backup restored',
                list: '📋 Backup List',
                noBackups: 'No backups available'
            },
            alerts: {
                title: 'Alert System',
                test: '📤 Test alert sent',
                toggled: '✅ {{type}} alert {{status}}',
                status: 'Alert Status'
            },
            securityscan: {
                title: '🔍 Security Scan',
                score: 'Security Score',
                gradeA: 'A+ - Excellent',
                gradeB: 'B - Good',
                gradeC: 'C - Average',
                gradeD: 'D - Low',
                gradeF: 'F - Critical',
                recommendations: '📋 Recommendations'
            }
        },
        errors: {
            noPermission: '❌ You don\'t have permission to use this command.',
            guildOnly: '❌ This command only works in servers.',
            cooldown: '⏰ Please wait {{time}} seconds before using this command again.',
            error: '❌ An error occurred. Please try again later.'
        }
    }
};

class I18n {
    constructor(defaultLang = 'es') {
        this.defaultLang = defaultLang;
        this.guildLanguages = new Map();
    }

    // Obtener idioma del servidor
    getGuildLanguage(guildId) {
        return this.guildLanguages.get(guildId) || this.defaultLang;
    }

    // Establecer idioma del servidor
    setGuildLanguage(guildId, lang) {
        if (translations[lang]) {
            this.guildLanguages.set(guildId, lang);
            return true;
        }
        return false;
    }

    // Traducir una clave
    t(guildId, key, replacements = {}) {
        const lang = this.getGuildLanguage(guildId);
        const keys = key.split('.');
        let value = translations[lang];
        
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                value = undefined;
                break;
            }
        }

        // Si no se encuentra, usar español por defecto
        if (value === undefined && lang !== 'es') {
            value = translations['es'];
            for (const k of keys) {
                if (value && typeof value === 'object') {
                    value = value[k];
                } else {
                    value = undefined;
                    break;
                }
            }
        }

        // Si es array, unir con saltos de línea
        if (Array.isArray(value)) {
            value = value.join('\n');
        }

        // Si no hay valor, devolver la clave
        if (typeof value !== 'string') {
            return key;
        }

        // Reemplazar placeholders
        let result = value;
        for (const [placeholder, replacement] of Object.entries(replacements)) {
            result = result.replace(new RegExp(`{{${placeholder}}}`, 'g'), replacement);
        }

        return result;
    }

    // Obtener todas las traducciones disponibles
    getAvailableLanguages() {
        return Object.keys(translations).map(lang => ({
            code: lang,
            name: translations[lang].welcome.languages[lang] || lang
        }));
    }
}

module.exports = new I18n('es');
