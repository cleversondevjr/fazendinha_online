// farm2.0 - Complete Game Client
const API_BASE_URL = 'api/game';
const ADMIN_API_BASE_URL = 'api/admin';

let inventario = { coins: 0, diamante: 0, energia: 0 };
let plotStates = [];
let missionsState = [];
let worldTreeState = null;
let configs = {};
let cropCatalog = {};
let itemShopPrices = {};

const itemSelecionadoState = { item: null };

// --- Sessão e Inatividade ---
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutos
let inactivityTimer;

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(logout, INACTIVITY_LIMIT);
}

function logout() {
    document.cookie = "usuario_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    window.location.href = "login.html";
}

// Monitora interações do usuário
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetInactivityTimer, true);
});

// Inicializa o timer
resetInactivityTimer();

// --- Core API ---
async function apiFetch(endpoint, options = {}) {
    // Ensure credentials (cookies) are sent with every request
    options.credentials = 'include';
    const res = await fetch(endpoint, options);
    if (res.status === 401) {
        const data = await res.json();
        window.location.href = data.loginUrl || 'login.html';
        return;
    }
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro: ${res.status}`);
    }
    return res.json();
}

async function loadGameState() {
    try {
        const data = await apiFetch(`${API_BASE_URL}/state`);
        inventario = data.inventory || {};
        plotStates = data.slots || [];
        missionsState = data.missions || [];
        worldTreeState = data.worldTree || null;
        configs = data.configs || {};

        const adminData = await apiFetch(`${ADMIN_API_BASE_URL}/config`).catch(() => ({ items: [] }));
        const allItems = adminData.items || [];

        itemShopPrices = allItems.filter(i => i.tipo === 'item').reduce((acc, i) => ({ ...acc, [i.item_id]: i }), {});
        cropCatalog = allItems.filter(i => i.tipo === 'flower' || i.tipo === 'tree').reduce((acc, i) => ({ ...acc, [i.item_id]: i }), {});

        renderPlots();
        renderAll();
    } catch (err) {
        console.error("Erro ao carregar estado:", err);
        // Fallback render to at least show the interface
        renderPlots();
    }
}

async function performAction(action, slotIndex = null, itemId = null, missionId = null) {
    try {
        const res = await apiFetch(`${API_BASE_URL}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, slotIndex, itemId, missionId })
        });
        if (res.success) await loadGameState();
    } catch (err) {
        showDialog({ title: "Ação Falhou", message: err.message });
    }
}

// --- DOM Generation ---
function createPlot(index) {
    return `
        <section class="plot" data-plot-index="${index}">
            <div class="plot-frame">
                <img class="plot-bg" src="" alt="" draggable="false">
                <div class="plot-content">
                    <div class="info">
                        <span class="timer">AGUARDANDO...</span>
                    </div>
                    <div class="soil"></div>
                    <div class="status-icons">
                        <div class="status-slot"></div>
                        <div class="status-slot"></div>
                    </div>
                </div>
            </div>
        </section>
    `;
}

function renderPlots() {
    const grid = document.getElementById("plot-grid");
    if (!grid || grid.children.length > 0) return; // Only generate if empty
    grid.innerHTML = Array.from({ length: 8 }, (_, i) => createPlot(i)).join("");
}

// --- UI Rendering ---

function getCropAsset(state) {
    if (!state.crop_id) return null;
    const baseId = state.crop_id.replace(/_(adulta|broto|semente|jovem)$/u, "");
    const progress = parseFloat(state.progress) || 0;

    let stage = "semente";
    if (progress >= 1.0) stage = "adulta";
    else if (progress > 0.75) stage = "jovem";
    else if (progress > 0.40) stage = "broto";

    return { src: `assets/flores/${baseId}_${stage}.png`, stage };
}

function renderPlotState(index) {
    const plotEl = document.querySelector(`.plot[data-plot-index="${index}"]`);
    const state = plotStates.find(s => s.slot_index === index);
    if (!plotEl || !state) return;

    const bg = plotEl.querySelector(".plot-bg");
    if (state.fase === 'locked') bg.src = "assets/slot_comprar_terra_v5.png";
    else if (state.fase === 'needsPot') bg.src = "assets/slot_vazio_v5.png";
    else bg.src = "assets/slot_planta_v5.png";

    const soil = plotEl.querySelector(".soil");
    soil.innerHTML = "";

    const crop = getCropAsset(state);
    if (crop) {
        const img = document.createElement("img");
        img.className = `crop-layer stage-${crop.stage}`;
        img.src = crop.src;
        soil.appendChild(img);
    }

    if (state.crow_active) {
        const crow = document.createElement("div");
        crow.className = "danger-sign danger-crow";
        crow.innerHTML = `<div class="danger-plaque">CORVO!</div><img src="assets/corvo.png" alt="Corvo">`;
        soil.appendChild(crow);
    }

    const timer = plotEl.querySelector(".timer");
    if (state.fase === 'growing') {
        const remaining = new Date(state.ends_at).getTime() - Date.now();
        timer.textContent = state.crow_active ? "PAUSADO" : `Tempo: ${formatDuration(remaining)}`;
    } else if (state.fase === 'ready') {
        timer.textContent = "COLHER!";
    } else if (state.fase === 'locked') {
        timer.textContent = "COMPRAR";
    } else {
        timer.textContent = state.fase.toUpperCase().replace('NEEDS', 'AGUARDANDO ');
    }
}

function renderMissions() {
    const list = document.getElementById("missions-list");
    if (!list) return;
    list.innerHTML = missionsState.map(mission => `
        <div class="mission-item ${mission.claimed ? 'done' : ''}">
            <div class="mission-name">${mission.label}</div>
            <div class="mission-meta">
                <span class="mission-progress">${mission.progress}/${mission.target}</span>
                <span class="mission-reward">${mission.reward_amount} ${mission.reward_type}</span>
            </div>
            <button class="mission-claim" onclick="performAction('claim_mission', null, null, ${mission.id})" ${mission.progress < mission.target || mission.claimed ? 'disabled' : ''}>
                ${mission.claimed ? 'Resgatado' : 'Resgatar'}
            </button>
        </div>
    `).join("");
}

function getItemAsset(itemId) {
    // Primeiro verifica se temos uma configuração dinâmica para este item
    const item = itemShopPrices[itemId] || cropCatalog[itemId];
    if (item && item.image_asset) return item.image_asset;

    const mappings = {
        'vasoPequeno': 'vaso_pequeno.png',
        'vasoGrande': 'vaso_grande.png',
        'agua': 'agua.png',
        'pesticida': 'borrifador_inseticida.png',
        'espantalho': 'espantalho.png'
    };
    return mappings[itemId] || `${itemId}.png`;
}

function renderShopTab(tabName) {
    const grid = document.getElementById("shop-grid");
    if (!grid) return;
    let items = [];
    if (tabName === 'itens') items = Object.values(itemShopPrices);
    else if (tabName === 'flores') items = Object.values(cropCatalog).filter(c => c.tipo === 'flower');
    else if (tabName === 'arvores') items = Object.values(cropCatalog).filter(c => c.tipo === 'tree');
    else if (tabName === 'ouro') {
        grid.innerHTML = `
            <div class="shop-item">
                <img src="assets/ouro.png">
                <p>Pacote de Ouro 1</p>
                <p>10 Diamantes</p>
                <button class="buy-btn" onclick="performAction('buy_pack', null, 'pack_gold_1')">Trocar</button>
            </div>
            <div class="shop-item">
                <img src="assets/ouro.png">
                <p>Pacote de Ouro 2</p>
                <p>50 Diamantes</p>
                <button class="buy-btn" onclick="performAction('buy_pack', null, 'pack_gold_2')">Trocar</button>
            </div>
        `;
        return;
    } else if (tabName === 'diamantes') {
        grid.innerHTML = `
            <div class="shop-item">
                <img src="assets/diamante.png">
                <p>Pacote de Diamante 1</p>
                <p>R$ 10,00</p>
                <button class="buy-btn" onclick="showDialog({title:'Loja', message:'Em breve: Integração com Pagamento'})">Comprar</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = items.map(item => `
        <div class="shop-item">
            <img src="assets/${getItemAsset(item.item_id)}" onerror="this.src='assets/flores/${item.item_id}.png'">
            <p>${item.label}</p>
            <p>${item.price_coins > 0 ? item.price_coins + ' Ouro' : item.price_diamonds + ' Diamantes'}</p>
            <button class="buy-btn" onclick="performAction('buy_item', null, '${item.item_id}')">Comprar</button>
        </div>
    `).join("");
}

function renderInventory() {
    const grid = document.getElementById("inventory-grid");
    if (!grid) return;
    grid.innerHTML = Object.entries(inventario).filter(([id, qty]) => qty > 0 && !['coins', 'diamante', 'energia'].includes(id)).map(([id, qty]) => `
        <div class="inventory-item ${itemSelecionadoState.item === id ? 'selected' : ''}">
            <img src="assets/${getItemAsset(id)}" onerror="this.src='assets/flores/${id}.png'">
            <p>${id}</p>
            <p>Qtd: ${qty}</p>
            <button class="use-btn" onclick="selectItem('${id}')">Selecionar</button>
        </div>
    `).join("");
}

function selectItem(id) {
    itemSelecionadoState.item = id;
    document.querySelectorAll(".sidebar .use-btn").forEach(b => {
        if (b.dataset.item === id) b.classList.add("selected");
        else b.classList.remove("selected");
    });
    renderInventory();
}

function renderAll() {
    plotStates.forEach((_, i) => renderPlotState(i));
    document.getElementById("coins").textContent = inventario.coins || 0;
    document.getElementById("diamonds").textContent = inventario.diamante || 0;
    document.getElementById("energy").textContent = inventario.energia || 0;
    renderMissions();
    updateSidebarCounts();
}

function updateSidebarCounts() {
    const mappings = {
        'vasoPequeno': 'count-vaso-pequeno',
        'vasoGrande': 'count-vaso-grande',
        'agua': 'count-agua',
        'pesticida': 'count-pesticida',
        'espantalho': 'count-espantalho'
    };
    for (const [item, id] of Object.entries(mappings)) {
        const el = document.getElementById(id);
        if (el) el.textContent = inventario[item] || 0;
    }
}

function formatDuration(ms) {
    if (ms < 0) return "00:00:00";
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/3600).toString().padStart(2, '0')}:${Math.floor((s%3600)/60).toString().padStart(2, '0')}:${(s%60).toString().padStart(2, '0')}`;
}

// Dialog Utility
function showDialog({ title, message }) {
    const dialog = document.getElementById("game-dialog");
    document.getElementById("game-dialog-title").textContent = title;
    document.getElementById("game-dialog-message").textContent = message;
    dialog.classList.remove("hidden");
}

document.getElementById("game-dialog-confirm").onclick = () => document.getElementById("game-dialog").classList.add("hidden");
document.getElementById("game-dialog-cancel").onclick = () => document.getElementById("game-dialog").classList.add("hidden");

// Interactions
document.addEventListener('click', e => {
    const plot = e.target.closest('.plot');
    if (plot) {
        const index = parseInt(plot.dataset.plotIndex);
        const state = plotStates.find(s => s.slot_index === index);
        if (state.fase === 'ready') performAction('harvest', index);
        else if (state.fase === 'locked') performAction('buy_slot', index);
        else if (itemSelecionadoState.item) performAction('use_item', index, itemSelecionadoState.item);
    }
});

document.querySelectorAll(".sidebar .use-btn").forEach(btn => {
    btn.onclick = () => {
        const item = btn.dataset.item;
        selectItem(item === itemSelecionadoState.item ? null : item);
    };
});

// Modals
function setupModal(openBtnSelector, modalId, closeBtnSelector) {
    const openBtn = document.querySelector(openBtnSelector);
    const modal = document.getElementById(modalId);
    const closeBtn = modal?.querySelector(closeBtnSelector);
    if (!openBtn || !modal || !closeBtn) return;
    openBtn.onclick = () => {
        modal.style.display = "block";
        if (modalId === 'shop-modal') renderShopTab('itens');
    };
    closeBtn.onclick = () => modal.style.display = "none";
}

setupModal(".open-shop", "shop-modal", ".close-btn");
setupModal(".open-inventory", "inventory-modal", ".close-inventory");
setupModal(".open-worldtree", "worldtree-modal", ".close-worldtree");
setupModal("#admin-open", "admin-modal", "#admin-close");

// --- Admin Panel Logic ---
let availableAssets = [];

async function renderAdminTab(tabName) {
    const content = document.getElementById("admin-content");
    if (!content) return;

    if (tabName === 'itens') {
        const adminData = await apiFetch(`${ADMIN_API_BASE_URL}/config`);
        const assetsData = await apiFetch(`${ADMIN_API_BASE_URL}/assets`);
        availableAssets = assetsData.images;

        content.innerHTML = `
            <div class="admin-item-manager">
                <h3>Gerenciar Itens da Loja</h3>
                <button class="admin-action" onclick="showItemForm()">+ Adicionar Novo Item</button>
                <div class="admin-table-container">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>ID (Imagem)</th>
                                <th>Label</th>
                                <th>Tipo</th>
                                <th>Preço Ouro</th>
                                <th>Preço Diam.</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${adminData.items.map(item => `
                                <tr>
                                    <td>${item.item_id}</td>
                                    <td>${item.label}</td>
                                    <td>${item.tipo}</td>
                                    <td>${item.price_coins}</td>
                                    <td>${item.price_diamonds}</td>
                                    <td>
                                        <button onclick='showItemForm(${JSON.stringify(item)})'>Editar</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else {
        content.innerHTML = `<p>Aba ${tabName} em desenvolvimento.</p>`;
    }
}

function showItemForm(item = null) {
    const dialog = document.getElementById("game-dialog");
    const title = item ? "Editar Item" : "Novo Item";

    const formHtml = `
        <div class="admin-form">
            <div class="form-group">
                <label>ID do Item (deve ser o nome da imagem sem .png):</label>
                <input type="text" id="edit-item-id" value="${item?.item_id || ''}" ${item ? 'disabled' : ''}>
            </div>
            <div class="form-group">
                <label>Selecione a Imagem (Assets):</label>
                <select id="edit-item-asset" onchange="document.getElementById('edit-preview').src='assets/'+this.value">
                    <option value="">Selecione...</option>
                    ${availableAssets.map(img => `<option value="${img}" ${item && (img === item.item_id+'.png' || img === 'flores/'+item.item_id+'.png') ? 'selected' : ''}>${img}</option>`).join('')}
                </select>
                <img id="edit-preview" src="${item ? 'assets/'+getItemAsset(item.item_id) : ''}" style="width:50px; height:50px; margin-top:5px; border: 1px solid #555;">
            </div>
            <div class="form-group">
                <label>Nome Visível (Label):</label>
                <input type="text" id="edit-item-label" value="${item?.label || ''}">
            </div>
            <div class="form-group">
                <label>Tipo:</label>
                <select id="edit-item-tipo">
                    <option value="item" ${item?.tipo === 'item' ? 'selected' : ''}>Consumível (Vaso/Água/Pesticida)</option>
                    <option value="flower" ${item?.tipo === 'flower' ? 'selected' : ''}>Flor</option>
                    <option value="tree" ${item?.tipo === 'tree' ? 'selected' : ''}>Árvore</option>
                </select>
            </div>
            <div class="form-group">
                <label>Preço em Ouro:</label>
                <input type="number" id="edit-item-price-coins" value="${item?.price_coins || 0}">
            </div>
            <div class="form-group">
                <label>Preço em Diamantes:</label>
                <input type="number" id="edit-item-price-diamonds" value="${item?.price_diamonds || 0}">
            </div>
            <div class="form-group">
                <label>Recompensa Base (Ouro):</label>
                <input type="number" id="edit-item-reward" value="${item?.reward_base || 0}">
            </div>
            <div class="form-group">
                <label>Tempo de Crescimento (Horas):</label>
                <input type="number" step="0.01" id="edit-item-grow" value="${item?.grow_hours || 0}">
            </div>
        </div>
    `;

    document.getElementById("game-dialog-title").textContent = title;
    document.getElementById("game-dialog-message").innerHTML = formHtml;
    dialog.classList.remove("hidden");

    document.getElementById("game-dialog-confirm").onclick = async () => {
        const data = {
            item_id: document.getElementById("edit-item-id").value,
            label: document.getElementById("edit-item-label").value,
            tipo: document.getElementById("edit-item-tipo").value,
            price_coins: parseInt(document.getElementById("edit-item-price-coins").value),
            price_diamonds: parseInt(document.getElementById("edit-item-price-diamonds").value),
            reward_base: parseFloat(document.getElementById("edit-item-reward").value),
            grow_hours: parseFloat(document.getElementById("edit-item-grow").value),
            image_asset: document.getElementById("edit-item-asset").value
        };

        try {
            await apiFetch(`${ADMIN_API_BASE_URL}/items/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            dialog.classList.add("hidden");
            renderAdminTab('itens');
            loadGameState();
        } catch (err) {
            alert("Erro ao salvar: " + err.message);
        }
    };
}

document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.onclick = () => {
        document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        renderAdminTab(tab.dataset.adminTab);
    };
});

// Update modal open to render first tab
const adminOpenBtn = document.querySelector("#admin-open");
if (adminOpenBtn) {
    adminOpenBtn.onclick = () => {
        const modal = document.getElementById("admin-modal");
        modal.classList.remove("hidden");
        modal.style.display = "block";
        renderAdminTab('itens');
    }
}

const adminCloseBtn = document.querySelector("#admin-close");
if (adminCloseBtn) {
    adminCloseBtn.onclick = () => {
        const modal = document.getElementById("admin-modal");
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
}

const logoutBtn = document.querySelector(".logout-btn");
if (logoutBtn) {
    logoutBtn.onclick = logout;
}

document.querySelectorAll(".shop-tab").forEach(tab => {
    tab.onclick = () => {
        document.querySelectorAll(".shop-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        renderShopTab(tab.dataset.tab);
    };
});

// --- Init ---
renderPlots(); // Force initial render of slots
loadGameState();
setInterval(() => {
    if (plotStates.length > 0) {
        plotStates.forEach((_, i) => renderPlotState(i));
    } else {
        // If state hasn't loaded yet, just update the waiting timers
        for (let i = 0; i < 8; i++) {
            const plotEl = document.querySelector(`.plot[data-plot-index="${i}"]`);
            if (plotEl) {
                const timer = plotEl.querySelector(".timer");
                if (timer) timer.textContent = "CARREGANDO...";
            }
        }
    }
}, 1000);
