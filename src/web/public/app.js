const state = {
    session: null,
    guilds: [],
    guildDetail: null
};

async function init() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const backBtn = document.getElementById('back-btn');
    const dashboardBtn = document.querySelector('.hero .btn-primary');
    const themeToggle = document.getElementById('theme-toggle');

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

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '/dashboard';
        });
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
        loadTheme();
    }

    const path = window.location.pathname;

    try {
        const session = await fetch('/api/session').then(r => r.json());
        state.session = session;

        updateAuthUI(session);

        if (path === '/') {
            showPage('landing');
        } else if (path.startsWith('/dashboard/')) {
            if (!session.authenticated) {
                window.location.href = '/auth/login';
                return;
            }
            const guildId = path.split('/')[2];
            await loadGuild(guildId);
        } else if (path === '/dashboard') {
            if (!session.authenticated) {
                window.location.href = '/auth/login';
                return;
            }
            await loadServers();
            showPage('dashboard');
            initCharts();
            initLogs();
        } else {
            showPage('landing');
        }
    } catch (error) {
        console.error('Init error:', error);
        showMessage('Error al cargar el dashboard', 'error');
    }
}

function updateAuthUI(session) {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const dashboardBtn = document.querySelector('.hero .btn-primary');

    if (!loginBtn || !logoutBtn) return;

    if (session.authenticated) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        if (dashboardBtn) {
            dashboardBtn.textContent = 'Ir al Dashboard';
        }
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        if (dashboardBtn) {
            dashboardBtn.textContent = 'Entrar con Discord';
        }
    }
}

async function refreshSession() {
    try {
        const session = await fetch('/api/session').then(r => r.json());
        state.session = session;
        updateAuthUI(session);
    } catch (error) {
        console.error('Error refreshing session:', error);
    }
}

window.addEventListener('popstate', refreshSession);
setInterval(refreshSession, 30000);

async function loadServers() {
    const serversGrid = document.getElementById('servers-grid');
    if (!serversGrid) return;

    try {
        const response = await fetch('/api/guilds');
        const data = await response.json();
        state.guilds = data.guilds || [];

        serversGrid.innerHTML = state.guilds.length
            ? state.guilds.map(guild => `
                <div class="server-card" onclick="window.location.href='/dashboard/${guild.id}'">
                    <h3>${escapeHtml(guild.name)}</h3>
                    <small>${escapeHtml(guild.accessLevel)}</small>
                </div>
            `).join('')
            : '<p class="empty">No tienes servidores disponibles</p>';
    } catch (error) {
        console.error('Error loading servers:', error);
        showMessage('Error al cargar servidores', 'error');
    }
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
        renderList('owners-list', data.owners, 'owner');
        renderList('whitelist-list', data.whitelist, 'whitelist');
        renderList('bots-list', data.bots, 'bot');
        renderList('bans-list', data.bans, 'ban');

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
        ${toggles.map(key => `
            <label>
                <span>${formatKey(key)}</span>
                <input type="checkbox" name="${key}" ${settings[key] ? 'checked' : ''}>
            </label>
        `).join('')}
        ${numbers.map(key => `
            <label>
                <span>${formatKey(key)}</span>
                <input type="number" name="${key}" value="${settings[key]}">
            </label>
        `).join('')}
        ${texts.map(key => `
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

    container.innerHTML = items.map(item => `
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

    toggles.forEach(key => {
        const checkbox = form.querySelector(`input[name="${key}"]`);
        if (checkbox) {
            payload[key] = checkbox.checked ? 1 : 0;
        }
    });

    const numbers = [
        'max_joins_per_minute', 'max_messages_per_second',
        'max_mentions_per_message', 'min_account_age_days'
    ];

    numbers.forEach(key => {
        const input = form.querySelector(`input[name="${key}"]`);
        if (input) {
            payload[key] = Number(input.value);
        }
    });

    const texts = [
        'log_channel', 'alert_channel', 'welcome_channel', 'verification_role'
    ];

    texts.forEach(key => {
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
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function toggleTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');

    body.classList.toggle('light-mode');

    if (body.classList.contains('light-mode')) {
        themeToggle.textContent = '☀️';
        localStorage.setItem('theme', 'light');
    } else {
        themeToggle.textContent = '🌙';
        localStorage.setItem('theme', 'dark');
    }

    updateChartsTheme();
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggle = document.getElementById('theme-toggle');

    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (themeToggle) themeToggle.textContent = '☀️';
    } else {
        if (themeToggle) themeToggle.textContent = '🌙';
    }
}

let eventsChart = null;
let activityChart = null;

function initCharts() {
    const eventsCtx = document.getElementById('events-chart');
    const activityCtx = document.getElementById('activity-chart');

    if (!eventsCtx || !activityCtx) return;

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#1a1a1a' : '#fff';
    const gridColor = isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

    eventsChart = new Chart(eventsCtx, {
        type: 'bar',
        data: {
            labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
            datasets: [{
                label: 'Eventos Bloqueados',
                data: [12, 19, 3, 5, 2, 3, 15],
                backgroundColor: 'rgba(241, 196, 15, 0.6)',
                borderColor: '#f1c40f',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: textColor }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                }
            }
        }
    });

    activityChart = new Chart(activityCtx, {
        type: 'line',
        data: {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
            datasets: [{
                label: 'Usuarios Activos',
                data: [65, 59, 80, 81, 56, 55, 40],
                borderColor: '#f1c40f',
                backgroundColor: 'rgba(241, 196, 15, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: textColor }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                }
            }
        }
    });
}

function updateChartsTheme() {
    if (!eventsChart || !activityChart) return;

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#1a1a1a' : '#fff';
    const gridColor = isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

    [eventsChart, activityChart].forEach(chart => {
        chart.options.plugins.legend.labels.color = textColor;
        chart.options.scales.y.ticks.color = textColor;
        chart.options.scales.y.grid.color = gridColor;
        chart.options.scales.x.ticks.color = textColor;
        chart.options.scales.x.grid.color = gridColor;
        chart.update();
    });
}

function initLogs() {
    const logsContainer = document.getElementById('logs-container');
    if (!logsContainer) return;

    const sampleLogs = [
        { type: 'info', message: 'Bot iniciado correctamente' },
        { type: 'warning', message: 'Detección de actividad sospechosa en usuario #123456' },
        { type: 'success', message: 'Anti-raid bloqueó 5 usuarios maliciosos' },
        { type: 'error', message: 'Error al conectar con API de Discord' },
        { type: 'info', message: 'Backup completado exitosamente' },
        { type: 'warning', message: 'Intento de nuke detectado y prevenido' },
        { type: 'success', message: 'Usuario agregado a whitelist' }
    ];

    sampleLogs.forEach(log => addLogEntry(log));

    setInterval(() => {
        const randomLogs = [
            { type: 'info', message: 'Verificación de usuarios en curso...' },
            { type: 'warning', message: 'Alta actividad de joins detectada' },
            { type: 'success', message: 'Spam bloqueado: 15 mensajes' },
            { type: 'info', message: 'Sistema de seguridad activo' }
        ];
        const randomLog = randomLogs[Math.floor(Math.random() * randomLogs.length)];
        addLogEntry(randomLog);
    }, 5000);
}

function addLogEntry(log) {
    const logsContainer = document.getElementById('logs-container');
    if (!logsContainer) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${log.type}`;

    const time = new Date().toLocaleTimeString('es-ES');
    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-message">${log.message}</span>
    `;

    logsContainer.insertBefore(entry, logsContainer.firstChild);

    if (logsContainer.children.length > 50) {
        logsContainer.removeChild(logsContainer.lastChild);
    }
}

document.addEventListener('DOMContentLoaded', init);
