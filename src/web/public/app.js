const state = {
    session: null,
    overview: null,
    guilds: [],
    guildDetail: null
};

const heroStats = document.getElementById('hero-stats');
const overviewCards = document.getElementById('overview-cards');
const inviteLink = document.getElementById('invite-link');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const authBanner = document.getElementById('auth-banner');
const dashboardLocked = document.getElementById('dashboard-locked');
const serverHub = document.getElementById('server-hub');
const guildView = document.getElementById('guild-view');
const dashboardUser = document.getElementById('dashboard-user');
const serverGrid = document.getElementById('server-grid');
const guildTitle = document.getElementById('guild-title');
const guildSummary = document.getElementById('guild-summary');
const settingsForm = document.getElementById('settings-form');
const ownersList = document.getElementById('owners-list');
const whitelistList = document.getElementById('whitelist-list');
const botsList = document.getElementById('bots-list');
const bansList = document.getElementById('bans-list');
const backupList = document.getElementById('backup-list');
const severityList = document.getElementById('severity-list');
const eventList = document.getElementById('event-list');
const ownerForm = document.getElementById('owner-form');
const whitelistForm = document.getElementById('whitelist-form');
const botForm = document.getElementById('bot-form');
const banForm = document.getElementById('ban-form');
const manualBackupButton = document.getElementById('manual-backup-button');

logoutButton.addEventListener('click', () => {
    window.location.href = '/auth/logout';
});

ownerForm.addEventListener('submit', (event) => handleSimpleCreate(event, 'owners', 'owner-id-input', 'Owner secundario agregado.'));
whitelistForm.addEventListener('submit', (event) => handleSimpleCreate(event, 'whitelist', 'whitelist-id-input', 'Usuario agregado a whitelist.'));
botForm.addEventListener('submit', (event) => handleSimpleCreate(event, 'bots', 'bot-id-input', 'Bot autorizado agregado.'));

banForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.guildDetail) return;

    const userId = document.getElementById('ban-id-input').value.trim();
    const reason = document.getElementById('ban-reason-input').value.trim();
    if (!userId) return;

    try {
        await fetchJson(`/api/guilds/${state.guildDetail.guild.id}/bans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, reason })
        });

        document.getElementById('ban-id-input').value = '';
        document.getElementById('ban-reason-input').value = '';
        flashBanner('Ban permanente agregado.', 'success');
        await loadGuild(state.guildDetail.guild.id);
    } catch (error) {
        flashBanner(error.message, 'error');
    }
});

manualBackupButton.addEventListener('click', async () => {
    if (!state.guildDetail) return;

    try {
        await fetchJson(`/api/guilds/${state.guildDetail.guild.id}/backups`, { method: 'POST' });
        flashBanner('Backup creado correctamente.', 'success');
        await loadGuild(state.guildDetail.guild.id);
    } catch (error) {
        flashBanner(error.message, 'error');
    }
});

init().catch((error) => {
    console.error('Dashboard bootstrap error:', error);
    flashBanner('No se pudo cargar la aplicacion.', 'error');
});

async function init() {
    showLoadingState();
    
    try {
        state.session = await fetchJson('/api/session');

        if (!state.session.authenticated) {
            renderGuestState();
            hideLoadingState();
            return;
        }

        loginButton.classList.add('hidden');
        logoutButton.classList.remove('hidden');

        const [overview, guildsResponse] = await Promise.all([
            fetchJson('/api/overview'),
            fetchJson('/api/guilds')
        ]);

        state.overview = overview;
        state.guilds = guildsResponse.guilds;

        renderOverview();
        renderUserChip();

        const guildIdFromPath = parseGuildIdFromPath();
        if (guildIdFromPath) {
            await loadGuild(guildIdFromPath);
            hideLoadingState();
            return;
        }

        renderServerHub();
        hideLoadingState();
    } catch (error) {
        console.error('Init error:', error);
        flashBanner('Error al cargar el dashboard. Recarga la pagina.', 'error');
        hideLoadingState();
    }
}

function renderGuestState() {
    dashboardLocked.classList.remove('hidden');
    serverHub.classList.add('hidden');
    guildView.classList.add('hidden');
    flashBanner('Inicia sesion con Discord para ver tus servidores.', 'info');
}

function renderUserChip() {
    const user = state.session.user;
    dashboardUser.innerHTML = `
        <div class="user-chip">
            ${user.avatar ? `<img src="${user.avatar}" alt="${escapeHtml(user.username)}">` : '<span class="avatar-fallback">D</span>'}
            <div>
                <strong>${escapeHtml(user.global_name || user.username)}</strong>
                <small>${escapeHtml(user.username)} · access panel</small>
            </div>
        </div>
    `;
}

function renderOverview() {
    const { stats, eventCounts, bot, app } = state.overview;
    const totalEvents = eventCounts.reduce((sum, item) => sum + item.total, 0);

    heroStats.innerHTML = `
        <article class="reveal-card" style="animation-delay: 0.1s"><span class="stat-value">${stats.totalGuilds}</span><span class="stat-label">Servidores</span></article>
        <article class="reveal-card" style="animation-delay: 0.15s"><span class="stat-value">${formatNumber(stats.totalMembers)}</span><span class="stat-label">Miembros</span></article>
        <article class="reveal-card" style="animation-delay: 0.2s"><span class="stat-value">${totalEvents}</span><span class="stat-label">Eventos</span></article>
    `;

    overviewCards.innerHTML = `
        <article class="metric-card reveal-card" style="animation-delay: 0.25s">
            <h3>Bot online</h3>
            <p>${escapeHtml(bot.tag)}</p>
            <strong>${stats.uptimeHours}h</strong>
        </article>
        <article class="metric-card reveal-card" style="animation-delay: 0.3s">
            <h3>Lockdowns</h3>
            <p>Servidores protegidos</p>
            <strong>${stats.lockdownGuilds}</strong>
        </article>
        <article class="metric-card reveal-card" style="animation-delay: 0.35s">
            <h3>Whitelist</h3>
            <p>Usuarios de confianza</p>
            <strong>${stats.whitelistEntries}</strong>
        </article>
        <article class="metric-card reveal-card" style="animation-delay: 0.4s">
            <h3>Bans permanentes</h3>
            <p>Reingreso bloqueado</p>
            <strong>${stats.permanentBans}</strong>
        </article>
    `;

    if (app.clientId) {
        inviteLink.href = `https://discord.com/oauth2/authorize?client_id=${app.clientId}&scope=bot%20applications.commands`;
    }
}

function renderServerHub() {
    dashboardLocked.classList.add('hidden');
    guildView.classList.add('hidden');
    serverHub.classList.remove('hidden');
    serverHub.style.animation = 'none';
    serverHub.offsetHeight; // Trigger reflow
    serverHub.style.animation = 'float-in 0.4s ease both';

    serverGrid.innerHTML = state.guilds.length
        ? state.guilds.map((guild, index) => `
            <a class="server-card" href="/dashboard/${guild.id}" style="animation-delay: ${index * 0.05}s">
                <div>
                    <strong>${escapeHtml(guild.name)}</strong>
                    <small>${formatNumber(guild.memberCount)} miembros</small>
                </div>
                <div class="server-card-meta">
                    <span class="pill ${guild.features.lockdown ? 'off' : 'on'}">${guild.features.lockdown ? 'LOCKDOWN' : 'ESTABLE'}</span>
                    <small>${escapeHtml(guild.accessLevel.replaceAll('_', ' '))}</small>
                </div>
            </a>
        `).join('')
        : `<div class="locked-card"><h3>No tienes servidores autorizados</h3><p>Debes ser owner real o owner secundario y el bot debe estar dentro.</p></div>`;
}

async function loadGuild(guildId) {
    showLoadingState();
    
    try {
        state.guildDetail = await fetchJson(`/api/guilds/${guildId}`);
        history.replaceState({}, '', `/dashboard/${guildId}`);
        renderGuildView();
        hideLoadingState();
    } catch (error) {
        flashBanner('No tienes acceso a ese servidor o no existe en el bot.', 'error');
        history.replaceState({}, '', '/dashboard');
        renderServerHub();
        hideLoadingState();
    }
}

function renderGuildView() {
    const detail = state.guildDetail;
    const { guild, settings, counts, severityCounts, recentEvents, backups, owners, whitelist, bots, bans, accessLevel } = detail;

    serverHub.classList.add('hidden');
    dashboardLocked.classList.add('hidden');
    guildView.classList.remove('hidden');
    guildView.style.animation = 'none';
    guildView.offsetHeight; // Trigger reflow
    guildView.style.animation = 'float-in 0.4s ease both';

    guildTitle.textContent = guild.name;
    guildSummary.innerHTML = `
        <article class="mini-tile reveal-card" style="animation-delay: 0.05s"><span class="mini-label">Servidor</span><span class="mini-value">${escapeHtml(guild.name)}</span></article>
        <article class="mini-tile reveal-card" style="animation-delay: 0.1s"><span class="mini-label">Miembros</span><span class="mini-value">${formatNumber(guild.memberCount)}</span></article>
        <article class="mini-tile reveal-card" style="animation-delay: 0.15s"><span class="mini-label">Acceso</span><span class="mini-value">${escapeHtml(accessLevel.replaceAll('_', ' '))}</span></article>
        <article class="mini-tile reveal-card" style="animation-delay: 0.2s"><span class="mini-label">Backups</span><span class="mini-value">${counts.backups}</span></article>
    `;

    renderSettingsForm(settings);

    const canManageOwners = accessLevel === 'owner';
    ownerForm.classList.toggle('hidden', !canManageOwners);

    ownersList.innerHTML = `
        <div class="stack-item reveal-card" style="animation-delay: 0.05s"><strong>Owner real</strong><small>${guild.ownerId}</small></div>
        ${owners.map((owner, i) => stackItemWithRemove(owner.user_id, 'Owner secundario', canManageOwners, () => removeEntry('owners', owner.user_id), i * 0.05)).join('')}
    `;
    bindActionButtons(ownersList);

    whitelistList.innerHTML = whitelist.length
        ? whitelist.map((item, i) => stackItemWithRemove(item.user_id, 'Whitelist', true, () => removeEntry('whitelist', item.user_id), i * 0.05)).join('')
        : emptyStack('Sin whitelist');
    bindActionButtons(whitelistList);

    botsList.innerHTML = bots.length
        ? bots.map((item, i) => stackItemWithRemove(item.user_id, 'Bot autorizado', true, () => removeEntry('bots', item.user_id), i * 0.05)).join('')
        : emptyStack('Sin bots autorizados');
    bindActionButtons(botsList);

    bansList.innerHTML = bans.length
        ? bans.map((item, i) => stackItemWithRemove(item.user_id, item.reason || 'Ban permanente', true, () => removeEntry('bans', item.user_id), i * 0.05)).join('')
        : emptyStack('Sin bans permanentes');
    bindActionButtons(bansList);

    backupList.innerHTML = backups.length
        ? backups.map((backup, i) => `
            <div class="stack-item reveal-card" style="animation-delay: ${i * 0.05}s">
                <strong>${escapeHtml(backup.type)}</strong>
                <small>${escapeHtml(backup.created_at)}</small>
                <small>${escapeHtml(backup.file_path)}</small>
            </div>
        `).join('')
        : emptyStack('Sin backups');

    severityList.innerHTML = severityCounts.length
        ? severityCounts.map((item, i) => `
            <div class="stack-item reveal-card" style="animation-delay: ${i * 0.05}s">
                <strong class="severity-${item.severity}">${item.severity.toUpperCase()}</strong>
                <small>${item.total} evento(s)</small>
            </div>
        `).join('')
        : emptyStack('Sin incidentes');

    eventList.innerHTML = recentEvents.length
        ? recentEvents.map((event, i) => `
            <div class="event-item reveal-card" style="animation-delay: ${i * 0.05}s">
                <strong>${escapeHtml(event.type)}</strong>
                <small>${escapeHtml(event.details || 'Sin detalle')}</small>
                <small>${escapeHtml(event.created_at)}</small>
            </div>
        `).join('')
        : `<div class="event-item reveal-card"><strong>Todo quieto</strong><small>No hay eventos recientes en este servidor.</small></div>`;
}

function renderSettingsForm(settings) {
    const toggles = [
        ['anti_raid', 'Anti-Raid'],
        ['anti_nuke', 'Anti-Nuke'],
        ['anti_flood', 'Anti-Flood'],
        ['anti_bots', 'Anti-Bots'],
        ['anti_alts', 'Anti-Alts'],
        ['anti_links', 'Anti-Links'],
        ['anti_mentions', 'Anti-Mentions'],
        ['anti_bot_verified_only', 'Solo bots verificados'],
        ['lockdown_active', 'Lockdown']
    ];

    const numbers = [
        ['max_joins_per_minute', 'Max joins/minuto'],
        ['max_messages_per_second', 'Max mensajes/segundo'],
        ['max_mentions_per_message', 'Max menciones/mensaje'],
        ['min_account_age_days', 'Edad minima cuenta']
    ];

    const textInputs = [
        ['log_channel', 'Canal de logs (ID)'],
        ['alert_channel', 'Canal de alertas (ID)'],
        ['welcome_channel', 'Canal de bienvenida (ID)'],
        ['verification_role', 'Rol de verificacion (ID)']
    ];

    settingsForm.innerHTML = `
        <div class="settings-grid">
            ${toggles.map(([key, label]) => `
                <label class="setting-toggle">
                    <span>${label}</span>
                    <input type="checkbox" data-setting-key="${key}" ${settings[key] ? 'checked' : ''}>
                </label>
            `).join('')}
            ${numbers.map(([key, label]) => `
                <label class="setting-number">
                    <span>${label}</span>
                    <input type="number" data-setting-key="${key}" value="${settings[key]}">
                </label>
            `).join('')}
            ${textInputs.map(([key, label]) => `
                <label class="setting-number">
                    <span>${label}</span>
                    <input type="text" data-setting-key="${key}" value="${settings[key] || ''}">
                </label>
            `).join('')}
        </div>
        <div class="settings-actions">
            <button class="button" id="save-settings-button" type="button">Guardar cambios</button>
        </div>
    `;

    document.getElementById('save-settings-button').addEventListener('click', saveSettings);
}

async function saveSettings() {
    if (!state.guildDetail) return;

    const saveButton = document.getElementById('save-settings-button');
    saveButton.disabled = true;
    saveButton.textContent = 'Guardando...';

    const payload = {};
    for (const input of settingsForm.querySelectorAll('[data-setting-key]')) {
        if (input.type === 'checkbox') {
            payload[input.dataset.settingKey] = input.checked ? 1 : 0;
        } else if (input.type === 'number') {
            payload[input.dataset.settingKey] = Number(input.value);
        } else {
            payload[input.dataset.settingKey] = input.value.trim() || null;
        }
    }

    try {
        await fetchJson(`/api/guilds/${state.guildDetail.guild.id}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        flashBanner('Configuracion actualizada correctamente.', 'success');
        await loadGuild(state.guildDetail.guild.id);
    } catch (error) {
        flashBanner(error.message, 'error');
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Guardar cambios';
    }
}

async function handleSimpleCreate(event, section, inputId, successMessage) {
    event.preventDefault();
    if (!state.guildDetail) return;

    const input = document.getElementById(inputId);
    const userId = input.value.trim();
    if (!userId) return;

    const form = input.closest('form');
    const button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Agregando...';

    try {
        await fetchJson(`/api/guilds/${state.guildDetail.guild.id}/${section}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        input.value = '';
        flashBanner(successMessage, 'success');
        await loadGuild(state.guildDetail.guild.id);
    } catch (error) {
        flashBanner(error.message, 'error');
    } finally {
        button.disabled = false;
        button.textContent = 'Agregar';
    }
}

async function removeEntry(section, userId) {
    if (!state.guildDetail) return;

    try {
        await fetchJson(`/api/guilds/${state.guildDetail.guild.id}/${section}/${userId}`, {
            method: 'DELETE'
        });

        flashBanner('Elemento eliminado correctamente.', 'success');
        await loadGuild(state.guildDetail.guild.id);
    } catch (error) {
        flashBanner(error.message, 'error');
    }
}

function stackItemWithRemove(id, label, removable, handler, delay = 0) {
    return `
        <div class="stack-item stack-item-action reveal-card" style="animation-delay: ${delay}s">
            <div>
                <strong>${escapeHtml(label)}</strong>
                <small>${escapeHtml(id)}</small>
            </div>
            ${removable ? `<button class="button button-danger js-remove" data-id="${escapeHtml(id)}" type="button">Quitar</button>` : ''}
        </div>
    `;
}

function bindActionButtons(container) {
    const buttons = container.querySelectorAll('.js-remove');
    for (const button of buttons) {
        const clone = button.cloneNode(true);
        clone.addEventListener('click', () => {
            const label = container.id;
            const section = label.replace('-list', '');
            removeEntry(section, clone.dataset.id);
        });
        button.replaceWith(clone);
    }
}

function emptyStack(title) {
    return `<div class="stack-item"><strong>${title}</strong><small>No hay elementos registrados.</small></div>`;
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

function parseGuildIdFromPath() {
    const match = window.location.pathname.match(/^\/dashboard\/(\d+)$/);
    return match ? match[1] : null;
}

function showLoadingState() {
    document.body.style.cursor = 'wait';
}

function hideLoadingState() {
    document.body.style.cursor = 'default';
}

function flashBanner(message, kind = 'info') {
    authBanner.textContent = message;
    authBanner.className = `auth-banner ${kind}`;
    authBanner.classList.remove('hidden');
    authBanner.style.animation = 'none';
    authBanner.offsetHeight;
    authBanner.style.animation = 'float-in 0.3s ease both';
    
    setTimeout(() => {
        authBanner.classList.add('hidden');
    }, 5000);
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
