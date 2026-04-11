const state = {
    session: null,
    guilds: [],
    guildDetail: null
};

const landingPage = document.getElementById('landing');
const dashboardPage = document.getElementById('dashboard');
const guildPage = document.getElementById('guild');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');
const serversGrid = document.getElementById('servers-grid');
const guildName = document.getElementById('guild-name');
const message = document.getElementById('message');

loginBtn.addEventListener('click', () => {
    window.location.href = '/auth/login';
});

logoutBtn.addEventListener('click', () => {
    window.location.href = '/auth/logout';
});

backBtn.addEventListener('click', () => {
    window.location.href = '/dashboard';
});

async function init() {
    try {
        const session = await fetch('/api/session').then(r => r.json());
        state.session = session;

        if (session.authenticated) {
            loginBtn.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
        }

        const path = window.location.pathname;
        
        if (path === '/') {
            showPage('landing');
        } else if (path.startsWith('/dashboard/')) {
            const guildId = path.split('/')[2];
            await loadGuild(guildId);
        } else {
            await loadServers();
            showPage('dashboard');
        }
    } catch (error) {
        console.error('Init error:', error);
        showMessage('Error al cargar el dashboard', 'error');
    }
}

async function loadServers() {
    try {
        const response = await fetch('/api/guilds');
        const data = await response.json();
        state.guilds = data.guilds || [];

        serversGrid.innerHTML = state.guilds.length
            ? state.guilds.map(guild => `
                <div class="server-card" onclick="window.location.href='/dashboard/${guild.id}'">
                    <h3>${escapeHtml(guild.name)}</h3>
                    <p>${guild.memberCount} miembros</p>
                    <small>${guild.accessLevel}</small>
                </div>
            `).join('')
            : '<p>No tienes servidores disponibles</p>';
    } catch (error) {
        console.error('Error loading servers:', error);
        showMessage('Error al cargar servidores', 'error');
    }
}

async function loadGuild(guildId) {
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
    document.getElementById('owner-form').onsubmit = (e) => handleAdd(e, guildId, 'owners');
    document.getElementById('whitelist-form').onsubmit = (e) => handleAdd(e, guildId, 'whitelist');
    document.getElementById('bot-form').onsubmit = (e) => handleAdd(e, guildId, 'bots');
    document.getElementById('ban-form').onsubmit = (e) => handleBan(e, guildId);
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
    const formData = new FormData(form);
    const payload = {};

    for (const [key, value] of formData.entries()) {
        if (form.querySelector(`[name="${key}"]`).type === 'checkbox') {
            payload[key] = 1;
        } else if (form.querySelector(`[name="${key}"]`).type === 'number') {
            payload[key] = Number(value);
        } else {
            payload[key] = value || null;
        }
    }

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
    landingPage.classList.add('hidden');
    dashboardPage.classList.add('hidden');
    guildPage.classList.add('hidden');

    if (page === 'landing') landingPage.classList.remove('hidden');
    if (page === 'dashboard') dashboardPage.classList.remove('hidden');
    if (page === 'guild') guildPage.classList.remove('hidden');
}

function showMessage(text, type = 'success') {
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

document.addEventListener('DOMContentLoaded', init);
