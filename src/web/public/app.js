const state = {
    overview: null,
    guilds: [],
    selectedGuildId: null
};

const heroStats = document.getElementById('hero-stats');
const overviewCards = document.getElementById('overview-cards');
const serverList = document.getElementById('server-list');
const serverCount = document.getElementById('server-count');
const guildSummary = document.getElementById('guild-summary');
const moduleStatus = document.getElementById('module-status');
const severityList = document.getElementById('severity-list');
const eventList = document.getElementById('event-list');
const controlLists = document.getElementById('control-lists');
const backupList = document.getElementById('backup-list');
const inviteLink = document.getElementById('invite-link');

init().catch((error) => {
    console.error('Error cargando dashboard:', error);
});

async function init() {
    const [overview, guilds] = await Promise.all([
        fetchJson('/api/overview'),
        fetchJson('/api/guilds')
    ]);

    state.overview = overview;
    state.guilds = guilds.guilds;
    state.selectedGuildId = state.guilds[0]?.id || null;

    renderOverview();
    renderGuildList();

    if (state.selectedGuildId) {
        await loadGuild(state.selectedGuildId);
    }
}

async function loadGuild(guildId) {
    state.selectedGuildId = guildId;
    renderGuildList();

    const detail = await fetchJson(`/api/guilds/${guildId}`);
    renderGuildDetail(detail);
}

function renderOverview() {
    const { stats, eventCounts, bot, app } = state.overview;
    const totalEvents = eventCounts.reduce((sum, item) => sum + item.total, 0);

    heroStats.innerHTML = `
        <article><span class="stat-value">${stats.totalGuilds}</span><span class="stat-label">Servidores</span></article>
        <article><span class="stat-value">${formatNumber(stats.totalMembers)}</span><span class="stat-label">Miembros</span></article>
        <article><span class="stat-value">${totalEvents}</span><span class="stat-label">Eventos</span></article>
    `;

    overviewCards.innerHTML = `
        <article class="metric-card">
            <h3>Bot online</h3>
            <p>${bot.tag}</p>
            <strong>${stats.uptimeHours}h</strong>
        </article>
        <article class="metric-card">
            <h3>Lockdowns activos</h3>
            <p>Servidores protegidos</p>
            <strong>${stats.lockdownGuilds}</strong>
        </article>
        <article class="metric-card">
            <h3>Whitelist entries</h3>
            <p>Usuarios de confianza</p>
            <strong>${stats.whitelistEntries}</strong>
        </article>
        <article class="metric-card">
            <h3>Bans permanentes</h3>
            <p>Reingreso bloqueado</p>
            <strong>${stats.permanentBans}</strong>
        </article>
    `;

    if (app.clientId) {
        inviteLink.href = `https://discord.com/oauth2/authorize?client_id=${app.clientId}&scope=bot%20applications.commands`;
    }
}

function renderGuildList() {
    serverCount.textContent = state.guilds.length;

    serverList.innerHTML = state.guilds.map((guild) => `
        <button class="server-item ${guild.id === state.selectedGuildId ? 'active' : ''}" data-guild-id="${guild.id}">
            <strong>${escapeHtml(guild.name)}</strong>
            <small>${formatNumber(guild.memberCount)} miembros</small>
            <small>${guild.features.lockdown ? 'Lockdown activo' : 'Proteccion estable'}</small>
        </button>
    `).join('');

    for (const button of serverList.querySelectorAll('[data-guild-id]')) {
        button.addEventListener('click', () => loadGuild(button.dataset.guildId));
    }
}

function renderGuildDetail(detail) {
    const { guild, settings, counts, severityCounts, recentEvents, backups } = detail;

    guildSummary.innerHTML = `
        <article class="mini-tile">
            <span class="mini-label">Servidor</span>
            <span class="mini-value">${escapeHtml(guild.name)}</span>
        </article>
        <article class="mini-tile">
            <span class="mini-label">Miembros</span>
            <span class="mini-value">${formatNumber(guild.memberCount)}</span>
        </article>
        <article class="mini-tile">
            <span class="mini-label">Whitelist</span>
            <span class="mini-value">${counts.whitelist}</span>
        </article>
        <article class="mini-tile">
            <span class="mini-label">Backups</span>
            <span class="mini-value">${counts.backups}</span>
        </article>
    `;

    moduleStatus.innerHTML = [
        pill('Anti-Raid', settings.anti_raid),
        pill('Anti-Nuke', settings.anti_nuke),
        pill('Anti-Flood', settings.anti_flood),
        pill('Anti-Bots', settings.anti_bots),
        pill('Anti-Alts', settings.anti_alts),
        pill('Lockdown', settings.lockdown_active)
    ].join('');

    severityList.innerHTML = severityCounts.length
        ? severityCounts.map((item) => `
            <div class="stack-item">
                <strong class="severity-${item.severity}">${item.severity.toUpperCase()}</strong>
                <small>${item.total} evento(s)</small>
            </div>
        `).join('')
        : `<div class="stack-item"><strong>Sin incidentes</strong><small>No hay eventos registrados todavia.</small></div>`;

    eventList.innerHTML = recentEvents.length
        ? recentEvents.map((event) => `
            <div class="event-item">
                <strong>${escapeHtml(event.type)}</strong>
                <small>${escapeHtml(event.details || 'Sin detalle')}</small>
                <small>${escapeHtml(event.created_at)}</small>
            </div>
        `).join('')
        : `<div class="event-item"><strong>Todo quieto</strong><small>No hay eventos recientes en este servidor.</small></div>`;

    controlLists.innerHTML = `
        <div class="stack-item"><strong>Whitelist</strong><small>${counts.whitelist} usuario(s)</small></div>
        <div class="stack-item"><strong>Owners secundarios</strong><small>${counts.owners} usuario(s)</small></div>
        <div class="stack-item"><strong>Bots autorizados</strong><small>${counts.authorizedBots} bot(s)</small></div>
        <div class="stack-item"><strong>Bans permanentes</strong><small>${counts.permanentBans} ID(s)</small></div>
    `;

    backupList.innerHTML = backups.length
        ? backups.map((backup) => `
            <div class="stack-item">
                <strong>${escapeHtml(backup.type)}</strong>
                <small>${escapeHtml(backup.created_at)}</small>
                <small>${escapeHtml(backup.file_path)}</small>
            </div>
        `).join('')
        : `<div class="stack-item"><strong>Sin backups</strong><small>Aun no se ha guardado ninguna copia.</small></div>`;
}

function pill(label, active) {
    return `<span class="pill ${active ? 'on' : 'off'}">${label}: ${active ? 'ON' : 'OFF'}</span>`;
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
}

function formatNumber(number) {
    return new Intl.NumberFormat('es-ES').format(number || 0);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
