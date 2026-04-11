const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_COOKIE = 'ghostly_session';
const OAUTH_STATE_COOKIE = 'ghostly_oauth_state';
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7;

const sessions = new Map();

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
        const requestUrl = new URL(req.url, getOrigin(req));

        if (requestUrl.pathname.startsWith('/auth/')) {
            return handleAuthRequest(client, req, res, requestUrl);
        }

        if (requestUrl.pathname.startsWith('/api/')) {
            return handleApiRequest(client, req, res, requestUrl);
        }

        // Serve index.html for root, dashboard, and any other routes (SPA routing)
        if (requestUrl.pathname === '/' || requestUrl.pathname.startsWith('/dashboard') || !requestUrl.pathname.includes('.')) {
            return serveStatic('/index.html', res);
        }

        return serveStatic(requestUrl.pathname, res);
    };
}

async function handleAuthRequest(client, req, res, requestUrl) {
    const origin = getOrigin(req);

    if (requestUrl.pathname === '/auth/login') {
        const state = crypto.randomBytes(20).toString('hex');
        const redirectUri = `${origin}/auth/callback`;
        const oauthUrl = new URL('https://discord.com/oauth2/authorize');
        oauthUrl.searchParams.set('client_id', client.application?.id || process.env.CLIENT_ID || '');
        oauthUrl.searchParams.set('response_type', 'code');
        oauthUrl.searchParams.set('scope', 'identify');
        oauthUrl.searchParams.set('redirect_uri', redirectUri);
        oauthUrl.searchParams.set('state', state);

        setCookie(res, OAUTH_STATE_COOKIE, state, {
            maxAge: 60 * 10,
            httpOnly: true
        });

        res.writeHead(302, { Location: oauthUrl.toString() });
        return res.end();
    }

    if (requestUrl.pathname === '/auth/callback') {
        const incomingState = requestUrl.searchParams.get('state');
        const savedState = parseCookies(req)[OAUTH_STATE_COOKIE];
        const code = requestUrl.searchParams.get('code');

        if (!code || !incomingState || incomingState !== savedState) {
            return redirect(res, '/?auth=failed');
        }

        try {
            const redirectUri = `${origin}/auth/callback`;
            const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: client.application?.id || process.env.CLIENT_ID || '',
                    client_secret: process.env.DISCORD_CLIENT_SECRET || '',
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: redirectUri
                })
            });

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                console.error('OAuth token error:', errorText);
                return redirect(res, '/?auth=failed');
            }

            const tokenData = await tokenResponse.json();
            const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });

            if (!userResponse.ok) {
                return redirect(res, '/?auth=failed');
            }

            const user = await userResponse.json();
            const sessionId = crypto.randomBytes(24).toString('hex');
            sessions.set(sessionId, {
                id: sessionId,
                user,
                createdAt: Date.now(),
                expiresAt: Date.now() + SESSION_TTL
            });

            setCookie(res, SESSION_COOKIE, sessionId, {
                maxAge: SESSION_TTL / 1000,
                httpOnly: true
            });
            clearCookie(res, OAUTH_STATE_COOKIE);

            return redirect(res, '/dashboard?auth=success');
        } catch (error) {
            console.error('OAuth callback error:', error);
            return redirect(res, '/?auth=failed');
        }
    }

    if (requestUrl.pathname === '/auth/logout') {
        const sessionId = parseCookies(req)[SESSION_COOKIE];
        if (sessionId) {
            sessions.delete(sessionId);
        }

        clearCookie(res, SESSION_COOKIE);
        return redirect(res, '/?auth=logout');
    }

    return sendJson(res, 404, { error: 'Ruta auth no encontrada' });
}

async function handleApiRequest(client, req, res, requestUrl) {
    try {
        const session = getSession(req);

        if (requestUrl.pathname === '/api/health') {
            return sendJson(res, 200, {
                ok: true,
                botReady: Boolean(client.user),
                uptimeMs: process.uptime() * 1000
            });
        }

        if (requestUrl.pathname === '/api/session') {
            if (!session) {
                return sendJson(res, 200, { authenticated: false, user: null, guilds: [] });
            }

            const guilds = await buildAllowedGuildList(client, session.user.id);
            return sendJson(res, 200, {
                authenticated: true,
                user: decorateUser(session.user),
                guilds
            });
        }

        if (!session) {
            return sendJson(res, 401, { error: 'Necesitas iniciar sesion' });
        }

        if (requestUrl.pathname === '/api/overview') {
            return sendJson(res, 200, await buildOverviewPayload(client, session.user.id));
        }

        if (requestUrl.pathname === '/api/guilds') {
            return sendJson(res, 200, { guilds: await buildAllowedGuildList(client, session.user.id) });
        }

        const guildDetailMatch = requestUrl.pathname.match(/^\/api\/guilds\/(\d+)$/);
        if (guildDetailMatch) {
            const guildId = guildDetailMatch[1];
            const payload = await buildGuildDetail(client, guildId, session.user.id);
            if (!payload) {
                return sendJson(res, 404, { error: 'Guild no encontrada o sin acceso' });
            }
            return sendJson(res, 200, payload);
        }

        const settingsMatch = requestUrl.pathname.match(/^\/api\/guilds\/(\d+)\/settings$/);
        if (settingsMatch && req.method === 'PATCH') {
            const guildId = settingsMatch[1];
            const guild = await requireGuildAccess(client, guildId, session.user.id);
            if (!guild) {
                return sendJson(res, 403, { error: 'Sin acceso a este servidor' });
            }

            const body = await readJsonBody(req);
            const allowedKeys = new Set([
                'anti_raid',
                'anti_nuke',
                'anti_flood',
                'anti_bots',
                'anti_alts',
                'anti_links',
                'anti_mentions',
                'anti_bot_verified_only',
                'lockdown_active',
                'max_joins_per_minute',
                'max_messages_per_second',
                'max_mentions_per_message',
                'min_account_age_days',
                'log_channel',
                'alert_channel',
                'welcome_channel',
                'verification_role'
            ]);

            const updates = {};
            for (const [key, value] of Object.entries(body)) {
                if (allowedKeys.has(key)) {
                    updates[key] = value;
                }
            }

            await client.db.updateGuildSettings(guild.id, updates);
            return sendJson(res, 200, { ok: true });
        }

        const listMatch = requestUrl.pathname.match(/^\/api\/guilds\/(\d+)\/(whitelist|bots|bans|owners)$/);
        if (listMatch) {
            const guildId = listMatch[1];
            const section = listMatch[2];
            const guild = await requireGuildAccess(client, guildId, session.user.id);
            if (!guild) {
                return sendJson(res, 403, { error: 'Sin acceso a este servidor' });
            }

            if (req.method === 'POST') {
                const body = await readJsonBody(req);
                return handleSectionCreate(client, guild, session.user.id, section, body, res);
            }
        }

        const sectionDeleteMatch = requestUrl.pathname.match(/^\/api\/guilds\/(\d+)\/(whitelist|bots|bans|owners)\/(\d+)$/);
        if (sectionDeleteMatch && req.method === 'DELETE') {
            const guildId = sectionDeleteMatch[1];
            const section = sectionDeleteMatch[2];
            const targetId = sectionDeleteMatch[3];
            const guild = await requireGuildAccess(client, guildId, session.user.id);
            if (!guild) {
                return sendJson(res, 403, { error: 'Sin acceso a este servidor' });
            }

            return handleSectionDelete(client, guild, session.user.id, section, targetId, res);
        }

        const backupMatch = requestUrl.pathname.match(/^\/api\/guilds\/(\d+)\/backups$/);
        if (backupMatch && req.method === 'POST') {
            const guildId = backupMatch[1];
            const guild = await requireGuildAccess(client, guildId, session.user.id);
            if (!guild) {
                return sendJson(res, 403, { error: 'Sin acceso a este servidor' });
            }

            const { createGuildBackup } = require('../utils/security');
            const filePath = await createGuildBackup(client, guild, 'manual', session.user.id);
            return sendJson(res, 200, { ok: true, filePath });
        }

        return sendJson(res, 404, { error: 'Ruta no encontrada' });
    } catch (error) {
        console.error('Error en API web:', error);
        return sendJson(res, 500, { error: 'Error interno del dashboard' });
    }
}

async function handleSectionCreate(client, guild, viewerUserId, section, body, res) {
    if (section === 'owners') {
        if (viewerUserId !== guild.ownerId) {
            return sendJson(res, 403, { error: 'Solo el owner real puede gestionar owners secundarios' });
        }

        if (!body.userId) {
            return sendJson(res, 400, { error: 'Falta userId' });
        }

        await client.db.addTrustedUser(guild.id, body.userId, 'owner', viewerUserId);
        return sendJson(res, 200, { ok: true });
    }

    if (section === 'whitelist') {
        if (!body.userId) {
            return sendJson(res, 400, { error: 'Falta userId' });
        }

        await client.db.addTrustedUser(guild.id, body.userId, 'whitelist', viewerUserId);
        return sendJson(res, 200, { ok: true });
    }

    if (section === 'bots') {
        if (!body.userId) {
            return sendJson(res, 400, { error: 'Falta userId' });
        }

        await client.db.addTrustedUser(guild.id, body.userId, 'bot', viewerUserId);
        return sendJson(res, 200, { ok: true });
    }

    if (section === 'bans') {
        if (!body.userId) {
            return sendJson(res, 400, { error: 'Falta userId' });
        }

        await client.db.addPermanentBan(guild.id, body.userId, body.reason || 'Ban permanente desde dashboard', viewerUserId);
        try {
            await guild.members.ban(body.userId, { reason: body.reason || 'Ban permanente desde dashboard' });
        } catch (error) {
            console.error(`No se pudo banear de inmediato a ${body.userId}:`, error.message);
        }

        return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 400, { error: 'Seccion no soportada' });
}

async function handleSectionDelete(client, guild, viewerUserId, section, targetId, res) {
    if (section === 'owners') {
        if (viewerUserId !== guild.ownerId) {
            return sendJson(res, 403, { error: 'Solo el owner real puede gestionar owners secundarios' });
        }

        await client.db.removeTrustedUser(guild.id, targetId, 'owner');
        return sendJson(res, 200, { ok: true });
    }

    if (section === 'whitelist') {
        await client.db.removeTrustedUser(guild.id, targetId, 'whitelist');
        return sendJson(res, 200, { ok: true });
    }

    if (section === 'bots') {
        await client.db.removeTrustedUser(guild.id, targetId, 'bot');
        return sendJson(res, 200, { ok: true });
    }

    if (section === 'bans') {
        await client.db.removePermanentBan(guild.id, targetId);
        return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 400, { error: 'Seccion no soportada' });
}

async function buildOverviewPayload(client, viewerUserId) {
    const guilds = await getAllowedGuilds(client, viewerUserId);
    const eventCounts = [];
    const recentEvents = [];
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

        const guildCounts = await client.db.getSecurityEventCounts(guild.id);
        for (const item of guildCounts) {
            const existing = eventCounts.find((entry) => entry.severity === item.severity);
            if (existing) {
                existing.total += item.total;
            } else {
                eventCounts.push({ severity: item.severity, total: item.total });
            }
        }

        const guildEvents = await client.db.getRecentSecurityEvents(guild.id, 4);
        recentEvents.push(...guildEvents.map((event) => ({ ...event, guild_name: guild.name })));
    }

    recentEvents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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
        recentEvents: recentEvents.slice(0, 10)
    };
}

async function buildAllowedGuildList(client, viewerUserId) {
    const guilds = await getAllowedGuilds(client, viewerUserId);
    const items = [];

    for (const guild of guilds) {
        const settings = await client.db.getGuildSettings(guild.id);
        const incidents = await client.db.getRecentSecurityEvents(guild.id, 3);
        const access = await getGuildAccessLevel(client, guild, viewerUserId);

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
            accessLevel: access,
            incidents: incidents.length
        });
    }

    return items.sort((a, b) => b.memberCount - a.memberCount);
}

async function buildGuildDetail(client, guildId, viewerUserId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;

    const accessLevel = await getGuildAccessLevel(client, guild, viewerUserId);
    if (!accessLevel) return null;

    const settings = await client.db.getGuildSettings(guildId);
    const recentEvents = await client.db.getRecentSecurityEvents(guildId, 16);
    const whitelist = await client.db.listTrustedUsers(guildId, 'whitelist');
    const owners = await client.db.listTrustedUsers(guildId, 'owner');
    const bots = await client.db.listTrustedUsers(guildId, 'bot');
    const bans = await client.db.listPermanentBans(guildId);
    const backups = await client.db.listBackups(guildId, 8);
    const severities = await client.db.getSecurityEventCounts(guildId);

    return {
        accessLevel,
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

async function getAllowedGuilds(client, viewerUserId) {
    const guilds = [...client.guilds.cache.values()];
    const allowed = [];

    for (const guild of guilds) {
        const access = await getGuildAccessLevel(client, guild, viewerUserId);
        if (access) {
            allowed.push(guild);
        }
    }

    return allowed;
}

async function requireGuildAccess(client, guildId, viewerUserId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;
    const access = await getGuildAccessLevel(client, guild, viewerUserId);
    return access ? guild : null;
}

async function getGuildAccessLevel(client, guild, viewerUserId) {
    if (!viewerUserId) return null;
    if (viewerUserId === guild.ownerId) return 'owner';
    if (await client.db.isTrustedUser(guild.id, viewerUserId, 'owner')) return 'secondary_owner';
    return null;
}

function getSession(req) {
    const sessionId = parseCookies(req)[SESSION_COOKIE];
    if (!sessionId) return null;

    const session = sessions.get(sessionId);
    if (!session) return null;

    if (session.expiresAt < Date.now()) {
        sessions.delete(sessionId);
        return null;
    }

    return session;
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

async function readJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
}

function parseCookies(req) {
    const header = req.headers.cookie || '';
    return Object.fromEntries(
        header
            .split(';')
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
                const index = part.indexOf('=');
                const key = part.slice(0, index);
                const value = part.slice(index + 1);
                return [key, decodeURIComponent(value)];
            })
    );
}

function setCookie(res, name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
    if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
    if (options.httpOnly) parts.push('HttpOnly');
    if (process.env.NODE_ENV === 'production') parts.push('Secure');
    appendSetCookie(res, parts.join('; '));
}

function clearCookie(res, name) {
    appendSetCookie(res, `${name}=; Path=/; Max-Age=0; SameSite=Lax`);
}

function appendSetCookie(res, cookieValue) {
    const current = res.getHeader('Set-Cookie');
    if (!current) {
        res.setHeader('Set-Cookie', [cookieValue]);
        return;
    }

    const next = Array.isArray(current) ? current.concat(cookieValue) : [current, cookieValue];
    res.setHeader('Set-Cookie', next);
}

function getOrigin(req) {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:3000';
    return `${proto}://${host}`;
}

function redirect(res, location) {
    res.writeHead(302, { Location: location });
    res.end();
}

function decorateUser(user) {
    return {
        id: user.id,
        username: user.username,
        global_name: user.global_name,
        avatar: user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
            : null
    };
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
