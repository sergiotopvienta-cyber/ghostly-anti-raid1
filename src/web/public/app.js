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
            // Limpiar localStorage al hacer logout
            localStorage.removeItem('ghostly_session_token');
            localStorage.removeItem('ghostly_session_expires');
            localStorage.removeItem('ghostly_user');
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
    const urlParams = new URLSearchParams(window.location.search);
    
    // Guardar token persistente si viene de login exitoso
    const authToken = urlParams.get('token');
    if (authToken && urlParams.get('auth') === 'success') {
        localStorage.setItem('ghostly_session_token', authToken);
        localStorage.setItem('ghostly_session_expires', Date.now() + (24 * 60 * 60 * 1000)); // 24 horas
        // Limpiar URL
        window.history.replaceState({}, document.title, path);
    }

    try {
        let session = await fetch('/api/session').then(r => r.json());
        
        // Si no hay sesión activa, intentar restaurar desde localStorage
        if (!session.authenticated) {
            const persistentToken = localStorage.getItem('ghostly_session_token');
            const expiresAt = localStorage.getItem('ghostly_session_expires');
            
            if (persistentToken && expiresAt && Date.now() < parseInt(expiresAt)) {
                try {
                    const restored = await fetch('/api/session/restore', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ persistentToken })
                    }).then(r => r.json());
                    
                    if (restored.success) {
                        // Guardar nuevo token
                        localStorage.setItem('ghostly_session_token', restored.persistentToken);
                        localStorage.setItem('ghostly_session_expires', restored.expiresAt);
                        localStorage.setItem('ghostly_user', JSON.stringify(restored.user));
                        
                        session = {
                            authenticated: true,
                            user: restored.user,
                            guilds: restored.guilds
                        };
                        
                        showToast('Sesión restaurada', 'Bienvenido de vuelta', 'success');
                    } else {
                        // Token inválido, limpiar localStorage
                        localStorage.removeItem('ghostly_session_token');
                        localStorage.removeItem('ghostly_session_expires');
                    }
                } catch (e) {
                    console.error('Error restaurando sesión:', e);
                }
            }
        }
        
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
        
        if (session.authenticated) {
            state.session = session;
            updateAuthUI(session);
            
            // Actualizar expiración en localStorage
            if (session.expiresAt) {
                localStorage.setItem('ghostly_session_expires', session.expiresAt);
            }
        } else {
            // Sesión expirada en servidor, intentar restaurar
            const persistentToken = localStorage.getItem('ghostly_session_token');
            const expiresAt = localStorage.getItem('ghostly_session_expires');
            
            if (persistentToken && expiresAt && Date.now() < parseInt(expiresAt)) {
                try {
                    const restored = await fetch('/api/session/restore', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ persistentToken })
                    }).then(r => r.json());
                    
                    if (restored.success) {
                        localStorage.setItem('ghostly_session_token', restored.persistentToken);
                        localStorage.setItem('ghostly_session_expires', restored.expiresAt);
                        
                        state.session = {
                            authenticated: true,
                            user: restored.user,
                            guilds: restored.guilds
                        };
                        updateAuthUI(state.session);
                    } else {
                        // No se pudo restaurar, limpiar
                        localStorage.removeItem('ghostly_session_token');
                        localStorage.removeItem('ghostly_session_expires');
                        updateAuthUI({ authenticated: false });
                    }
                } catch (e) {
                    console.error('Error en refresh session:', e);
                }
            } else {
                // Token expirado, limpiar
                localStorage.removeItem('ghostly_session_token');
                localStorage.removeItem('ghostly_session_expires');
                updateAuthUI({ authenticated: false });
            }
        }
    } catch (error) {
        console.error('Error refreshing session:', error);
    }
}

window.addEventListener('popstate', refreshSession);
setInterval(refreshSession, 300000); // Cada 5 minutos (300,000 ms)

async function loadServers() {
    const serversGrid = document.getElementById('servers-grid');
    const serverCount = document.getElementById('server-count');
    const totalServersEl = document.getElementById('total-servers');
    
    if (!serversGrid) return;

    try {
        showLoading(true);
        const response = await fetch('/api/guilds');
        const data = await response.json();
        state.guilds = data.guilds || [];

        // Update stats
        if (serverCount) serverCount.textContent = `${state.guilds.length} servidor${state.guilds.length !== 1 ? 'es' : ''}`;
        if (totalServersEl) totalServersEl.textContent = state.guilds.length;

        // Calculate protected servers (those with anti_raid enabled)
        const protectedCount = state.guilds.filter(g => g.settings?.anti_raid).length;
        const protectedEl = document.getElementById('protected-servers');
        if (protectedEl) protectedEl.textContent = protectedCount;

        // Render servers with new design
        serversGrid.className = 'servers-grid-modern';
        serversGrid.innerHTML = state.guilds.length === 0
            ? `
                <div class="empty-state-modern">
                    <span class="empty-icon">🖥️</span>
                    <h3>No hay servidores</h3>
                    <p>Agrega Ghostly Guard a un servidor para comenzar</p>
                    <a href="https://discord.com/oauth2/authorize?client_id=${state.session?.user?.id || 'YOUR_CLIENT_ID'}&scope=bot&permissions=8" 
                       class="btn btn-primary" target="_blank">Invitar Bot</a>
                </div>
            `
            : state.guilds.map(guild => {
                const isProtected = guild.settings?.anti_raid;
                const statusIcon = isProtected ? '🛡️' : '⚠️';
                const statusClass = isProtected ? 'protected' : 'unprotected';
                
                return `
                <div class="server-card-modern ${statusClass}" data-guild="${guild.id}" onclick="loadGuild('${guild.id}')">
                    <div class="server-status-badge">${statusIcon}</div>
                    <img src="${guild.icon || 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                         alt="${guild.name}" 
                         class="server-icon-modern">
                    <div class="server-info-modern">
                        <div class="server-name-modern">${guild.name}</div>
                        <div class="server-meta">
                            <span class="server-status ${statusClass}">${isProtected ? 'Protegido' : 'Sin protección'}</span>
                        </div>
                    </div>
                    <div class="server-arrow">→</div>
                </div>
            `}).join('');
            
        showLoading(false);
    } catch (error) {
        console.error('Error loading servers:', error);
        showLoading(false);
        serversGrid.innerHTML = `
            <div class="error-state-modern">
                <span class="error-icon">⚠️</span>
                <h3>Error al cargar</h3>
                <p>No se pudieron cargar tus servidores</p>
                <button class="btn btn-primary" onclick="loadServers()">Reintentar</button>
            </div>
        `;
        showToast('Error', 'No se pudieron cargar los servidores', 'error');
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
        renderSecurityStatus(data.settings);
        renderList('owners-list', data.owners, 'owner');
        renderList('whitelist-list', data.whitelist, 'whitelist');
        renderList('bots-list', data.bots, 'bot');
        renderList('bans-list', data.bans, 'ban');
        renderList('newaccount-list', data.newaccounts, 'newaccount');

        setupTabs();
        setupAutoRole(guildId, data.roles || []);
        setupForms(guildId);
        showPage('guild');
    } catch (error) {
        console.error('Error loading guild:', error);
        showToast('Error', 'No tienes acceso a este servidor', 'error');
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
        container.innerHTML = `
            <div class="list-empty">
                <div class="list-empty-icon">📭</div>
                <p>No hay elementos en esta lista</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => {
        const id = item.user_id || item.id;
        const name = item.user_tag || item.bot_name || item.reason || id;
        
        return `
        <div class="list-item">
            <div>
                <div class="list-item-name">${escapeHtml(name)}</div>
                <div class="list-item-id">${id}</div>
            </div>
            <button class="list-item-remove" onclick="removeItem('${type}', '${id}')">🗑️ Eliminar</button>
        </div>
    `}).join('');
}

function setupForms(guildId) {
    const ownerForm = document.getElementById('owner-form');
    const whitelistForm = document.getElementById('whitelist-form');
    const botForm = document.getElementById('bot-form');
    const banForm = document.getElementById('ban-form');
    const newAccountForm = document.getElementById('newaccount-form');

    if (ownerForm) ownerForm.onsubmit = (e) => handleAdd(e, guildId, 'owners');
    if (whitelistForm) whitelistForm.onsubmit = (e) => handleAdd(e, guildId, 'whitelist');
    if (botForm) botForm.onsubmit = (e) => handleAdd(e, guildId, 'bots');
    if (banForm) banForm.onsubmit = (e) => handleBan(e, guildId);
    if (newAccountForm) newAccountForm.onsubmit = (e) => handleNewAccount(e, guildId);
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
        showToast('Agregado correctamente', 'success');
    } catch (error) {
        showToast('Error al agregar', 'error');
    }
}

async function handleBan(e, guildId) {
    e.preventDefault();
    const input = document.getElementById('ban-input');
    const reasonInput = document.getElementById('ban-reason');
    const userId = input.value.trim();
    const reason = reasonInput.value.trim();

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
        showToast('Ban agregado', 'success');
    } catch (error) {
        showToast('Error al agregar ban', 'error');
    }
}

async function handleNewAccount(e, guildId) {
    e.preventDefault();
    const input = document.getElementById('newaccount-input');
    const userId = input.value.trim();

    if (!userId) {
        showToast('Ingresa un ID de usuario', 'error');
        return;
    }

    try {
        await fetch(`/api/guilds/${guildId}/newaccounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        input.value = '';
        await loadGuild(guildId);
        showToast('Cuenta nueva autorizada', 'El usuario puede entrar con cuenta recien creada', 'success');
    } catch (error) {
        console.error('Error:', error);
        showToast('Error al autorizar cuenta', 'error');
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

        showToast('Configuración guardada', 'success');
    } catch (error) {
        showToast('Error al guardar', 'error');
    }
}

async function removeItem(type, id) {
    if (!state.guildDetail) return;

    try {
        await fetch(`/api/guilds/${state.guildDetail.guild.id}/${type}/${id}`, {
            method: 'DELETE'
        });

        await loadGuild(state.guildDetail.guild.id);
        showToast('Eliminado correctamente', 'success');
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

function showPage(page) {
    const landingPage = document.getElementById('landing');
    const dashboardPage = document.getElementById('dashboard');
    const guildPage = document.getElementById('guild');
    const privacyPage = document.getElementById('privacy');
    const termsPage = document.getElementById('terms');

    // Hide all pages
    if (landingPage) landingPage.classList.add('hidden');
    if (dashboardPage) dashboardPage.classList.add('hidden');
    if (guildPage) guildPage.classList.add('hidden');
    if (privacyPage) privacyPage.classList.add('hidden');
    if (termsPage) termsPage.classList.add('hidden');

    // Show requested page
    if (page === 'landing' && landingPage) landingPage.classList.remove('hidden');
    if (page === 'dashboard' && dashboardPage) dashboardPage.classList.remove('hidden');
    if (page === 'guild' && guildPage) guildPage.classList.remove('hidden');
    if (page === 'privacy' && privacyPage) {
        privacyPage.classList.remove('hidden');
        window.scrollTo(0, 0);
    }
    if (page === 'terms' && termsPage) {
        termsPage.classList.remove('hidden');
        window.scrollTo(0, 0);
    }
    
    // Scroll to top when changing pages
    if (page !== 'privacy' && page !== 'terms') {
        window.scrollTo(0, 0);
    }
}

function showToast(title, message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showLoading(show = true) {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
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

async function setupAutoRole(guildId, roles) {
    const statusDiv = document.getElementById('autorol-status');
    const select = document.getElementById('autorol-select');
    const setBtn = document.getElementById('set-autorol-btn');
    const removeBtn = document.getElementById('remove-autorol-btn');
    const infoBox = document.getElementById('autorol-info');

    if (!statusDiv || !select || !setBtn || !removeBtn || !infoBox) return;

    try {
        const response = await fetch(`/api/guilds/${guildId}/autorol`);
        const data = await response.json();

        // Cargar roles en el select
        select.innerHTML = '<option value="">Seleccionar rol...</option>' +
            roles
                .filter(r => r && r.id && r.name)
                .map(role => `<option value="${role.id}">${escapeHtml(role.name)}</option>`)
                .join('');

        if (data.autorol) {
            statusDiv.innerHTML = '<p style="color: #57f287;">Rol automático está configurado</p>';
            select.value = data.autorol.roleId;
            infoBox.style.display = 'block';
            removeBtn.style.display = 'inline-block';
            
            const currentRole = document.getElementById('current-role');
            const setBy = document.getElementById('set-by');
            const setDate = document.getElementById('set-date');
            if (currentRole) currentRole.textContent = data.autorol.roleId;
            if (setBy) setBy.textContent = data.autorol.setBy;
            if (setDate) setDate.textContent = new Date(data.autorol.setAt).toLocaleString('es-ES');
        } else {
            statusDiv.innerHTML = '<p style="color: #faa61a;">No hay rol automático configurado</p>';
            infoBox.style.display = 'none';
            removeBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading autorol:', error);
        statusDiv.innerHTML = '<p style="color: #ed4245;">Error al cargar estado del rol automático</p>';
    }

    const autorolForm = document.getElementById('autorol-form');
    if (!autorolForm) return;

    // Evitar duplicar listeners cuando se refresca
    if (autorolForm.dataset.bound === '1') return;
    autorolForm.dataset.bound = '1';

    // Event listeners
    autorolForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const roleId = select.value;
        
        if (!roleId) {
            showMessage('Selecciona un rol', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/guilds/${guildId}/autorol`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleId })
            });

            const data = await response.json();
            
            if (response.ok) {
                showMessage('Rol automático configurado correctamente', 'success');
                setupAutoRole(guildId, roles); // Refresh
            } else {
                showMessage(data.error || 'Error al configurar rol automático', 'error');
            }
        } catch (error) {
            console.error('Error setting autorol:', error);
            showMessage('Error al configurar rol automático', 'error');
        }
    });

    removeBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/guilds/${guildId}/autorol`, {
                method: 'DELETE'
            });

            const data = await response.json();
            
            if (response.ok) {
                showMessage('Rol automático eliminado correctamente', 'success');
                setupAutoRole(guildId, roles); // Refresh
            } else {
                showMessage(data.error || 'Error al eliminar rol automático', 'error');
            }
        } catch (error) {
            console.error('Error removing autorol:', error);
            showMessage('Error al eliminar rol automático', 'error');
        }
    });
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Desactivar todas las tabs
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Activar la tab seleccionada
            btn.classList.add('active');
            const targetContent = document.getElementById(`tab-${tabId}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

function renderSecurityStatus(settings) {
    const container = document.getElementById('security-status');
    if (!container) return;
    
    const features = [
        { key: 'anti_raid', label: 'Anti-Raid', icon: '🛡️' },
        { key: 'anti_nuke', label: 'Anti-Nuke', icon: '🔒' },
        { key: 'anti_links', label: 'Anti-Links', icon: '🔗' },
        { key: 'anti_bots', label: 'Anti-Bots', icon: '🤖' }
    ];
    
    const items = container.querySelectorAll('.status-item');
    items.forEach(item => {
        const featureKey = item.dataset.feature;
        const feature = features.find(f => f.key === featureKey);
        if (!feature) return;
        
        const isEnabled = settings[featureKey];
        const valueSpan = item.querySelector('.status-value');
        
        if (isEnabled) {
            item.classList.add('enabled');
            valueSpan.textContent = 'Activado';
        } else {
            item.classList.remove('enabled');
            valueSpan.textContent = 'Desactivado';
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
