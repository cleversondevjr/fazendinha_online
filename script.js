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
const INACTIVITY_LIMIT = 30 * 60 * 1000;
let inactivityTimer;

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(logout, INACTIVITY_LIMIT);
}

function logout() {
    document.cookie = "usuario_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    document.cookie = "fazendinha_sid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    window.location.href = "login.html";
}

document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('keydown', resetInactivityTimer);
document.addEventListener('click', resetInactivityTimer);
resetInactivityTimer();

// --- Hooks Spec V1.0 ---
function onRareDrop() { console.log("Hooks: Rare Seed Dropped!"); }
function onLevelUp(level) {
    console.log("Hooks: Level Up to", level);
    showDialog({ title: "Celebrando!", message: `Parabéns! Você subiu para o nível ${level} no Passe de Temporada!` });
}
function onLockedFeature(msg) {
    showDialog({ title: "Em Breve", message: msg || "Esta função está no nosso Roadmap e será liberada em breve!" });
}
function onTransactionSuccess() { console.log("Hooks: Transaction Success!"); }

// --- Core API ---
async function apiFetch(endpoint, options = {}) {
    options.credentials = 'include';
    const res = await fetch(endpoint, options);

    if (res.status === 503) {
        const data = await res.json().catch(() => ({}));
        if (data.maintenance) {
            const overlay = document.getElementById("maintenance-overlay");
            if (overlay) {
                overlay.classList.remove("hidden");
                document.getElementById("maintenance-message").textContent = data.message;
            }
            return;
        }
    }
    if (res.status === 401) {
        window.location.href = "login.html";
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
        const roadmap = data.roadmap || {};

        if (configs.active_layout && configs.active_layout !== 'default') applyLayout(configs.active_layout);

        document.querySelectorAll("[data-feature-key]").forEach(el => {
            const key = el.dataset.featureKey;
            if (roadmap[key]) {
                if (roadmap[key].released) {
                    el.classList.remove("feature-locked");
                    el.disabled = false;
                    el.title = "";
                } else {
                    el.classList.add("feature-locked");
                    el.disabled = true;
                    el.title = roadmap[key].message || "Em breve no Roadmap!";
                }
            }
        });

        const allItems = data.items || [];
        itemShopPrices = allItems.filter(i => i.tipo === 'item').reduce((acc, i) => ({ ...acc, [i.item_id]: i }), {});
        cropCatalog = allItems.filter(i => i.tipo === 'flower' || i.tipo === 'tree').reduce((acc, i) => ({ ...acc, [i.item_id]: i }), {});

        renderPlots();
        renderAll();
    } catch (err) {
        console.error("Erro ao carregar estado:", err);
        renderPlots();
    }
}

async function performAction(action, slotIndex = null, itemId = null, missionId = null, quantity = 1, price = null) {
    try {
        const body = { action, slotIndex, itemId, missionId, quantity };
        if (price) body.price = price;
        const res = await apiFetch(`${API_BASE_URL}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.success) {
            await loadGameState();
            onTransactionSuccess();
            if (res.leveledUp) onLevelUp(res.newLevel);
        }
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
                    <div class="info"><span class="timer">AGUARDANDO...</span></div>
                    <div class="soil"></div>
                    <div class="status-icons">
                        <div class="status-slot" data-status="pot"></div>
                        <div class="status-slot" data-status="water"></div>
                        <div class="status-slot" data-status="crow"></div>
                        <div class="status-slot" data-status="pest"></div>
                        <div class="status-slot" data-status="scarecrow"></div>
                    </div>
                    <div class="plot-actions">
                        <button class="plot-action-btn usar" type="button" data-action="use"></button>
                        <button class="plot-action-btn remove" type="button" data-action="remove"></button>
                    </div>
                </div>
            </div>
        </section>
    `;
}

function renderPlots() {
    const grid = document.getElementById("plot-grid");
    if (!grid) return;
    grid.innerHTML = Array.from({ length: 8 }, (_, i) => createPlot(i)).join("");
}

function getCropAsset(state) {
    if (!state.crop_id) return null;
    const baseId = state.crop_id.replace(/_(adulta|broto|semente|jovem)$/u, "");
    const progress = parseFloat(state.progress) || 0;
    let stage = progress >= 0.80 ? "adulta" : (progress >= 0.40 ? "broto" : "semente");
    return { src: `assets/flores/${baseId}_${stage}.png`, stage };
}

function renderPlotState(index) {
    const plotEl = document.querySelector(`.plot[data-plot-index="${index}"]`);
    const state = plotStates.find(s => s.slot_index === index);
    if (!plotEl || !state) return;

    plotEl.className = `plot phase-${state.fase} ${state.fase}`;
    const bg = plotEl.querySelector(".plot-bg");
    const soil = plotEl.querySelector(".soil");
    soil.innerHTML = "";

    bg.src = (state.fase === 'locked') ? "assets/slot_comprar_terra_v5.png" : "assets/slot_planta_v5.png";

    if (state.fase !== 'locked') {
        const terrainImg = document.createElement("img");
        terrainImg.className = "terrain-layer";
        terrainImg.src = (state.fase === 'needsPot') ? "assets/terra_sem_pote.png" : (state.fase === 'needsWater') ? "assets/terra_sem_agua.png" : "assets/terra_com_agua.png";
        soil.appendChild(terrainImg);
    }

    const crop = getCropAsset(state);
    if (crop) {
        const img = document.createElement("img");
        img.className = "crop-layer";
        img.src = crop.src;
        soil.appendChild(img);
    }

    const timer = plotEl.querySelector(".timer");
    if (state.fase === 'locked') timer.textContent = "COMPRAR";
    else if (state.fase === 'ready') timer.textContent = "COLHER!";
    else if (state.fase === 'growing') timer.textContent = "CRESCENDO";
    else timer.textContent = state.fase.toUpperCase();
}

function renderAll() {
    plotStates.forEach((_, i) => renderPlotState(i));
    document.getElementById("coins").textContent = inventario.coins || 0;
    document.getElementById("diamonds").textContent = inventario.diamante || 0;
    document.getElementById("energy").textContent = inventario.energia || 0;
}

function showDialog({ title, message }) {
    const dialog = document.getElementById("game-dialog");
    document.getElementById("game-dialog-title").textContent = title;
    document.getElementById("game-dialog-message").textContent = message;
    dialog.classList.remove("hidden");
    document.getElementById("game-dialog-confirm").onclick = () => dialog.classList.add("hidden");
}

function setupModal(openBtnSelector, modalId, closeBtnSelector) {
    const openBtn = document.querySelector(openBtnSelector);
    const modal = document.getElementById(modalId);
    if (openBtn && modal) {
        openBtn.onclick = () => modal.style.display = "block";
        modal.querySelector(closeBtnSelector).onclick = () => modal.style.display = "none";
    }
}

// Setup Modais
setupModal(".open-shop", "shop-modal", ".close-btn");
setupModal(".open-inventory", "inventory-modal", ".close-inventory");

// Interaction Handler
document.addEventListener('click', e => {
    const btn = e.target.closest('.plot-action-btn');
    if (!btn) return;

    const plotEl = btn.closest('.plot');
    const index = parseInt(plotEl.dataset.plotIndex);
    const state = plotStates.find(s => s.slot_index === index);
    let action = btn.dataset.action;

    if (state) {
        if (state.fase === 'ready') action = 'harvest';
        else if (state.fase === 'locked') action = 'buy_slot';
    }

    if (action === 'use') performAction('use_item', index, itemSelecionadoState.item);
    else if (action === 'harvest') performAction('harvest', index);
    else if (action === 'buy_slot') performAction('buy_slot', index);
    else if (action === 'remove') performAction('remove_plant', index);
});

// Init
renderPlots();
loadGameState();
setInterval(() => { if (plotStates.length > 0) plotStates.forEach((_, i) => renderPlotState(i)); }, 1000);
