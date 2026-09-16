// ==========================================
// WARFRAME GPS — CLEAN V3
// ==========================================

const API = "https://api.warframestat.us";
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchResults = document.getElementById("searchResults");
let currentItem = null;

async function searchItem() {
    const query = searchInput.value.trim();
    if (!query) return showMessage("Entre le nom d'un objet à rechercher.");
    showLoading(`Recherche de "${query}"...`);
    try {
        let items = await searchDirect(query);
        if (!items.length) items = await searchAllItems(query);
        if (!items.length) return showMessage(`Aucun résultat trouvé pour "${query}".`);
        currentItem = chooseBestResult(items, query);
        displayGPS(currentItem);
    } catch (error) {
        console.error("WARFRAME GPS ERROR:", error);
        showMessage("Impossible de récupérer les données. Réessaie dans quelques instants.");
    }
}

async function searchDirect(query) {
    try {
        const response = await fetch(`${API}/items/search/${encodeURIComponent(query)}`);
        if (!response.ok) return [];
        return normalizeResults(await response.json());
    } catch (error) {
        console.error("Direct search error:", error);
        return [];
    }
}

async function searchAllItems(query) {
    const response = await fetch(`${API}/items`);
    if (!response.ok) return [];
    const items = normalizeResults(await response.json());
    const q = normalizeText(query);
    return items.filter(item => item?.name && normalizeText(item.name).includes(q));
}

function normalizeResults(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && typeof data === "object") return [data];
    return [];
}

function normalizeText(text) {
    return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function chooseBestResult(items, query) {
    const q = normalizeText(query);
    return items.find(item => item?.name && normalizeText(item.name) === q) || items[0];
}

function displayGPS(item) {
    const name = item.name || "Objet inconnu";
    const category = item.category || item.type || item.productCategory || "Objet Warframe";
    const description = item.description || "Aucune description disponible.";
    const image = item.imageName ? `https://cdn.warframestat.us/img/${item.imageName}` : null;
    const drops = getDrops(item);
    const components = getComponents(item);

    searchResults.innerHTML = `
        <div class="result-card gps-card">
            ${buildHeader(name, category, image)}
            <p class="item-description">${escapeHTML(description)}</p>
            ${buildSmartRoute(item, drops, components)}
            ${buildDrops(drops)}
            ${buildComponents(components, name)}
            ${buildGPSAdvice(drops, components)}
        </div>`;
}

function buildHeader(name, category, image) {
    return `<div class="result-header">
        ${image ? `<img class="item-image" src="${image}" alt="${escapeHTML(name)}">` : ""}
        <div><span class="gps-label">GPS ACTIVE</span><h3>${escapeHTML(name)}</h3>
        <span class="result-category">${escapeHTML(category)}</span></div>
    </div>`;
}

function getDrops(item) {
    const drops = [];
    if (Array.isArray(item.drops)) drops.push(...item.drops);
    if (Array.isArray(item.dropLocations)) {
        item.dropLocations.forEach(location => drops.push(typeof location === "string" ? { location } : location));
    }
    return drops;
}

function getComponents(item) {
    return Array.isArray(item.components) ? item.components : [];
}

function getChance(drop) {
    const chance = Number(drop?.chance);
    return Number.isFinite(chance) ? chance : 0;
}

function chancePercent(chance) {
    const value = Number(chance);
    if (!Number.isFinite(value)) return 0;
    return value <= 1 ? value * 100 : value;
}

function formatChance(chance) {
    const value = chancePercent(chance);
    return Number.isFinite(value) ? `${value.toFixed(2)} %` : "Non précisée";
}

function chooseBestDrop(drops) {
    return drops.length ? [...drops].sort((a, b) => chancePercent(getChance(b)) - chancePercent(getChance(a)))[0] : null;
}

function dropLocation(drop) {
    return drop?.location || drop?.place || drop?.node || drop?.mission || "Destination inconnue";
}

function buildRoute(drop) {
    if (!drop) return `<div class="gps-route"><span class="gps-label">ROUTE GPS</span><h4>Localisation automatique indisponible</h4><p>Aucun drop direct exploitable n'a été identifié.</p></div>`;
    return `<div class="gps-route"><span class="gps-label">DESTINATION RECOMMANDÉE</span>
        <h4>${escapeHTML(dropLocation(drop))}</h4><p>Chance : <strong>${formatChance(getChance(drop))}</strong>
        ${drop.rarity ? ` • ${escapeHTML(drop.rarity)}` : ""}</p></div>`;
}

function buildSmartRoute(item, drops, components) {
    const category = normalizeText(item.category || item.type || item.productCategory || "");
    return category.includes("warframe") ? buildWarframeRoute(components, item.name) : buildRoute(chooseBestDrop(drops));
}

function analyzeLocation(location) {
    const text = String(location || "");
    const rotationMatch = text.match(/Rotation\s+([ABC])/i);
    let missionType = "Inconnue";
    const known = ["Capture", "Exterminate", "Disruption", "Rescue", "Spy", "Survival", "Defense", "Assassination", "Excavation", "Interception"];
    const found = known.find(type => normalizeText(text).includes(normalizeText(type)));
    if (found) missionType = found;
    else {
        const missionMatch = text.match(/\(([^)]+)\)/i);
        if (missionMatch) missionType = missionMatch[1].replace(/Rotation\s+[ABC]/i, "").trim() || "Inconnue";
    }
    return { missionType, rotation: rotationMatch ? rotationMatch[1].toUpperCase() : null };
}

function getRotationScore(rotation) {
    return ({ A: 15, B: 10, C: 5 })[rotation] ?? 8;
}

function getMissionScore(missionType) {
    const mission = normalizeText(missionType);
    if (mission.includes("capture")) return 15;
    if (mission.includes("exterminate")) return 13;
    if (mission.includes("disruption") || mission.includes("rescue")) return 12;
    if (mission.includes("spy")) return 10;
    if (mission.includes("survival")) return 8;
    if (mission.includes("defense")) return 7;
    return 8;
}

function calculateGPSScore(route) {
    if (!route) return 0;
    const components = route.components || [];
    const averageChance = components.length
        ? components.reduce((sum, c) => sum + chancePercent(c.chance), 0) / components.length : 0;
    const mission = analyzeLocation(route.location);
    const componentScore = Math.min(components.length * 20, 40);
    const chanceScore = Math.min(averageChance * 1.5, 30);
    return Math.min(100, Math.round(componentScore + chanceScore + getRotationScore(mission.rotation) + getMissionScore(mission.missionType)));
}

function getGPSScoreLabel(score) {
    if (score >= 80) return "EXCELLENT";
    if (score >= 60) return "TRÈS BON";
    if (score >= 40) return "BON";
    return "STANDARD";
}

function buildWarframeRoute(components, itemName) {
    if (!components.length) return `<div class="gps-route"><span class="gps-label">ROUTE GPS WARFRAME</span><h4>Données de fabrication indisponibles</h4></div>`;

    const remaining = components.filter(c => !isComponentOwned(itemName, c.name || "Composant"));
    if (!remaining.length) return `<div class="smart-route"><span class="gps-label">PROGRESSION</span><h4>✓ Tous les composants sont obtenus</h4><p class="route-explanation">La route GPS est terminée pour ${escapeHTML(itemName)}.</p></div>`;

    const destinations = {};
    remaining.forEach(component => {
        if (!Array.isArray(component.drops)) return;
        component.drops.forEach(drop => {
            const location = dropLocation(drop);
            if (location === "Destination inconnue") return;
            if (!destinations[location]) destinations[location] = { location, components: [], totalChance: 0 };
            const chance = getChance(drop);
            destinations[location].components.push({ name: component.name || "Composant", chance, rarity: drop.rarity || "" });
            destinations[location].totalChance += chancePercent(chance);
        });
    });

    const routes = Object.values(destinations);
    if (!routes.length) return `<div class="gps-route"><span class="gps-label">ROUTE GPS WARFRAME</span><h4>Analyse des composants</h4><p>Les composants restants ne possèdent pas de mission directe exploitable.</p></div>`;

    routes.forEach(route => route.gpsScore = calculateGPSScore(route));
    routes.sort((a, b) => b.gpsScore - a.gpsScore || b.totalChance - a.totalChance);
    const best = routes[0];
    const mission = analyzeLocation(best.location);
    const average = best.components.reduce((sum, c) => sum + chancePercent(c.chance), 0) / best.components.length;

    return `<div class="smart-route">
        <div class="smart-route-header"><div><span class="gps-label">ROUTE GPS OPTIMISÉE</span><h4>${escapeHTML(best.location)}</h4></div>
        <span class="route-badge">★ ROUTE PRINCIPALE</span>
        <div class="gps-score"><span>EFFICACITÉ GPS</span><strong>${best.gpsScore}/100</strong><small>${getGPSScoreLabel(best.gpsScore)}</small></div></div>
        <p class="route-explanation">Cette destination permet d'obtenir <strong>${best.components.length}</strong> composant(s) encore nécessaire(s).</p>
        <div class="route-components">${best.components.map(c => `<div class="route-component"><div><span>COMPOSANT</span><strong>${escapeHTML(c.name)}</strong></div><div><span>CHANCE</span><strong>${formatChance(c.chance)}</strong></div></div>`).join("")}</div>
        <details class="gps-explanation"><summary>Pourquoi cette route ?</summary><div class="gps-explanation-content">
            <p>✓ ${best.components.length} composant(s) farmable(s) ici</p><p>✓ Chance moyenne : ${average.toFixed(2)} %</p>
            <p>⚡ Mission : ${escapeHTML(mission.missionType)}</p><p>⟳ Rotation : ${mission.rotation || "Non précisée"}</p></div></details>
        ${routes.length > 1 ? buildAlternativeRoutes(routes.slice(1, 4)) : ""}
    </div>`;
}

function buildAlternativeRoutes(routes) {
    if (!routes.length) return "";
    return `<details class="smart-alternatives"><summary>Voir les routes alternatives</summary>${routes.map(route =>
        `<div class="smart-alternative"><div><strong>${escapeHTML(route.location)}</strong><span>${route.components.length} composant(s) • GPS ${route.gpsScore}/100</span></div></div>`
    ).join("")}</details>`;
}

function buildDrops(drops) {
    if (!drops.length) return "";
    const sorted = [...drops].sort((a, b) => chancePercent(getChance(b)) - chancePercent(getChance(a))).slice(0, 8);
    return `<div class="drops-section"><h4>AUTRES DESTINATIONS</h4>${sorted.map(drop =>
        `<div class="drop-row"><span>${escapeHTML(dropLocation(drop))}</span><strong>${formatChance(getChance(drop))}</strong></div>`
    ).join("")}</div>`;
}

function buildComponents(components, itemName) {
    if (!components.length) return "";
    return `<div class="components-section"><h4>ROUTE DE FABRICATION</h4>${components.map((component, index) => {
        const name = component.name || "Composant";
        const quantity = component.itemCount || component.quantity || component.count || 1;
        const drops = Array.isArray(component.drops) ? component.drops : [];
        const bestDrop = chooseBestDrop(drops);
        const owned = isComponentOwned(itemName, name);
        const image = component.imageName ? `https://cdn.warframestat.us/img/${component.imageName}` : null;
        let destination = owned
            ? `<div class="owned-message">✓ Composant déjà obtenu — retiré de la route GPS.</div>`
            : bestDrop
                ? `<div class="component-destination"><span>DESTINATION RECOMMANDÉE</span><strong>${escapeHTML(dropLocation(bestDrop))}</strong><small>Chance : ${formatChance(getChance(bestDrop))}${bestDrop.rarity ? ` • ${escapeHTML(bestDrop.rarity)}` : ""}</small></div>`
                : `<div class="component-destination"><span>ACQUISITION</span><strong>Pas de drop direct identifié</strong></div>`;
        return `<div class="component-route ${owned ? "component-owned" : ""}"><div class="component-gps"><div class="component-number">${owned ? "✓" : index + 1}</div>
            <div class="component-main"><div class="component-header">${image ? `<img class="component-image" src="${image}" alt="${escapeHTML(name)}">` : ""}
            <div><strong>${escapeHTML(name)}</strong><span>Quantité : ${quantity}</span></div>
            <label class="owned-toggle"><input type="checkbox" ${owned ? "checked" : ""} onchange="toggleComponent('${escapeJS(itemName)}','${escapeJS(name)}',this.checked)"><span>Je l'ai</span></label></div>
            ${destination}${!owned && drops.length > 1 ? buildComponentAlternatives(drops) : ""}</div></div></div>`;
    }).join("")}</div>`;
}

function buildComponentAlternatives(drops) {
    const sorted = [...drops].sort((a, b) => chancePercent(getChance(b)) - chancePercent(getChance(a)));
    return `<details class="component-alternatives"><summary>Voir les autres destinations</summary>${sorted.slice(1, 6).map(drop =>
        `<div class="alternative-row"><span>${escapeHTML(dropLocation(drop))}</span><strong>${formatChance(getChance(drop))}</strong></div>`
    ).join("")}</details>`;
}

function buildGPSAdvice(drops, components) {
    if (components.length) return `<div class="gps-advice"><span class="gps-label">ANALYSE GPS</span><p>Warframe GPS analyse les composants et leurs destinations afin de proposer une route de farm. Les composants cochés comme obtenus sont retirés automatiquement.</p></div>`;
    if (drops.length) return `<div class="gps-advice"><span class="gps-label">ANALYSE GPS</span><p>La destination affichée est basée sur les données de drop disponibles. Une probabilité plus élevée ne signifie pas toujours que la mission est la plus rapide en pratique.</p></div>`;
    return "";
}

function getOwnedComponents() {
    try { return JSON.parse(localStorage.getItem("warframeGPS_ownedComponents_v2")) || {}; }
    catch { return {}; }
}

function componentStorageKey(itemName, componentName) {
    return `${normalizeText(itemName)}::${normalizeText(componentName)}`;
}

function isComponentOwned(itemName, componentName) {
    return getOwnedComponents()[componentStorageKey(itemName, componentName)] === true;
}

function toggleComponent(itemName, componentName, checked) {
    const owned = getOwnedComponents();
    const key = componentStorageKey(itemName, componentName);
    if (checked) owned[key] = true; else delete owned[key];
    localStorage.setItem("warframeGPS_ownedComponents_v2", JSON.stringify(owned));
    if (currentItem) displayGPS(currentItem);
}

function searchComponent(name) {
    searchInput.value = name;
    searchItem();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showLoading(message) { showMessage(message); }
function showMessage(message) {
    searchResults.innerHTML = `<div class="result-card"><strong>${escapeHTML(message)}</strong></div>`;
}
function selectCategory(category) {
    searchInput.focus();
    searchInput.placeholder = `Recherche : ${category}`;
}
function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}
function escapeJS(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r?\n/g, " ");
}

if (searchButton) searchButton.addEventListener("click", searchItem);
if (searchInput) searchInput.addEventListener("keydown", event => { if (event.key === "Enter") searchItem(); });
