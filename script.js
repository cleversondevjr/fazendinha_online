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
    window.location.href = "login.html";
}

document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('keydown', resetInactivityTimer);
document.addEventListener('click', resetInactivityTimer);
resetInactivityTimer();

// --- Core API ---
async function apiFetch(endpoint, options = {}) {
    // Ensure credentials (cookies) are sent with every request
    options.credentials = 'include';
    const res = await fetch(endpoint, options);
    if (res.status === 401) {
        console.warn("Sessão expirada ou não autorizada (Modo Teste Ativo)");
        // No modo teste, não redirecionamos
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

        // Aplica o layout salvo nas configurações
        if (configs.active_layout && configs.active_layout !== 'default') {
            applyLayout(configs.active_layout);
        }

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
        if (res.success) {
            await loadGameState();
            if (action === 'buy_item') showDialog({ title: "Loja", message: "Item comprado com sucesso!" });
            if (action === 'water_world_tree') showDialog({ title: "Árvore Mundial", message: "Obrigado por sua contribuição!" });
            if (action === 'claim_mission') showDialog({ title: "Missões", message: "Recompensa resgatada!" });
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
                    <div class="info">
                        <span class="timer">AGUARDANDO...</span>
                    </div>
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
    if (!grid || grid.children.length > 0) return; // Only generate if empty
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
    // Regra: Estágio 1 (0-40%), Estágio 2 (40-80%), Estágio 3 (80-100%)
    if (progress >= 0.80) stage = "adulta";
    else if (progress >= 0.40) stage = "broto";
    else stage = "semente";

    return { src: `assets/flores/${baseId}_${stage}.png`, stage, type };
}

function renderPlotState(index) {
    const plotEl = document.querySelector(`.plot[data-plot-index="${index}"]`);
    const state = plotStates.find(s => s.slot_index === index);
    if (!plotEl || !state) return;

    // Atualizar classes para CSS
    plotEl.className = `plot phase-${state.fase} ${state.fase}`;

    const slotPrices = [
        { type: 'gold', cost: 100 },
        { type: 'gold', cost: 500 },
        { type: 'gold', cost: 1000 },
        { type: 'gold', cost: 2500 },
        { type: 'gold', cost: 5000 },
        { type: 'gold', cost: 10000 },
        { type: 'diamond', cost: 1000 },
        { type: 'diamond', cost: 4000 }
    ];

    const bg = plotEl.querySelector(".plot-bg");
    const soil = plotEl.querySelector(".soil");
    soil.innerHTML = "";

    if (state.fase === 'locked') {
        bg.src = "assets/slot_comprar_terra_v5.png";
    } else if (state.fase === 'needsPot') {
        bg.src = "assets/slot_planta_v5.png";
    } else {
        bg.src = "assets/slot_planta_v5.png";
    }

    // --- Camada de Terreno ---
    if (state.fase !== 'locked') {
        const terrainImg = document.createElement("img");
        terrainImg.className = "terrain-layer";
        if (state.fase === 'needsPot') {
            terrainImg.src = "assets/terra_sem_pote.png";
        } else if (state.fase === 'needsWater') {
            terrainImg.src = "assets/terra_sem_agua.png";
        } else {
            terrainImg.src = "assets/terra_com_agua.png";
        }
        soil.appendChild(terrainImg);
    }

    const crop = getCropAsset(state);
    if (crop) {
        const img = document.createElement("img");
        img.className = `crop-layer crop-${crop.type} stage-${crop.stage}`;
        img.src = crop.src;
        soil.appendChild(img);
    }

    // --- Overlay de Corvo e Praga no Solo (facilitando identificação) ---
    if (state.crow_active) {
        const crow = document.createElement("div");
        crow.className = "danger-sign danger-crow";
        crow.innerHTML = `<div class="danger-plaque">CORVO!</div><img src="assets/corvo.png" alt="Corvo">`;
        soil.appendChild(crow);

        const crowOverlay = document.createElement("img");
        crowOverlay.src = "assets/corvo.png";
        crowOverlay.className = "hazard-overlay hazard-crow";
        soil.appendChild(crowOverlay);
    }

    if (state.pest_active) {
        const pestOverlay = document.createElement("img");
        pestOverlay.src = "assets/larva.png";
        pestOverlay.className = "hazard-overlay hazard-pest";
        soil.appendChild(pestOverlay);
    }

    // --- Renderização dos 5 Ícones de Status ---
    const slots = plotEl.querySelectorAll(".status-slot");
    slots.forEach(s => {
        s.innerHTML = ""; // Limpar
        s.style.visibility = "hidden"; // Ocultar quadradinhos vazios
    });

    // 1. Pote (Slot 1)
    if (state.pot_type) {
        const potImg = document.createElement("img");
        potImg.src = `assets/${state.pot_type === 'vasoGrande' ? 'vaso_grande.png' : 'vaso_pequeno.png'}`;
        slots[0].appendChild(potImg);
        slots[0].style.visibility = "visible";
    }
    // 2. Água (Slot 2)
    if (state.fase !== 'needsWater' && state.fase !== 'needsPot' && state.fase !== 'locked') {
        const waterImg = document.createElement("img");
        waterImg.src = "assets/agua.png";
        slots[1].appendChild(waterImg);
        slots[1].style.visibility = "visible";
    }
    // 3. Corvo (Slot 3)
    if (state.crow_active) {
        const crowIcon = document.createElement("img");
        crowIcon.src = "assets/corvo.png";
        slots[2].appendChild(crowIcon);
        slots[2].style.visibility = "visible";
    }
    // 4. Praga (Slot 4)
    if (state.pest_active) {
        const pestIcon = document.createElement("img");
        pestIcon.src = "assets/larva.png";
        slots[3].appendChild(pestIcon);
        slots[3].style.visibility = "visible";
    }
    // 5. Espantalho (Slot 5)
    if (state.scarecrow_until && new Date(state.scarecrow_until).getTime() > Date.now()) {
        const scIcon = document.createElement("img");
        scIcon.src = "assets/espantalho.png";
        slots[4].appendChild(scIcon);
        slots[4].style.visibility = "visible";
    }

    const timer = plotEl.querySelector(".timer");
    if (state.fase === 'locked') {
        const p = slotPrices[index];
        timer.innerHTML = `COMPRAR ${p.cost} <img src="assets/${p.type === 'gold' ? 'ouro' : 'diamante'}.png" style="width:14px; vertical-align:middle;">`;
    } else if (state.fase === 'growing') {
        const remaining = new Date(state.ends_at).getTime() - Date.now();
        const isPaused = state.crow_active || state.fase === 'needsPot' || state.fase === 'needsWater' || state.pest_active;
        timer.textContent = isPaused ? "PAUSADO" : `Tempo: ${formatDuration(remaining)}`;
    } else if (state.fase === 'ready') {
        timer.textContent = "COLHER!";
    } else {
        timer.textContent = state.fase.toUpperCase().replace('NEEDS', 'AGUARDANDO ');
    }

    // --- Controle de Visibilidade dos Botões de Ação ---
    const actions = plotEl.querySelector(".plot-actions");
    if (actions) {
        // Mostrar ações se não estiver bloqueado
        const isLocked = state.fase === 'locked';
        actions.style.display = isLocked ? "none" : "flex";

        const useBtn = actions.querySelector(".usar");
        if (useBtn) {
            if (state.fase === 'ready') {
                useBtn.style.backgroundImage = "url('assets/botao_coletar_tudo.png')";
                useBtn.style.visibility = "visible";
                useBtn.dataset.action = "harvest";
            } else {
                useBtn.style.backgroundImage = "url('assets/botao_usar.png')";
                useBtn.style.visibility = "visible";
                useBtn.dataset.action = "use";
            }
        }

        const removeBtn = actions.querySelector(".remove");
        if (removeBtn) {
            // Mostrar remover apenas se houver algo no slot que não seja 'locked' ou 'needsPot'
            const canRemove = (state.fase !== 'locked' && state.fase !== 'needsPot');
            removeBtn.style.visibility = canRemove ? "visible" : "hidden";
            removeBtn.dataset.action = "remove";
        }
    }
}

function renderMissions() {
    const list = document.getElementById("missions-list");
    if (!list || !missionsState.length) {
        if (list) list.innerHTML = "<p style='font-size:12px; opacity:0.7;'>Nenhuma missão ativa.</p>";
        return;
    }

    // Exibir apenas a primeira missão ativa por vez conforme solicitado
    const mission = missionsState.find(m => !m.claimed) || missionsState[0];

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
            <p style="font-size: 9px; margin-top: 5px; text-align: center; opacity: 0.6;">Próxima missão em: <span id="mission-timer">--:--</span></p>
        </div>
    `;

    updateMissionTimer();
}

function updateMissionTimer() {
    const el = document.getElementById("mission-timer");
    if (!el) return;

    const now = new Date();
    const nextRotation = new Date();
    nextRotation.setHours(Math.ceil((now.getHours() + 0.1) / 4) * 4, 0, 0, 0);

    const diff = nextRotation - now;
    el.textContent = formatDuration(diff);
}

function getItemAsset(itemId) {
    // Primeiro verifica se temos uma configuração dinâmica para este item
    const item = itemShopPrices[itemId] || cropCatalog[itemId];
    if (item && item.image_asset) {
        // Se já tem o caminho completo (ex: flores/imagem.png), retorna ele
        if (item.image_asset.includes('/')) return item.image_asset;
        return item.image_asset;
    }

    const mappings = {
        'vasoPequeno': 'vaso_pequeno.png',
        'vasoGrande': 'vaso_grande.png',
        'agua': 'agua.png',
        'pesticida': 'borrifador_inseticida.png',
        'espantalho': 'espantalho.png'
    };

    if (mappings[itemId]) return mappings[itemId];

    // Fallback para flores que não estão no mapeamento estático mas seguem o padrão de nome
    if (cropCatalog[itemId]) return `flores/${itemId}_adulta.png`;

    return `${itemId}.png`;
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
    const coinsEl = document.getElementById("coins");
    const diamondsEl = document.getElementById("diamonds");
    const energyEl = document.getElementById("energy");

    if (coinsEl) coinsEl.textContent = inventario.coins || 0;
    if (diamondsEl) diamondsEl.textContent = inventario.diamante || 0;
    if (energyEl) energyEl.textContent = inventario.energia || 0;

    renderMissions();
    updateSidebarCounts();
    renderWeather();

    // Atualiza a árvore mundial se o modal estiver aberto
    const treeModal = document.getElementById("worldtree-modal");
    if (treeModal && treeModal.style.display === "block") {
        renderWorldTree();
    }
}

function renderWeather() {
    const icon = document.getElementById("weather-icon");
    if (!icon) return;
    const weather = configs.current_weather || 'sunny';
    const mappings = {
        'sunny': 'clima_sol_v1.png',
        'rainy': 'clima_chuva_v1.png',
        'windy': 'clima_vento_v1.png'
    };
    icon.src = `assets/${mappings[weather] || 'caixa_clima.png'}`;
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

function applyLayout(name) {
    let link = document.getElementById('theme-link');
    if (!link) {
        link = document.createElement('link');
        link.id = 'theme-link';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
    if (!name || name === 'default') {
        link.href = '';
    } else {
        link.href = `sketches/css/${name}.css`;
    }
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
    const btn = e.target.closest('.plot-action-btn');
    if (btn) {
        const plot = btn.closest('.plot');
        const index = parseInt(plot.dataset.plotIndex);
        const action = btn.dataset.action;

        if (action === 'use') {
            const state = plotStates.find(s => s.slot_index === index);
            if (state.fase === 'locked') performAction('buy_slot', index);
            else if (itemSelecionadoState.item) performAction('use_item', index, itemSelecionadoState.item);
        } else if (action === 'harvest') {
            performAction('harvest', index);
        } else if (action === 'remove') {
            if (confirm("Deseja realmente remover o conteúdo deste slot? (Nenhum recurso será devolvido)")) {
                performAction('remove_plant', index);
            }
        }
        return;
    }

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

// Ensure setupModal calls renderWorldTree
const openTreeBtn = document.querySelector(".open-worldtree");
if (openTreeBtn) {
    const originalClick = openTreeBtn.onclick;
    openTreeBtn.onclick = () => {
        if (originalClick) originalClick();
        renderWorldTree();
    };
}

function renderWorldTree() {
    const panel = document.getElementById("worldtree-panel");
    if (!panel || !worldTreeState) {
        if (panel) panel.innerHTML = "<p>Nenhum dado da Árvore Mundial disponível no momento.</p>";
        return;
    }

    const progress = Math.min(100, (worldTreeState.agua_atual / worldTreeState.meta_agua) * 100);

    panel.innerHTML = `
        <div class="worldtree-summary">
            <div class="worldtree-visual">
                <img src="assets/arvore_mundial_v1.png" class="worldtree-art" onerror="this.src='assets/logo_fazendinha_online.png'">
            </div>
            <div class="worldtree-stats">
                <p>Status: <strong>${progress >= 100 ? 'Meta Atingida!' : 'Crescendo...'}</strong></p>
                <div class="worldtree-progress">
                    <div class="worldtree-progress-bar" style="width: ${progress}%"></div>
                </div>
                <p>Geral: ${worldTreeState.agua_atual} / ${worldTreeState.meta_agua} gotas</p>
                <p>Sua contribuição ajuda a todos!</p>
            </div>
        </div>
        <div class="worldtree-donations">
            <button class="worldtree-donate" onclick="performAction('water_world_tree')">
                Regar Árvore (1 gota)
            </button>
            <button class="worldtree-donate" onclick="performAction('collect_tree_reward')" ${!worldTreeState.reward_available ? 'disabled' : ''}>
                Coletar Recompensa Coletiva
            </button>
        </div>
        <div class="worldtree-donation-log">
            <p><small>* Você pode contribuir com até 2 gotas a cada 6 horas.</small></p>
            <p><small>* A recompensa de 100 Ouro é liberada para todos que contribuíram no dia, assim que a meta for atingida.</small></p>
        </div>
    `;
}

// --- Admin Panel Logic ---
let availableAssets = [];

async function renderAdminTab(tabName) {
    const content = document.getElementById("admin-content");
    if (!content) return;

    if (tabName === 'conta') {
        content.innerHTML = `
            <div class="admin-account-manager">
                <h3>Gerenciar Recursos do Jogador</h3>
                <div class="admin-inline-actions">
                    <input type="number" id="admin-user-search-id" placeholder="ID do Usuário">
                    <button class="admin-action primary" onclick="searchUserAccount()">Buscar</button>
                </div>
                <div id="admin-user-result" class="admin-grid" style="margin-top: 20px;">
                    <p>Digite um ID e clique em buscar.</p>
                </div>
            </div>
        `;
    } else if (tabName === 'slots') {
        content.innerHTML = `
            <div class="admin-slots-manager">
                <h3>Gerenciar Slots de Jogador</h3>
                <div class="admin-inline-actions">
                    <input type="number" id="admin-slots-search-id" placeholder="ID do Usuário">
                    <button class="admin-action primary" onclick="searchUserSlots()">Buscar Slots</button>
                </div>
                <div id="admin-slots-result" style="margin-top: 20px;"></div>
            </div>
        `;
    } else if (tabName === 'plantas') {
        const adminData = await apiFetch(`${ADMIN_API_BASE_URL}/config`);
        const crops = adminData.items.filter(i => i.tipo === 'flower');
        content.innerHTML = `
            <div class="admin-crops-manager">
                <h3>Parâmetros de Flores</h3>
                <div class="admin-table-container">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Label</th>
                                <th>Tempo (h)</th>
                                <th>Recompensa</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${crops.map(c => `
                                <tr>
                                    <td>${c.item_id}</td>
                                    <td>${c.label}</td>
                                    <td><input type="number" step="0.1" id="crop-grow-${c.item_id}" value="${c.grow_hours}"></td>
                                    <td><input type="number" id="crop-reward-${c.item_id}" value="${c.reward_base}"></td>
                                    <td><button onclick="saveCropParams('${c.item_id}')">Salvar</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (tabName === 'arvores') {
        const adminData = await apiFetch(`${ADMIN_API_BASE_URL}/config`);
        const trees = adminData.items.filter(i => i.tipo === 'tree');
        content.innerHTML = `
            <div class="admin-crops-manager">
                <h3>Parâmetros de Árvores</h3>
                <div class="admin-table-container">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Label</th>
                                <th>Tempo (h)</th>
                                <th>Recompensa</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${trees.map(c => `
                                <tr>
                                    <td>${c.item_id}</td>
                                    <td>${c.label}</td>
                                    <td><input type="number" step="0.1" id="crop-grow-${c.item_id}" value="${c.grow_hours}"></td>
                                    <td><input type="number" id="crop-reward-${c.item_id}" value="${c.reward_base}"></td>
                                    <td><button onclick="saveCropParams('${c.item_id}')">Salvar</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (tabName === 'itens') {
        const adminData = await apiFetch(`${ADMIN_API_BASE_URL}/config`);
        const assetsData = await apiFetch(`${ADMIN_API_BASE_URL}/assets`);
        availableAssets = assetsData.images;
        const items = adminData.items.filter(i => i.tipo === 'item');

        content.innerHTML = `
            <div class="admin-item-manager">
                <h3>Gerenciar Itens de Consumo</h3>
                <button class="admin-action" onclick="showItemForm()">+ Adicionar Novo Item</button>
                <div class="admin-table-container">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>ID (Imagem)</th>
                                <th>Label</th>
                                <th>Preço Ouro</th>
                                <th>Preço Diam.</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td>${item.item_id}</td>
                                    <td>${item.label}</td>
                                    <td>${item.price_coins}</td>
                                    <td>${item.price_diamonds}</td>
                                    <td>
                                        <button onclick='showItemForm(${JSON.stringify(item)})'>Editar</button>
                                        <button class="admin-danger" onclick="deleteItemAdmin('${item.item_id}')">Excluir</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (tabName === 'missoes') {
        const adminData = await apiFetch(`${ADMIN_API_BASE_URL}/config`);
        content.innerHTML = `
            <div class="admin-mission-manager">
                <h3>Modelos de Missões</h3>
                <button class="admin-action" onclick="showMissionForm()">+ Criar Missão</button>
                <div class="admin-table-container">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Label</th>
                                <th>Tipo</th>
                                <th>Meta</th>
                                <th>Recompensa</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${adminData.missions.map(m => `
                                <tr>
                                    <td>${m.id}</td>
                                    <td>${m.label}</td>
                                    <td>${m.tipo}</td>
                                    <td>${m.target}</td>
                                    <td>${m.reward_amount} ${m.reward_type}</td>
                                    <td>
                                        <button onclick='showMissionForm(${JSON.stringify(m)})'>Editar</button>
                                        <button class="admin-danger" onclick="deleteMissionAdmin(${m.id})">Excluir</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (tabName === 'regras') {
        const adminData = await apiFetch(`${ADMIN_API_BASE_URL}/config`);
        const currentLayout = adminData.configs.find(c => c.chave === 'active_layout')?.valor || 'default';

        content.innerHTML = `
            <div class="admin-rules-manager">
                <h3>Aparência e Layout</h3>
                <div class="admin-card" style="margin-bottom: 20px; border: 2px solid #ffeb3b;">
                    <div class="admin-field">
                        <label>Escolher Layout do Jogo</label>
                        <select id="config-active_layout" onchange="applyLayout(this.value)">
                            <option value="default" ${currentLayout === 'default' ? 'selected' : ''}>Original (Roxo)</option>
                            <option value="immersive" ${currentLayout === 'immersive' ? 'selected' : ''}>Imersivo (Glassmorphism)</option>
                            <option value="retro" ${currentLayout === 'retro' ? 'selected' : ''}>Retrô RPG (Madeira/Papel)</option>
                            <option value="neon" ${currentLayout === 'neon' ? 'selected' : ''}>Neon Moderno (PvU 2.0)</option>
                            <option value="junina" ${currentLayout === 'junina' ? 'selected' : ''}>Festa Junina (Brasil)</option>
                            <option value="kids" ${currentLayout === 'kids' ? 'selected' : ''}>Dia das Crianças</option>
                            <option value="natal" ${currentLayout === 'natal' ? 'selected' : ''}>Natal</option>
                            <option value="anonovo" ${currentLayout === 'anonovo' ? 'selected' : ''}>Ano Novo</option>
                        </select>
                        <p><small>O layout muda instantaneamente para você. Clique abaixo para salvar para todos.</small></p>
                        <button class="admin-action primary" onclick="saveConfig('active_layout')">Salvar Layout para Todos</button>
                    </div>
                </div>

                <h3>Configurações Globais</h3>
                <div class="admin-grid">
                    ${adminData.configs.filter(c => c.chave !== 'active_layout').map(c => `
                        <div class="admin-card">
                            <div class="admin-field">
                                <label>${c.chave}</label>
                                <input type="text" id="config-${c.chave}" value="${c.valor}">
                                <small>${c.descricao || ''}</small>
                                <button class="admin-action" onclick="saveConfig('${c.chave}')">Atualizar</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (tabName === 'dados') {
        const stats = await apiFetch(`${ADMIN_API_BASE_URL}/stats`);
        content.innerHTML = `
            <div class="admin-stats">
                <h3>Estatísticas do Jogo</h3>
                <div class="admin-grid">
                    <div class="admin-card">
                        <p>Total de Jogadores: <strong>${stats.totalUsers}</strong></p>
                    </div>
                    <div class="admin-card">
                        <p>Slots Desbloqueados: <strong>${stats.activeSlots}</strong></p>
                    </div>
                    <div class="admin-card">
                        <p>Total Ouro em Circulação: <strong>${stats.totalEconomy}</strong></p>
                    </div>
                </div>
            </div>
        `;
    } else {
        content.innerHTML = `<p>Aba ${tabName} em desenvolvimento.</p>`;
    }
}

async function searchUserAccount() {
    const id = document.getElementById("admin-user-search-id").value;
    if (!id) return alert("Digite um ID válido.");

    try {
        const data = await apiFetch(`${ADMIN_API_BASE_URL}/user/${id}`);
        const resultDiv = document.getElementById("admin-user-result");

        // Build inventory list
        const invEntries = Object.entries(data.inventory)
            .filter(([key]) => !['coins', 'diamante', 'energia'].includes(key))
            .map(([key, qty]) => `
                <div class="admin-field" style="grid-template-columns: 1fr 80px;">
                    <label>${key}</label>
                    <input type="number" class="edit-user-inv-item" data-item-id="${key}" value="${qty}">
                </div>
            `).join('');

        resultDiv.innerHTML = `
            <div class="admin-card">
                <h3>Recursos</h3>
                <div class="admin-field">
                    <label>ID do Usuário</label>
                    <input type="text" value="${data.usuario_id}" disabled>
                </div>
                <div class="admin-field">
                    <label>Ouro (Coins)</label>
                    <input type="number" id="edit-user-ouro" value="${data.ouro}">
                </div>
                <div class="admin-field">
                    <label>Diamantes</label>
                    <input type="number" id="edit-user-diamante" value="${data.diamante}">
                </div>
                <div class="admin-field">
                    <label>Energia</label>
                    <input type="number" id="edit-user-energia" value="${data.energia}">
                </div>

                <h3 style="margin-top:20px;">Inventário (Itens)</h3>
                ${invEntries}

                <div class="admin-field" style="margin-top:10px;">
                    <label>Adicionar Novo Item</label>
                    <select id="add-user-item-id">
                        <option value="">Selecione...</option>
                        ${data.availableItems.map(i => `<option value="${i.item_id}">${i.label}</option>`).join('')}
                    </select>
                    <input type="number" id="add-user-item-qty" placeholder="Qtd" value="1">
                </div>

                <button class="admin-action primary" onclick="saveUserAccount(${data.usuario_id})">Salvar Tudo</button>
            </div>
        `;
    } catch (err) {
        alert("Erro ao buscar usuário: " + err.message);
    }
}

async function searchUserSlots() {
    const id = document.getElementById("admin-slots-search-id").value;
    if (!id) return alert("Digite um ID válido.");
    try {
        const res = await apiFetch(`${ADMIN_API_BASE_URL}/user/${id}/slots`);
        const container = document.getElementById("admin-slots-result");
        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr><th>Slot</th><th>Fase</th><th>Planta</th><th>Vaso</th><th>Ações</th></tr>
                </thead>
                <tbody>
                    ${res.slots.map(s => `
                        <tr>
                            <td>${s.slot_index}</td>
                            <td>
                                <select id="slot-fase-${s.id}">
                                    <option value="locked" ${s.fase === 'locked' ? 'selected' : ''}>Bloqueado</option>
                                    <option value="needsPot" ${s.fase === 'needsPot' ? 'selected' : ''}>Sem Vaso</option>
                                    <option value="needsWater" ${s.fase === 'needsWater' ? 'selected' : ''}>Sem Água</option>
                                    <option value="readyToPlant" ${s.fase === 'readyToPlant' ? 'selected' : ''}>Pronto p/ Plantar</option>
                                    <option value="growing" ${s.fase === 'growing' ? 'selected' : ''}>Crescendo</option>
                                    <option value="ready" ${s.fase === 'ready' ? 'selected' : ''}>Pronto p/ Colher</option>
                                </select>
                            </td>
                            <td><input type="text" id="slot-crop-${s.id}" value="${s.crop_id || ''}"></td>
                            <td><input type="text" id="slot-pot-${s.id}" value="${s.pot_type || ''}"></td>
                            <td><button onclick="saveSlotAdmin(${s.id})">Salvar</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) { alert(err.message); }
}

async function saveSlotAdmin(slotId) {
    const data = {
        id: slotId,
        fase: document.getElementById(`slot-fase-${slotId}`).value,
        crop_id: document.getElementById(`slot-crop-${slotId}`).value || null,
        pot_type: document.getElementById(`slot-pot-${slotId}`).value || null
    };
    await apiFetch(`${ADMIN_API_BASE_URL}/slots/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    alert("Slot atualizado!");
}

async function deleteItemAdmin(itemId) {
    if (!confirm(`Tem certeza que deseja excluir o item ${itemId}?`)) return;
    try {
        await apiFetch(`${ADMIN_API_BASE_URL}/items/${itemId}`, { method: 'DELETE' });
        renderAdminTab('itens');
    } catch (err) { alert(err.message); }
}

async function deleteMissionAdmin(id) {
    if (!confirm(`Tem certeza que deseja excluir a missão ID ${id}?`)) return;
    try {
        await apiFetch(`${ADMIN_API_BASE_URL}/missions/${id}`, { method: 'DELETE' });
        renderAdminTab('missoes');
    } catch (err) { alert(err.message); }
}

async function saveCropParams(itemId) {
    const grow = parseFloat(document.getElementById(`crop-grow-${itemId}`).value);
    const reward = parseFloat(document.getElementById(`crop-reward-${itemId}`).value);

    // Precisamos buscar o objeto completo para não perder outros campos no save_item
    const adminData = await apiFetch(`${ADMIN_API_BASE_URL}/config`);
    const item = adminData.items.find(i => i.item_id === itemId);

    const data = { ...item, grow_hours: grow, reward_base: reward };
    await apiFetch(`${ADMIN_API_BASE_URL}/items/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    alert("Parâmetros salvos!");
}

async function saveUserAccount(userId) {
    const items = {};
    document.querySelectorAll(".edit-user-inv-item").forEach(input => {
        items[input.dataset.itemId] = parseInt(input.value);
    });

    const newItemId = document.getElementById("add-user-item-id").value;
    if (newItemId) {
        const newItemQty = parseInt(document.getElementById("add-user-item-qty").value);
        items[newItemId] = (items[newItemId] || 0) + newItemQty;
    }

    const data = {
        usuario_id: userId,
        ouro: parseInt(document.getElementById("edit-user-ouro").value),
        diamante: parseInt(document.getElementById("edit-user-diamante").value),
        energia: parseInt(document.getElementById("edit-user-energia").value),
        items: items
    };

    try {
        await apiFetch(`${ADMIN_API_BASE_URL}/user/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        alert("Dados da conta salvos com sucesso!");
        searchUserAccount(); // Refresh
        if (String(userId) === String(inventario.usuario_id || '1')) {
            loadGameState();
        }
    } catch (err) {
        alert("Erro ao salvar: " + err.message);
    }
}

async function saveConfig(chave) {
    const valor = document.getElementById(`config-${chave}`).value;
    try {
        await apiFetch(`${ADMIN_API_BASE_URL}/config/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chave, valor })
        });
        alert('Configuração atualizada!');
        renderAdminTab('regras');
    } catch (err) {
        alert('Erro ao salvar: ' + err.message);
    }
}

function showMissionForm(mission = null) {
    const dialog = document.getElementById("game-dialog");
    const formHtml = `
        <div class="admin-form">
            <input type="hidden" id="edit-mission-id" value="${mission?.id || ''}">
            <div class="form-group">
                <label>Label:</label>
                <input type="text" id="edit-mission-label" value="${mission?.label || ''}">
            </div>
            <div class="form-group">
                <label>Tipo:</label>
                <select id="edit-mission-tipo">
                    <option value="harvest_count" ${mission?.tipo === 'harvest_count' ? 'selected' : ''}>Colheitas Realizadas</option>
                    <option value="water_count" ${mission?.tipo === 'water_count' ? 'selected' : ''}>Regas Realizadas</option>
                </select>
            </div>
            <div class="form-group">
                <label>Meta (Quantidade):</label>
                <input type="number" id="edit-mission-target" value="${mission?.target || 1}">
            </div>
            <div class="form-group">
                <label>Recompensa (Tipo):</label>
                <select id="edit-mission-reward-type">
                    <option value="coins" ${mission?.reward_type === 'coins' ? 'selected' : ''}>Ouro</option>
                    <option value="diamante" ${mission?.reward_type === 'diamante' ? 'selected' : ''}>Diamante</option>
                    <option value="energia" ${mission?.reward_type === 'energia' ? 'selected' : ''}>Energia</option>
                </select>
            </div>
            <div class="form-group">
                <label>Recompensa (Quantidade):</label>
                <input type="number" id="edit-mission-reward-amount" value="${mission?.reward_amount || 0}">
            </div>
            <div class="form-group">
                <label>Peso (Raridade):</label>
                <input type="number" id="edit-mission-weight" value="${mission?.weight || 1}">
            </div>
        </div>
    `;

    document.getElementById("game-dialog-title").textContent = mission ? "Editar Missão" : "Nova Missão";
    document.getElementById("game-dialog-message").innerHTML = formHtml;
    dialog.classList.remove("hidden");

    document.getElementById("game-dialog-confirm").onclick = async () => {
        const data = {
            id: document.getElementById("edit-mission-id").value,
            label: document.getElementById("edit-mission-label").value,
            tipo: document.getElementById("edit-mission-tipo").value,
            target: parseInt(document.getElementById("edit-mission-target").value),
            reward_type: document.getElementById("edit-mission-reward-type").value,
            reward_amount: parseInt(document.getElementById("edit-mission-reward-amount").value),
            weight: parseInt(document.getElementById("edit-mission-weight").value),
            active: true
        };
        await apiFetch(`${ADMIN_API_BASE_URL}/missions/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        dialog.classList.add("hidden");
        renderAdminTab('missoes');
    };
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
        renderAdminTab('conta');
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
    logoutBtn.onclick = () => alert("Modo de teste: Logout desativado.");
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
        updateMissionTimer();

        // Atualiza clima visual a cada minuto para garantir que mudou
        renderWeather();
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
