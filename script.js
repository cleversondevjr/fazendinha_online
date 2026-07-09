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
function onRareDrop() {
    console.log("Hooks: Rare Seed Dropped!");
}

function onLevelUp(level) {
    console.log("Hooks: Level Up to", level);
    showDialog({ title: "Celebrando!", message: `Parabéns! Você subiu para o nível ${level} no Passe de Temporada!` });
}

function onLockedFeature(msg) {
    showDialog({ title: "Em Breve", message: msg || "Esta função está no nosso Roadmap e será liberada em breve!" });
}

function onTransactionSuccess() {
    console.log("Hooks: Transaction Success!");
}

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
        console.warn("Sessão expirada ou não autorizada");
        window.location.href = "login.html"; // Redirecionamento corrigido
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

        if (configs.active_layout && configs.active_layout !== 'default') {
            applyLayout(configs.active_layout);
        }

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
        if(price) body.price = price;
        
        const res = await apiFetch(`${API_BASE_URL}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.success) {
            await loadGameState();
            onTransactionSuccess();
            if (res.leveledUp) onLevelUp(res.newLevel);
            if (action === 'buy_item' || action === 'buy_pack') showDialog({ title: "Loja", message: "Transação realizada com sucesso!" });
            if (action === 'water_world_tree') showDialog({ title: "Árvore Mundial", message: "Obrigado por sua contribuição!" });
            if (action === 'claim_mission') showDialog({ title: "Missões", message: "Recompensa resgatada!" });
            if (action === 'checkin') showDialog({ title: "Check-in", message: res.message });
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
    if (!grid || grid.children.length > 0) return;
    grid.innerHTML = Array.from({ length: 8 }, (_, i) => createPlot(i)).join("");
}

// --- UI Rendering ---
function getCropAsset(state) {
    if (!state.crop_id) return null;
    const baseId = state.crop_id.replace(/_(adulta|broto|semente|jovem)$/u, "");
    const progress = parseFloat(state.progress) || 0;
    const config = cropCatalog[state.crop_id] || {};
    const type = config.tipo || 'flower';

    let stage = "semente";
    if (progress >= 0.80) stage = "adulta";
    else if (progress >= 0.40) stage = "broto";
    else stage = "semente";

    return { src: `assets/flores/${baseId}_${stage}.png`, stage, type };
}

function renderPlotState(index) {
    const plotEl = document.querySelector(`.plot[data-plot-index="${index}"]`);
    const state = plotStates.find(s => s.slot_index === index);
    if (!plotEl || !state) return;

    plotEl.className = `plot phase-${state.fase} ${state.fase}`;
    const slotPrices = [{ type: 'gold', cost: 100 }, { type: 'gold', cost: 500 }, { type: 'gold', cost: 1000 }, { type: 'gold', cost: 2500 }, { type: 'gold', cost: 5000 }, { type: 'gold', cost: 10000 }, { type: 'diamond', cost: 1000 }, { type: 'diamond', cost: 4000 }];
    const bg = plotEl.querySelector(".plot-bg");
    const soil = plotEl.querySelector(".soil");
    soil.innerHTML = "";

    if (state.fase === 'locked') bg.src = "assets/slot_comprar_terra_v5.png";
    else bg.src = "assets/slot_planta_v5.png";

    if (state.fase !== 'locked') {
        const terrainImg = document.createElement("img");
        terrainImg.className = "terrain-layer";
        if (state.fase === 'needsPot') terrainImg.src = "assets/terra_sem_pote.png";
        else if (state.fase === 'needsWater') terrainImg.src = "assets/terra_sem_agua.png";
        else terrainImg.src = "assets/terra_com_agua.png";
        soil.appendChild(terrainImg);
    }

    const crop = getCropAsset(state);
    if (crop) {
        const img = document.createElement("img");
        img.className = `crop-layer crop-${crop.type} stage-${crop.stage}`;
        img.src = crop.src;
        soil.appendChild(img);
    }

    if (state.crow_active) {
        const crow = document.createElement("div");
        crow.className = "danger-sign danger-crow";
        crow.innerHTML = `<div class="danger-plaque">CORVO!</div><img src="assets/corvo.png" alt="Corvo">`;
        soil.appendChild(crow);
    }

    if (state.pest_active) {
        const pestOverlay = document.createElement("img");
        pestOverlay.src = "assets/larva.png";
        pestOverlay.className = "hazard-overlay hazard-pest";
        soil.appendChild(pestOverlay);
    }

    const slots = plotEl.querySelectorAll(".status-slot");
    slots.forEach(s => { s.innerHTML = ""; s.style.visibility = "hidden"; });

    if (state.pot_type) {
        const potImg = document.createElement("img");
        potImg.src = `assets/${state.pot_type === 'vasoGrande' ? 'vaso_grande.png' : 'vaso_pequeno.png'}`;
        slots[0].appendChild(potImg);
        slots[0].style.visibility = "visible";
    }
    if (state.fase !== 'needsWater' && state.fase !== 'needsPot' && state.fase !== 'locked') {
        const waterImg = document.createElement("img");
        waterImg.src = "assets/agua.png";
        slots[1].appendChild(waterImg);
        slots[1].style.visibility = "visible";
    }
    if (state.crow_active) { const crowIcon = document.createElement("img"); crowIcon.src = "assets/corvo.png"; slots[2].appendChild(crowIcon); slots[2].style.visibility = "visible"; }
    if (state.pest_active) { const pestIcon = document.createElement("img"); pestIcon.src = "assets/larva.png"; slots[3].appendChild(pestIcon); slots[3].style.visibility = "visible"; }
    if (state.scarecrow_until && new Date(state.scarecrow_until).getTime() > Date.now()) { const scIcon = document.createElement("img"); scIcon.src = "assets/espantalho.png"; slots[4].appendChild(scIcon); slots[4].style.visibility = "visible"; }

    const timer = plotEl.querySelector(".timer");
    if (state.fase === 'locked') {
        const p = slotPrices[index];
        timer.innerHTML = `COMPRAR ${p.cost} <img src="assets/${p.type === 'gold' ? 'ouro' : 'diamante'}.png" style="width:14px; vertical-align:middle;">`;
    } else if (state.fase === 'growing') {
        const remaining = new Date(state.ends_at).getTime() - Date.now();
        timer.textContent = (state.crow_active || state.pest_active) ? "PAUSADO" : `Tempo: ${formatDuration(remaining)}`;
    } else if (state.fase === 'ready') timer.textContent = "COLHER!";
    else timer.textContent = state.fase.toUpperCase().replace('NEEDS', 'AGUARDANDO ');
}

function renderMissions() {
    const list = document.getElementById("missions-list");
    if (!list) return;
    const mission = missionsState.find(m => !m.claimed) || missionsState[0];
    if(!mission) { list.innerHTML = "<p style='font-size:12px; opacity:0.7;'>Nenhuma missão ativa.</p>"; return; }
    list.innerHTML = `
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
    `;
}

function updateMissionTimer() {
    const el = document.getElementById("mission-timer");
    if (!el) return;
    const now = new Date();
    const nextRotation = new Date();
    nextRotation.setHours(Math.ceil((now.getHours() + 0.1) / 4) * 4, 0, 0, 0);
    el.textContent = formatDuration(nextRotation - now);
}

function getItemAsset(itemId) {
    const item = itemShopPrices[itemId] || cropCatalog[itemId];
    if (item && item.image_asset) return item.image_asset;
    const mappings = { 'vasoPequeno': 'vaso_pequeno.png', 'vasoGrande': 'vaso_grande.png', 'agua': 'agua.png', 'pesticida': 'borrifador_inseticida.png', 'espantalho': 'espantalho.png', 'flower': 'flor.png', 'tree': 'folha.png', 'sementeEspecial': 'semente.png' };
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
        grid.innerHTML = `<div class="shop-item"><img src="assets/ouro.png"><p>Pacote Ouro 1</p><button class="buy-btn" onclick="performAction('buy_pack', null, 'pack_gold_1')">Trocar</button></div>`;
        return;
    }
    grid.innerHTML = items.map(item => `
        <div class="shop-item">
            <img src="assets/${getItemAsset(item.item_id)}">
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
            <img src="assets/${getItemAsset(id)}">
            <p>${id}</p>
            <p>Qtd: ${qty}</p>
            <button class="use-btn" onclick="selectItem('${id}')">Selecionar</button>
        </div>
    `).join("");
}

function selectItem(id) {
    itemSelecionadoState.item = id;
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

function applyLayout(name) {
    let link = document.getElementById('theme-link');
    if (!link) {
        link = document.createElement('link');
        link.id = 'theme-link';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
    link.href = name === 'default' ? '' : `sketches/css/${name}.css`;
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
    if (!openBtn || !modal) return;
    openBtn.onclick = () => modal.style.display = "block";
    modal.querySelector(closeBtnSelector).onclick = () => modal.style.display = "none";
}

setupModal(".open-shop", "shop-modal", ".close-btn");
setupModal(".open-inventory", "inventory-modal", ".close-inventory");
setupModal(".open-worldtree", "worldtree-modal", ".close-worldtree");
setupModal("#admin-open", "admin-modal", "#admin-close");

// Interactions
document.addEventListener('click', e => {
    const btn = e.target.closest('.plot-action-btn');
    if (btn) {
        const index = parseInt(btn.closest('.plot').dataset.plotIndex);
        const action = btn.dataset.action;
        if (action === 'use') performAction('use_item', index, itemSelecionadoState.item);
        else if (action === 'harvest') performAction('harvest', index);
        else if (action === 'buy_slot') performAction('buy_slot', index);
        else if (action === 'remove') performAction('remove_plant', index);
    }
});

// --- Init ---
renderPlots();
loadGameState();
setInterval(() => {
    if (plotStates.length > 0) {
        plotStates.forEach((_, i) => renderPlotState(i));
    }
}, 1000);
```[cite: 1]
