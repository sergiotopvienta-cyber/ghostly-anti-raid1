const state = {
    session: null,
    overview: null,
    guilds: [],
    selectedGuildId: null,
    selectedDetail: null
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
const ownersList = document.getElementById('owners-list');
const inviteLink = document.getElementById('invite-link');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const dashboardLocked = document.getElementById('dashboard-locked');
const dashboardApp = document.getElementById('dashboard-app');
const authBanner = document.getElementById('auth-banner');
const dashboardUser = document.getElementById('dashboard-user');
const ownerForm = document.getElementById('owner-form');
const ownerIdInput = document.getElementById('owner-id-input');

logoutButton.addEventListener('click', () => {
    window.location.href = '/auth/logout';
});

ownerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.selectedGuildId || !ownerIdInput.value.trim()) return;

    try {
        await fetchJson(`/api/guilds/${state.selectedGuildId}/owners`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: ownerIdInput.value.trim() })
        });

        ownerIdInput.value = '';
        await loadGuild(state.selectedGuildId);
        flashBanner('Owner secundario agregado correctamente.', 'success');
    } catch (error) {
        flashBanner('No se pudo agregar ese owner secundario.', 'error');
    }
});

init().catch((error) => {
    console.error('Error cargando dashboard:', error);
    flashBanner('Hubo un error cargando el dashboard.', 'error');
});

async function init() {
    state.session = await fetchJson('/api/session');

    if (!state.session.authenticated) {
        renderGuestState();
        return;
    }

    const [overview, guilds] = await Promise.all([
        fetchJson('/api/overview'),
        fetchJson('/api/guilds')
    ]);

    state.overview = overview;
    state.guilds = guilds.guilds;
    state.selectedGuildId = state.guilds[0]?.id || null;

    renderOverview();
    renderAuthenticatedState();
    renderGuildList();

    if (state.selectedGuildId) {
        await loadGuild(state.selectedGuildId);
    }
}

async function loadGuild(guildId) {
    state.selectedGuildId = guildId;
    renderGuildList();
    dashboardApp.classList.add('is-loading');

    try {
        state.selectedDetail = await fetchJson(`/api/guilds/${guildId}`);
        renderGuildDetail(state.selectedDetail);
    } finally {
        dashboardApp.classList.remove('is-loading');
    }
}

function renderGuestState() {
    loginButton.classList.remove('hidden');
    logoutButton.classList.add('hidden');
    dashboardLocked.classList.remove('hidden');
    dashboardApp.classList.add('hidden');
    flashBanner('Inicia sesion con Discord para desbloquear el dashboard.', 'info');
}

function renderAuthenticatedState() {
    loginButton.classList.add('hidden');
    logoutButton.classList.remove('hidden');
    dashboardLocked.classList.add('hidden');
    dashboardApp.classList.remove('hidden');

    const user = state.session.user;
    dashboardUser.innerHTML = `
        <div class="user-chip">
            ${user.avatar ? `<img src="${user.avatar}" alt="${escapeHtml(user.username)}">` : '<span class="avatar-fallback">D</span>'}
            <div>
                <strong>${escapeHtml(user.global_name || user.username)}</strong>
                <small>${escapeHtml(user.username)} · ${state.session.isSuperAdmin ? 'Super Admin' : 'Owner Access'}</small>
            </div>
        </div>
    `;
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
        <article class="metric-card reveal-card">
            <h3>Bot online</h3>
            <p>${escapeHtml(bot.tag)}</p>
            <strong>${stats.uptimeHours}h</strong>
        </article>
        <article class="metric-card reveal-card">
            <h3>Lockdowns activos</h3>
            <p>Servidores protegidos</p>
            <strong>${stats.lockdownGuilds}</strong>
        </article>
        <article class="metric-card reveal-card">
            <h3>Whitelist entries</h3>
            <p>Usuarios de confianza</p>
            <strong>${stats.whitelistEntries}</strong>
        </article>
        <article class="metric-card reveal-card">
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
            <small>${escapeHtml(guild.accessLevel.replaceAll('_', ' '))}</small>
        </button>
    `).join('');

    for (const button of serverList.querySelectorAll('[data-guild-id]')) {
        button.addEventListener('click', () => loadGuild(button.dataset.guildId));
    }
}

function renderGuildDetail(detail) {
    const { guild, settings, counts, severityCounts, recentEvents, backups, owners, accessLevel } = detail;

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
            <span class="mini-label">Acceso</span>
            <span class="mini-value">${escapeHtml(accessLevel.replaceAll('_', ' '))}</span>
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

    const canManageOwners = accessLevel === 'owner' || accessLevel === 'super_admin';
    ownerForm.classList.toggle('hidden', !canManageOwners);

    ownersList.innerHTML = `
        <div class="stack-item">
            <strong>Owner real</strong>
            <small>${guild.ownerId}</small>
        </div>
        ${owners.map((owner) => `
            <div class="stack-item stack-item-action">
                <div>
                    <strong>Owner secundario</strong>
                    <small>${owner.user_id}</small>
                </div>
                ${canManageOwners ? `<button class="button button-danger owner-remove" data-owner-id="${owner.user_id}" type="button">Quitar</button>` : ''}
            </div>
        `).join('')}
    `;

    for (const button of ownersList.querySelectorAll('.owner-remove')) {
        button.addEventListener('click', async () => {
            try {
                await fetchJson(`/api/guilds/${state.selectedGuildId}/owners/${button.dataset.ownerId}`, {
                    method: 'DELETE'
                });
                await loadGuild(state.selectedGuildId);
                flashBanner('Owner secundario eliminado correctamente.', 'success');
            } catch (error) {
                flashBanner('No se pudo eliminar ese owner secundario.', 'error');
            }
        });
    }
}

function pill(label, active) {
    return `<span class="pill ${active ? 'on' : 'off'}">${label}: ${active ? 'ON' : 'OFF'}</span>`;
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
    }

    return payload;
}

function flashBanner(message, kind = 'info') {
    authBanner.textContent = message;
    authBanner.className = `auth-banner ${kind}`;
    authBanner.classList.remove('hidden');
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
