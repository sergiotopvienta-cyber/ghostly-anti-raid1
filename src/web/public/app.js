const state = {
    session: null,
    guilds: [],
    guildDetail: null,
    overview: null
};

async function init() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const heroPrimary = document.getElementById('hero-primary');
    const heroSecondary = document.getElementById('hero-secondary');
    const backBtn = document.getElementById('back-btn');

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = '/auth/login';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.location.href = '/auth/logout';
        });
    }

    if (heroPrimary) {
        heroPrimary.addEventListener('click', () => {
            window.location.href = state.session?.authenticated ? '/dashboard' : '/auth/login';
        });
    }

    if (heroSecondary) {
        heroSecondary.addEventListener('click', (event) => {
            if (state.session?.authenticated) {
                event.preventDefault();
                window.location.href = '/auth/logout';
            }
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '/dashboard';
        });
    }

    try {
        const session = await fetch('/api/session').then((r) => r.json());
        state.session = session;

        syncAuthButtons(session);
        syncHeroActions(session);

        const path = window.location.pathname;

        if (path === '/') {
            showPage('landing');
            return;
        }

        if (path.startsWith('/dashboard/')) {
            if (!session.authenticated) {
                window.location.href = '/auth/login';
                return;
            }

            const guildId = path.split('/')[2];
            await loadGuild(guildId);
            return;
        }

        if (path === '/dashboard') {
            if (!session.authenticated) {
                window.location.href = '/auth/login';
                return;
            }

            await loadDashboard();
            showPage('dashboard');
            return;
        }

        showPage('landing');
    } catch (error) {
        console.error('Init error:', error);
        showMessage('Error al cargar el dashboard', 'error');
        showPage('landing');
    }
}

function syncAuthButtons(session) {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (!loginBtn || !logoutBtn) {
        return;
    }

    if (session?.authenticated) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
    }
}

function syncHeroActions(session) {
    const heroPrimary = document.getElementById('hero-primary');
    const heroSecondary = document.getElementById('hero-secondary');

    if (heroPrimary) {
        heroPrimary.textContent = session?.authenticated ? 'Abrir dashboard' : 'Entrar con Discord';
    }

    if (heroSecondary) {
        heroSecondary.textContent = session?.authenticated ? 'Cerrar sesión' : 'Abrir dashboard';
        heroSecondary.href = session?.authenticated ? '/auth/logout' : '/dashboard';
    }
}

async function loadDashboard() {
    try {
        const [overviewResponse, guildsResponse] = await Promise.all([
            fetch('/api/overview'),
            fetch('/api/guilds')
        ]);

        const [overview, guildData] = await Promise.all([
            overviewResponse.ok ? overviewResponse.json() : Promise.resolve({}),
            guildsResponse.ok ? guildsResponse.json() : Promise.resolve({ guilds: [] })
        ]);

        state.overview = overview || {};
        state.guilds = guildData.guilds || [];

        renderOverview(state.overview);
        renderServers(state.guilds);
        renderRecentEvents(state.overview.recentEvents || []);
        renderStatus(state.overview);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showMessage('No se pudo cargar el resumen', 'error');
        await loadServers();
    }
}

function renderOverview(overview = {}) {
    const container = document.getElementById('overview-cards');
    if (!container) return;

    const eventTotal = Array.isArray(overview.eventCounts)
        ? overview.eventCounts.reduce((sum, item) => sum + Number(item.total || 0), 0)
        : 0;

    const stats = overview.stats || {};
    const cards = [
        { label: 'Servidores', value: stats.totalGuilds ?? 0, meta: 'Con acceso' },
        { label: 'Eventos bloqueados', value: eventTotal, meta: 'Severidades combinadas' },
        { label: 'Whitelist', value: stats.whitelistEntries ?? 0, meta: 'Entradas protegidas' },
        { label: 'Uptime', value: `${stats.uptimeHours ?? 0}h`, meta: 'Tiempo en línea' }
    ];

    container.innerHTML = cards.map((card, index) => `
        <article class="overview-card" style="--card-delay:${index * 0.06}s">
            <span>${card.label}</span>
            <strong>${formatCardValue(card.value)}</strong>
            <small>${card.meta}</small>
        </article>
    `).join('');
}

async function loadServers() {
    const serversGrid = document.getElementById('servers-grid');
    if (!serversGrid) return;

    try {
        const response = await fetch('/api/guilds');
        const data = await response.json();
        state.guilds = data.guilds || [];
        renderServers(state.guilds);
    } catch (error) {
        console.error('Error loading servers:', error);
        showMessage('Error al cargar servidores', 'error');
    }
}

function renderServers(guilds) {
    const serversGrid = document.getElementById('servers-grid');
    if (!serversGrid) return;

    serversGrid.innerHTML = guilds.length
        ? guilds.map((guild, index) => `
            <button class="server-card" style="--card-delay:${index * 0.05}s" onclick="window.location.href='/dashboard/${guild.id}'">
                <div class="server-card-head">
                    <div class="server-avatar">
                        ${guild.icon ? `<img src="${escapeHtml(guild.icon)}" alt="${escapeHtml(guild.name)}">` : `<span>${getInitials(guild.name)}</span>`}
                    </div>
                    <div class="server-card-title">
                        <h3>${escapeHtml(guild.name)}</h3>
                        <small>${escapeHtml(guild.accessLevel || 'Acceso')}</small>
                    </div>
                </div>

                <div class="server-card-meta">
                    <span class="tag ${guild.features?.antiRaid ? 'tag-on' : 'tag-off'}">Anti-raid</span>
                    <span class="tag ${guild.features?.antiNuke ? 'tag-on' : 'tag-off'}">Anti-nuke</span>
                    <span class="tag ${guild.features?.lockdown ? 'tag-on' : 'tag-off'}">Lockdown</span>
                </div>

                <div class="server-card-footer">
                    <span>${guild.incidents || 0} eventos recientes</span>
                    <span class="server-card-arrow">Ver</span>
                </div>
            </button>
        `).join('')
        : '<p class="empty">No tienes servidores disponibles</p>';
}

function renderRecentEvents(events = []) {
    const container = document.getElementById('recent-events');
    if (!container) return;

    if (!events.length) {
        container.innerHTML = '<p class="empty">Sin eventos recientes.</p>';
        return;
    }

    container.innerHTML = events.map((event) => `
        <article class="event-item">
            <div class="event-main">
                <strong>${escapeHtml(event.guild_name || 'Servidor')}</strong>
                <p>${escapeHtml(event.description || event.event_type || 'Actividad detectada')}</p>
            </div>
            <div class="event-side">
                <span class="event-severity severity-${formatSeverity(event.severity)}">${escapeHtml(event.severity || 'info')}</span>
                <small>${formatRelativeTime(event.created_at)}</small>
            </div>
        </article>
    `).join('');
}

function renderStatus(overview = {}) {
    const container = document.getElementById('status-list');
    if (!container) return;

    const stats = overview.stats || {};
    const bot = overview.bot || {};
    const eventTotal = Array.isArray(overview.eventCounts)
        ? overview.eventCounts.reduce((sum, item) => sum + Number(item.total || 0), 0)
        : 0;

    const rows = [
        { label: 'Bot', value: bot.name || 'Ghostly Guard' },
        { label: 'Servidores protegidos', value: stats.totalGuilds ?? 0 },
        { label: 'Eventos bloqueados', value: eventTotal },
        { label: 'Lockdowns activos', value: stats.lockdownGuilds ?? 0 },
        { label: 'Bans permanentes', value: stats.permanentBans ?? 0 }
    ];

    container.innerHTML = rows.map((row) => `
        <div class="status-row">
            <span>${row.label}</span>
            <strong>${formatCardValue(row.value)}</strong>
        </div>
    `).join('');
}

async function loadGuild(guildId) {
    const guildName = document.getElementById('guild-name');
    if (!guildName) return;

    try {
        const response = await fetch(`/api/guilds/${guildId}`);
        const data = await response.json();
        state.guildDetail = data;

        guildName.textContent = data.guild.name;

        renderSettingsForm(data.settings);
        renderList('owners-list', data.owners, 'owners');
        renderList('whitelist-list', data.whitelist, 'whitelist');
        renderList('bots-list', data.bots, 'bots');
        renderList('bans-list', data.bans, 'bans');

        setupForms(guildId);
        showPage('guild');
    } catch (error) {
        console.error('Error loading guild:', error);
        showMessage('No tienes acceso a este servidor', 'error');
        window.location.href = '/dashboard';
    }
}

function renderSettingsForm(settings) {
    const form = document.getElementById('settings-form');
    const toggles = [
        'anti_raid', 'anti_nuke', 'anti_flood', 'anti_bots',
        'anti_alts', 'anti_links', 'anti_mentions', 'anti_bot_verified_only', 'lockdown_active'
    ];
    const numbers = [
        'max_joins_per_minute', 'max_messages_per_second',
        'max_mentions_per_message', 'min_account_age_days'
    ];
    const texts = [
        'log_channel', 'alert_channel', 'welcome_channel', 'verification_role'
    ];

    form.innerHTML = `
        ${toggles.map((key) => `
            <label>
                <span>${formatKey(key)}</span>
                <input type="checkbox" name="${key}" ${settings[key] ? 'checked' : ''}>
            </label>
        `).join('')}
        ${numbers.map((key) => `
            <label>
                <span>${formatKey(key)}</span>
                <input type="number" name="${key}" value="${settings[key] ?? 0}">
            </label>
        `).join('')}
        ${texts.map((key) => `
            <label>
                <span>${formatKey(key)}</span>
                <input type="text" name="${key}" value="${settings[key] || ''}">
            </label>
        `).join('')}
        <button type="button" class="btn btn-primary" onclick="saveSettings()">Guardar</button>
    `;
}

function renderList(containerId, items, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = '<p class="empty">Sin elementos</p>';
        return;
    }

    container.innerHTML = items.map((item) => `
        <div class="list-item">
            <span>${item.user_id || item.id}</span>
            <button onclick="removeItem('${type}', '${item.user_id || item.id}')">Eliminar</button>
        </div>
    `).join('');
}

function setupForms(guildId) {
    const ownerForm = document.getElementById('owner-form');
    const whitelistForm = document.getElementById('whitelist-form');
    const botForm = document.getElementById('bot-form');
    const banForm = document.getElementById('ban-form');

    if (ownerForm) ownerForm.onsubmit = (e) => handleAdd(e, guildId, 'owners');
    if (whitelistForm) whitelistForm.onsubmit = (e) => handleAdd(e, guildId, 'whitelist');
    if (botForm) botForm.onsubmit = (e) => handleAdd(e, guildId, 'bots');
    if (banForm) banForm.onsubmit = (e) => handleBan(e, guildId);
}

async function handleAdd(e, guildId, type) {
    e.preventDefault();
    const input = document.getElementById(`${type.slice(0, -1)}-input`);
    const userId = input.value.trim();

    if (!userId) return;

    try {
        await fetch(`/api/guilds/${guildId}/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        input.value = '';
        await loadGuild(guildId);
        showMessage('Agregado correctamente', 'success');
    } catch (error) {
        showMessage('Error al agregar', 'error');
    }
}

async function handleBan(e, guildId) {
    e.preventDefault();
    const userId = document.getElementById('ban-input').value.trim();
    const reason = document.getElementById('ban-reason').value.trim();

    if (!userId) return;

    try {
        await fetch(`/api/guilds/${guildId}/bans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, reason })
        });

        document.getElementById('ban-input').value = '';
        document.getElementById('ban-reason').value = '';
        await loadGuild(guildId);
        showMessage('Ban agregado', 'success');
    } catch (error) {
        showMessage('Error al agregar ban', 'error');
    }
}

async function saveSettings() {
    if (!state.guildDetail) return;

    const form = document.getElementById('settings-form');
    const payload = {};

    const toggles = [
        'anti_raid', 'anti_nuke', 'anti_flood', 'anti_bots',
        'anti_alts', 'anti_links', 'anti_mentions', 'anti_bot_verified_only', 'lockdown_active'
    ];

    toggles.forEach((key) => {
        const checkbox = form.querySelector(`input[name="${key}"]`);
        if (checkbox) {
            payload[key] = checkbox.checked ? 1 : 0;
        }
    });

    const numbers = [
        'max_joins_per_minute', 'max_messages_per_second',
        'max_mentions_per_message', 'min_account_age_days'
    ];

    numbers.forEach((key) => {
        const input = form.querySelector(`input[name="${key}"]`);
        if (input) {
            payload[key] = Number(input.value);
        }
    });

    const texts = [
        'log_channel', 'alert_channel', 'welcome_channel', 'verification_role'
    ];

    texts.forEach((key) => {
        const input = form.querySelector(`input[name="${key}"]`);
        if (input) {
            payload[key] = input.value.trim() || null;
        }
    });

    try {
        await fetch(`/api/guilds/${state.guildDetail.guild.id}/settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        showMessage('Configuración guardada', 'success');
    } catch (error) {
        showMessage('Error al guardar', 'error');
    }
}

async function removeItem(type, id) {
    if (!state.guildDetail) return;

    try {
        await fetch(`/api/guilds/${state.guildDetail.guild.id}/${type}/${id}`, {
            method: 'DELETE'
        });

        await loadGuild(state.guildDetail.guild.id);
        showMessage('Eliminado correctamente', 'success');
    } catch (error) {
        showMessage('Error al eliminar', 'error');
    }
}

function showPage(page) {
    const landingPage = document.getElementById('landing');
    const dashboardPage = document.getElementById('dashboard');
    const guildPage = document.getElementById('guild');

    if (landingPage) landingPage.classList.add('hidden');
    if (dashboardPage) dashboardPage.classList.add('hidden');
    if (guildPage) guildPage.classList.add('hidden');

    if (page === 'landing' && landingPage) landingPage.classList.remove('hidden');
    if (page === 'dashboard' && dashboardPage) dashboardPage.classList.remove('hidden');
    if (page === 'guild' && guildPage) guildPage.classList.remove('hidden');
}

function showMessage(text, type = 'success') {
    const message = document.getElementById('message');
    if (!message) return;

    message.textContent = text;
    message.className = `message ${type}`;
    message.classList.remove('hidden');

    setTimeout(() => {
        message.classList.add('hidden');
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatKey(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

function formatCardValue(value) {
    if (typeof value === 'number') {
        return formatNumber(value);
    }

    return String(value);
}

function getInitials(name = '') {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('');
}

function formatSeverity(severity = '') {
    return severity.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function formatRelativeTime(value) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Ahora mismo';
    if (diffMinutes < 60) return `Hace ${diffMinutes}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short'
    });
}

document.addEventListener('DOMContentLoaded', init);
