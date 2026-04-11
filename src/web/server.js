const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PUBLIC_DIR = path.join(__dirname, 'public');
const ASSET_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
};

function createWebServer(client) {
    return async (req, res) => {
        const requestUrl = new URL(req.url, 'http://127.0.0.1');

        if (requestUrl.pathname.startsWith('/api/')) {
            return handleApiRequest(client, req, res, requestUrl);
        }

        return serveStatic(requestUrl.pathname, res);
    };
}

async function handleApiRequest(client, req, res, requestUrl) {
    try {
        if (requestUrl.pathname === '/api/health') {
            return sendJson(res, 200, {
                ok: true,
                botReady: Boolean(client.user),
                uptimeMs: process.uptime() * 1000
            });
        }

        if (requestUrl.pathname === '/api/overview') {
            const payload = await buildOverviewPayload(client);
            return sendJson(res, 200, payload);
        }

        if (requestUrl.pathname === '/api/guilds') {
            const guilds = await buildGuildList(client);
            return sendJson(res, 200, { guilds });
        }

        const guildMatch = requestUrl.pathname.match(/^\/api\/guilds\/(\d+)$/);
        if (guildMatch) {
            const guildId = guildMatch[1];
            const payload = await buildGuildDetail(client, guildId);

            if (!payload) {
                return sendJson(res, 404, { error: 'Guild no encontrada' });
            }

            return sendJson(res, 200, payload);
        }

        return sendJson(res, 404, { error: 'Ruta no encontrada' });
    } catch (error) {
        console.error('Error en API web:', error);
        return sendJson(res, 500, { error: 'Error interno del dashboard' });
    }
}

async function buildOverviewPayload(client) {
    const guilds = [...client.guilds.cache.values()];
    const eventCounts = await client.db.getSecurityEventCounts();
    const recentEvents = await client.db.getGlobalRecentSecurityEvents(10);

    let totalMembers = 0;
    let lockdownGuilds = 0;
    let whitelistEntries = 0;
    let permanentBans = 0;

    for (const guild of guilds) {
        const settings = await client.db.getGuildSettings(guild.id);
        totalMembers += guild.memberCount || 0;
        lockdownGuilds += settings.lockdown_active ? 1 : 0;
        whitelistEntries += (await client.db.listTrustedUsers(guild.id, 'whitelist')).length;
        permanentBans += (await client.db.listPermanentBans(guild.id)).length;
    }

    return {
        bot: {
            name: client.user?.username || 'Ghostly Guard',
            tag: client.user?.tag || 'offline',
            avatar: client.user?.displayAvatarURL() || null
        },
        app: {
            clientId: client.application?.id || process.env.CLIENT_ID || null
        },
        stats: {
            totalGuilds: guilds.length,
            totalMembers,
            lockdownGuilds,
            whitelistEntries,
            permanentBans,
            uptimeHours: Number((process.uptime() / 3600).toFixed(1))
        },
        eventCounts,
        recentEvents
    };
}

async function buildGuildList(client) {
    const guilds = [...client.guilds.cache.values()];
    const items = [];

    for (const guild of guilds) {
        const settings = await client.db.getGuildSettings(guild.id);
        const incidents = await client.db.getRecentSecurityEvents(guild.id, 3);

        items.push({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
            memberCount: guild.memberCount || 0,
            features: {
                antiRaid: Boolean(settings.anti_raid),
                antiNuke: Boolean(settings.anti_nuke),
                lockdown: Boolean(settings.lockdown_active)
            },
            incidents: incidents.length
        });
    }

    return items.sort((a, b) => b.memberCount - a.memberCount);
}

async function buildGuildDetail(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;

    const settings = await client.db.getGuildSettings(guildId);
    const recentEvents = await client.db.getRecentSecurityEvents(guildId, 12);
    const whitelist = await client.db.listTrustedUsers(guildId, 'whitelist');
    const owners = await client.db.listTrustedUsers(guildId, 'owner');
    const bots = await client.db.listTrustedUsers(guildId, 'bot');
    const bans = await client.db.listPermanentBans(guildId);
    const backups = await client.db.listBackups(guildId, 6);
    const severities = await client.db.getSecurityEventCounts(guildId);

    return {
        guild: {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
            memberCount: guild.memberCount || 0,
            ownerId: guild.ownerId
        },
        settings,
        counts: {
            whitelist: whitelist.length,
            owners: owners.length,
            authorizedBots: bots.length,
            permanentBans: bans.length,
            backups: backups.length
        },
        severityCounts: severities,
        recentEvents,
        whitelist,
        owners,
        bots,
        bans,
        backups
    };
}

function serveStatic(pathname, res) {
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.join(PUBLIC_DIR, safePath);
    const normalized = path.normalize(filePath);

    if (!normalized.startsWith(PUBLIC_DIR)) {
        return sendText(res, 403, 'Forbidden');
    }

    let targetPath = normalized;
    if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
        targetPath = path.join(PUBLIC_DIR, 'index.html');
    }

    if (!fs.existsSync(targetPath)) {
        return sendText(res, 404, 'Not Found');
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = ASSET_TYPES[ext] || 'application/octet-stream';
    const file = fs.readFileSync(targetPath);

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(file);
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(text);
}

module.exports = {
    createWebServer
};
