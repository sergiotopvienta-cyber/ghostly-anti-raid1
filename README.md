# Ghostly Anti-Raid Bot

Un bot anti-raid completo para Discord similar a XNProtect, diseñado para proteger tu servidor de ataques masivos, raids y amenazas de seguridad.

## Características

### Anti-Raid
- Detección automática de raids por tasa de joins
- Protección contra cuentas alternativas (alts)
- Detección de bots externos no autorizados
- Sistema de verificación para nuevos miembros

### Anti-Nuke
- Protección contra eliminación masiva de roles
- Protección contra eliminación masiva de canales
- Detección de cambios masivos de roles
- Prevención de kicks y bans masivos

### Anti-Spam
- Protección contra flood de mensajes
- Detección de menciones masivas
- Bloqueo de enlaces no deseados
- Sistema de sanciones progresivas

### Sistema de Logs
- Registro completo de eventos de seguridad
- Logs de entradas y salidas
- Auditoría de acciones de moderación
- Alertas en tiempo real

## Instalación

1. Clona este repositorio:
```bash
git clone https://github.com/tu-usuario/ghostly-anti-raid.git
cd ghostly-anti-raid
```

2. Instala las dependencias:
```bash
npm install
```

3. Copia el archivo `.env.example` a `.env` y configura tus variables:
```bash
cp .env.example .env
```

4. Edita el archivo `.env` con tus datos:
```
DISCORD_TOKEN=tu_token_de_bot
CLIENT_ID=tu_id_de_cliente
GUILD_ID=tu_id_de_servidor_de_prueba
OWNER_ID=tu_id_de_usuario
```

5. Inicia el bot:
```bash
npm start
```

Para desarrollo:
```bash
npm run dev
```

## Comandos Principales

### Administración
- `/settings` - Muestra la configuración actual
- `/setup` - Configura canales principales
- `/antiraid enable/disable` - Activa/desactiva anti-raid
- `/antiraid config` - Configura parámetros anti-raid
- `/antinuke enable/disable` - Activa/desactiva anti-nuke

### Utilidad
- `/help` - Muestra la ayuda
- `/ping` - Muestra la latencia del bot
- `/stats` - Muestra estadísticas del servidor

## Configuración

### Configuración Básica
1. Usa `/setup` para configurar:
   - Canal de logs
   - Canal de bienvenida
   - Rol de verificación

### Configuración Anti-Raid
1. Activa el sistema: `/antiraid enable`
2. Configura los parámetros: `/antiraid config`
   - `max_joins`: Máximo de joins por minuto (default: 5)
   - `min_account_age`: Edad mínima de cuenta en días (default: 7)

### Configuración Anti-Nuke
1. Activa el sistema: `/antinuke enable`
2. El sistema protegerá automáticamente contra:
   - Eliminación masiva de roles/canales
   - Cambios masivos de roles
   - Kicks/bans masivos

## Permisos Requeridos

El bot necesita los siguientes permisos para funcionar correctamente:

### Esenciales
- Administrador (recomendado)
- Banear miembros
- Expulsar miembros
- Gestionar roles
- Gestionar canales
- Ver registros de auditoría

### Opcionales
- Enviar mensajes
- Gestionar mensajes
- Usar comandos de barra diagonal

## Estructura del Proyecto

```
src/
|-- commands/
|   |-- admin/          # Comandos de administración
|   |-- security/       # Comandos de seguridad
|   |-- utility/        # Comandos de utilidad
|-- events/            # Eventos del bot
|-- utils/             # Utilidades y base de datos
|-- index.js           # Archivo principal
data/                  # Base de datos SQLite
.env.example           # Variables de entorno
package.json           # Dependencias
README.md              # Documentación
```

## Tecnologías Utilizadas

- **Discord.js v14** - Interacción con la API de Discord
- **SQLite3** - Base de datos ligera
- **Moment.js** - Manejo de fechas
- **Node.js** - Entorno de ejecución

## Funcionalidades Detalladas

### Anti-Raid
- Monitorea la tasa de nuevos miembros
- Detecta patrones anómalos de joins
- Aplica sanciones automáticas
- Restringe acciones de cuentas nuevas

### Anti-Nuke
- Monitorea logs de auditoría
- Detecta eliminaciones masivas
- Revierte cambios no autorizados
- Aplica timeouts a ejecutores

### Anti-Spam
- Limita mensajes por segundo
- Detecta menciones masivas
- Bloquea enlaces no deseados
- Sistema de cooldowns

## Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature
3. Haz commit de tus cambios
4. Push a la rama
5. Abre un Pull Request

## Soporte

Si necesitas ayuda o tienes algún problema:

1. Revisa la documentación
2. Verifica la configuración
3. Contacta al desarrollador

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo LICENSE para más detalles.

## Agradecimientos

- Inspirado en XNProtect y otros bots anti-raid
- Gracias a la comunidad de Discord.js
- Desarrollado con seguridad y rendimiento en mente

---

**Ghostly Anti-Raid - Protección 24/7 para tu servidor Discord**
