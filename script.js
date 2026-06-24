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

// --- Core API ---
async function apiFetch(endpoint, options = {}) {
    // Ensure credentials (cookies) are sent with every request
    options.credentials = 'include';
    const res = await fetch(endpoint, options);
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro: ${res.status}`);
    }
    return res.json();
}

async function loadGameState() {
    try {
        const data = await apiFetch(`${API_BASE_URL}/state`);
        inventario = data.inventory;
        plotStates = data.slots;
        missionsState = data.missions;
        worldTreeState = data.worldTree;
        configs = data.configs;

        const adminData = await apiFetch(`${ADMIN_API_BASE_URL}/config`);
        itemShopPrices = adminData.items.filter(i => i.tipo === 'item').reduce((acc, i) => ({ ...acc, [i.item_id]: i }), {});
        cropCatalog = adminData.items.filter(i => i.tipo === 'flower' || i.tipo === 'tree').reduce((acc, i) => ({ ...acc, [i.item_id]: i }), {});

        renderPlots();
        renderAll();
    } catch (err) {
        console.error("Erro ao carregar estado:", err);
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

function renderShopTab(tabName) {
    const grid = document.getElementById("shop-grid");
    if (!grid) return;
    let items = [];
    if (tabName === 'itens') items = Object.values(itemShopPrices);
    else if (tabName === 'flores') items = Object.values(cropCatalog).filter(c => c.tipo === 'flower');
    else if (tabName === 'arvores') items = Object.values(cropCatalog).filter(c => c.tipo === 'tree');
    grid.innerHTML = items.map(item => `
        <div class="shop-item">
            <img src="assets/${item.item_id}.png" onerror="this.src='assets/flores/${item.item_id}.png'">
            <p>${item.label}</p>
            <p>${item.price_coins} Ouro</p>
            <button class="buy-btn" onclick="performAction('buy_item', null, '${item.item_id}')">Comprar</button>
        </div>
    `).join("");
}

function renderInventory() {
    const grid = document.getElementById("inventory-grid");
    if (!grid) return;
    grid.innerHTML = Object.entries(inventario).filter(([id, qty]) => qty > 0 && !['coins', 'diamante', 'energia'].includes(id)).map(([id, qty]) => `
        <div class="inventory-item ${itemSelecionadoState.item === id ? 'selected' : ''}">
            <img src="assets/${id}.png" onerror="this.src='assets/flores/${id}.png'">
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

document.querySelectorAll(".shop-tab").forEach(tab => {
    tab.onclick = () => {
        document.querySelectorAll(".shop-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        renderShopTab(tab.dataset.tab);
    };
});

// --- Init ---
loadGameState();
setInterval(() => {
    plotStates.forEach((_, i) => renderPlotState(i));
}, 1000);
