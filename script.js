// ==========================================
// WARFRAME GPS
// ==========================================

const API = "https://api.warframestat.us";

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchResults = document.getElementById("searchResults");

let currentItem = null;


// ==========================================
// RECHERCHE
// ==========================================

async function searchItem() {

    const query = searchInput.value.trim();

    if (!query) {
        showMessage("Entre le nom d'un objet à rechercher.");
        return;
    }

    showLoading(`Recherche de "${query}"...`);

    try {

        let items = await searchDirect(query);

        if (!items.length) {
            items = await searchAllItems(query);
        }

        if (!items.length) {
            showMessage(
                `Aucun résultat trouvé pour "${escapeHTML(query)}".`
            );
            return;
        }

        const item = chooseBestResult(items, query);

        currentItem = item;

        displayGPS(item);

    } catch (error) {

        console.error("WARFRAME GPS ERROR:", error);

        searchResults.innerHTML = `
            <div class="result-card">
                <strong>Impossible de récupérer les données.</strong>

                <p class="item-description">
                    La base Warframe est peut-être temporairement
                    indisponible. Réessaie dans quelques instants.
                </p>
            </div>
        `;
    }
}


// ==========================================
// API
// ==========================================

async function searchDirect(query) {

    try {

        const response = await fetch(
            `${API}/items/search/${encodeURIComponent(query)}`
        );

        if (!response.ok) {
            return [];
        }

        const data = await response.json();

        return normalizeResults(data);

    } catch (error) {

        console.error("Direct search error:", error);

        return [];
    }
}


async function searchAllItems(query) {

    const response = await fetch(`${API}/items`);

    if (!response.ok) {
        return [];
    }

    const data = await response.json();

    const items = normalizeResults(data);

    const normalizedQuery = normalizeText(query);

    return items.filter(item => {

        if (!item || !item.name) {
            return false;
        }

        const name = normalizeText(item.name);

        return (
            name === normalizedQuery ||
            name.includes(normalizedQuery)
        );
    });
}


// ==========================================
// NORMALISATION
// ==========================================

function normalizeResults(data) {

    if (Array.isArray(data)) {
        return data;
    }

    if (data && Array.isArray(data.items)) {
        return data.items;
    }

    if (data && typeof data === "object") {
        return [data];
    }

    return [];
}


function normalizeText(text) {

    return String(text)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}


function chooseBestResult(items, query) {

    const normalizedQuery = normalizeText(query);

    const exact = items.find(item =>
        item.name &&
        normalizeText(item.name) === normalizedQuery
    );

    return exact || items[0];
}


// ==========================================
// AFFICHAGE PRINCIPAL
// ==========================================

function displayGPS(item) {

    const name =
        item.name ||
        "Objet inconnu";

    const category =
        item.category ||
        item.type ||
        item.productCategory ||
        "Objet Warframe";

    const description =
        item.description ||
        "Aucune description disponible.";

    const image = item.imageName
        ? `https://cdn.warframestat.us/img/${item.imageName}`
        : null;

    const drops = getDrops(item);

    const components = getComponents(item);

    searchResults.innerHTML = `

        <div class="result-card gps-card">

            ${buildHeader(
                name,
                category,
                image
            )}

            <p class="item-description">
                ${escapeHTML(description)}
            </p>

            ${buildSmartRoute(
                item,
                drops,
                components
            )}

            ${buildDrops(drops)}

            ${buildComponents(
                components,
                name
            )}

            ${buildGPSAdvice(
                item,
                drops,
                components
            )}

        </div>
    `;
}


// ==========================================
// HEADER
// ==========================================

function buildHeader(name, category, image) {

    return `

        <div class="result-header">

            ${
                image
                    ? `
                        <img
                            class="item-image"
                            src="${image}"
                            alt="${escapeHTML(name)}"
                        >
                    `
                    : ""
            }

            <div>

                <span class="gps-label">
                    GPS ACTIVE
                </span>

                <h3>
                    ${escapeHTML(name)}
                </h3>

                <span class="result-category">
                    ${escapeHTML(category)}
                </span>

            </div>

        </div>
    `;
}


// ==========================================
// DROPS
// ==========================================

function getDrops(item) {

    let drops = [];

    if (Array.isArray(item.drops)) {
        drops.push(...item.drops);
    }

    if (Array.isArray(item.dropLocations)) {

        item.dropLocations.forEach(location => {

            if (typeof location === "string") {

                drops.push({
                    location: location
                });

            } else {

                drops.push(location);
            }
        });
    }

    return drops;
}


function chooseBestDrop(drops) {

    if (!drops.length) {
        return null;
    }

    return [...drops].sort(
        (a, b) =>
            getChance(b) - getChance(a)
    )[0];
}


function getChance(drop) {

    const chance =
        Number(drop?.chance);

    if (!Number.isFinite(chance)) {
        return 0;
    }

    return chance;
}


function formatChance(chance) {

    const value =
        Number(chance);

    if (!Number.isFinite(value)) {
        return "Non précisée";
    }

    const percentage =
        value <= 1
            ? value * 100
            : value;

    return `${percentage.toFixed(2)} %`;
}


// ==========================================
// ROUTE SIMPLE
// ==========================================

function buildRoute(drop) {

    if (!drop) {

        return `

            <div class="gps-route">

                <span class="gps-label">
                    ROUTE GPS
                </span>

                <h4>
                    Localisation automatique indisponible
                </h4>

                <p>
                    Aucun drop direct exploitable
                    n'a été identifié.
                </p>

            </div>
        `;
    }

    const location =
        drop.location ||
        drop.place ||
        drop.node ||
        drop.mission ||
        "Destination inconnue";

    return `

        <div class="gps-route">

            <span class="gps-label">
                DESTINATION RECOMMANDÉE
            </span>

            <h4>
                ${escapeHTML(location)}
            </h4>

            <p>
                Chance :
                <strong>
                    ${formatChance(getChance(drop))}
                </strong>

                ${
                    drop.rarity
                        ? ` • ${escapeHTML(drop.rarity)}`
                        : ""
                }
            </p>

        </div>
    `;
}


// ==========================================
// ROUTE INTELLIGENTE
// ==========================================

function buildSmartRoute(item, drops, components) {

    const category = normalizeText(
        item.category ||
        item.type ||
        item.productCategory ||
        ""
    );

    const isWarframe =
        category.includes("warframe");

    if (!isWarframe) {

        const bestDrop =
            chooseBestDrop(drops);

        return buildRoute(bestDrop);
    }

    return buildWarframeRoute(
        components,
        item.name
    );
}


// ==========================================
// ROUTE WARFRAME
// ==========================================
// ==========================================
// GPS SCORE V1
// ==========================================
// ==========================================
// ANALYSE MISSION / ROTATION
// ==========================================

function analyzeLocation(location) {

    const text = String(location || "");

    const missionMatch = text.match(/\(([^)]+)\)/i);
    const rotationMatch = text.match(/Rotation\s+([ABC])/i);

    return {
        missionType: missionMatch
            ? missionMatch[1].trim()
            : "Inconnue",

        rotation: rotationMatch
            ? rotationMatch[1].toUpperCase()
            : null
    };
}


function getRotationScore(rotation) {

    switch (rotation) {

        case "A":
            return 15;

        case "B":
            return 10;

        case "C":
            return 5;

        default:
            return 8;
    }
}


function getMissionScore(missionType) {

    const mission = normalizeText(missionType);

    // V2 : valeurs provisoires.
    // Elles représentent une préférence d'efficacité
    // et seront affinées avec de vraies données de durée.

    if (mission.includes("capture")) {
        return 15;
    }

    if (mission.includes("exterminate")) {
        return 13;
    }

    if (mission.includes("disruption")) {
        return 12;
    }

    if (mission.includes("rescue")) {
        return 12;
    }

    if (mission.includes("spy")) {
        return 10;
    }

    if (mission.includes("survival")) {
        return 8;
    }

    if (mission.includes("defense")) {
        return 7;
    }

    return 8;
}
// ==========================================
// GPS SCORE V2
// ==========================================

function analyzeLocation(location) {

    const text = String(location || "");

    const missionMatch = text.match(/\(([^)]+)\)/i);
    const rotationMatch = text.match(/Rotation\s+([ABC])/i);

    return {
        missionType: missionMatch
            ? missionMatch[1].trim()
            : "Inconnue",

        rotation: rotationMatch
            ? rotationMatch[1].toUpperCase()
            : null
    };
}


function getRotationScore(rotation) {

    switch (rotation) {

        case "A":
            return 15;

        case "B":
            return 10;

        case "C":
            return 5;

        default:
            return 8;
    }
}


function getMissionScore(missionType) {

    const mission = normalizeText(missionType);

    if (mission.includes("capture")) {
        return 15;
    }

    if (mission.includes("exterminate")) {
        return 13;
    }

    if (mission.includes("disruption")) {
        return 12;
    }

    if (mission.includes("rescue")) {
        return 12;
    }

    if (mission.includes("spy")) {
        return 10;
    }

    if (mission.includes("survival")) {
        return 8;
    }

    if (mission.includes("defense")) {
        return 7;
    }

    return 8;
}


function calculateGPSScore(route) {

    if (!route) {
        return 0;
    }

    const componentCount = route.components.length;

    const chances = route.components.map(component => {

        const chance = Number(component.chance) || 0;

        return chance <= 1
            ? chance * 100
            : chance;
    });


    const averageChance = chances.length
        ? chances.reduce(
            (total, chance) => total + chance,
            0
        ) / chances.length
        : 0;


    const missionData =
        analyzeLocation(route.location);


    // Maximum 40 points : composants regroupés
    const componentScore =
        Math.min(componentCount * 20, 40);


    // Maximum 30 points : chance moyenne
    const chanceScore =
        Math.min(averageChance * 1.5, 30);


    // Maximum 15 points : rotation
    const rotationScore =
        getRotationScore(missionData.rotation);


    // Maximum 15 points : type de mission
    const missionScore =
        getMissionScore(missionData.missionType);


    return Math.round(
        componentScore +
        chanceScore +
        rotationScore +
        missionScore
    );
}


function getGPSScoreLabel(score) {

    if (score >= 80) {
        return "EXCELLENT";
    }

    if (score >= 60) {
        return "TRÈS BON";
    }

    if (score >= 40) {
        return "BON";
    }

    return "STANDARD";
}

    if (score >= 80) {
        return "EXCELLENT";
    }

    if (score >= 60) {
        return "TRÈS BON";
    }

    if (score >= 40) {
        return "BON";
    }

    return "STANDARD";
}
function buildWarframeRoute(
    components,
    itemName
) {

    if (!components.length) {

        return `

            <div class="gps-route">

                <span class="gps-label">
                    ROUTE GPS WARFRAME
                </span>

                <h4>
                    Données de fabrication indisponibles
                </h4>

            </div>
        `;
    }


    // Ignore les composants déjà obtenus

    const remainingComponents =
        components.filter(component => {

            const name =
                component.name ||
                "Composant";

            return !isComponentOwned(
                itemName,
                name
            );
        });


    // Tout est obtenu

    if (!remainingComponents.length) {

        return `

            <div class="smart-route">

                <span class="gps-label">
                    PROGRESSION
                </span>

                <h4>
                    ✓ Tous les composants sont obtenus
                </h4>

                <p class="route-explanation">
                    La route GPS est terminée pour
                    ${escapeHTML(itemName)}.
                </p>

            </div>
        `;
    }


    const destinations = {};


    remainingComponents.forEach(component => {

        if (!Array.isArray(component.drops)) {
            return;
        }


        component.drops.forEach(drop => {

            const location =
                drop.location ||
                drop.place ||
                drop.node ||
                drop.mission;

            if (!location) {
                return;
            }


            if (!destinations[location]) {

                destinations[location] = {

                    location: location,

                    components: [],

                    totalChance: 0
                };
            }


            destinations[location]
                .components
                .push({

                    name:
                        component.name ||
                        "Composant",

                    chance:
                        getChance(drop),

                    rarity:
                        drop.rarity ||
                        ""
                });


            destinations[location]
                .totalChance +=
                getChance(drop);
        });
    });


    const routes =
        Object.values(destinations);


    if (!routes.length) {

        return `

            <div class="gps-route">

                <span class="gps-label">
                    ROUTE GPS WARFRAME
                </span>

                <h4>
                    Analyse des composants
                </h4>

                <p>
                    Certains composants restants
                    ne possèdent pas de mission
                    directe exploitable.
                </p>

            </div>
        `;
    }


    routes.forEach(route => {

    route.gpsScore =
        calculateGPSScore(route);

});


routes.sort((a, b) => {

    if (b.gpsScore !== a.gpsScore) {
        return b.gpsScore - a.gpsScore;
    }

    return (
        b.totalChance -
        a.totalChance
    );
});


    const bestRoute =
        routes[0];


    return `

        <div class="smart-route">

            <div class="smart-route-header">

                <div>

                    <span class="gps-label">
                        ROUTE GPS OPTIMISÉE
                    </span>

                    <h4>
                        ${escapeHTML(bestRoute.location)}
                    </h4>

                </div>

                <span class="route-badge">
                    ★ ROUTE PRINCIPALE
                </span>
<div class="gps-score">

    <span>
        EFFICACITÉ GPS
    </span>

    <strong>
        ${bestRoute.gpsScore}/100
    </strong>

    <small>
        ${getGPSScoreLabel(bestRoute.gpsScore)}
    </small>

</div>
            </div>


            <p class="route-explanation">

                Cette destination permet
                d'obtenir

                <strong>
                    ${bestRoute.components.length}
                </strong>

                composant(s) encore nécessaire(s).

            </p>


            <div class="route-components">

                ${bestRoute.components.map(component => `

                    <div class="route-component">

                        <div>
<div class="route-components">
...
</div>
                            <span>
                                COMPOSANT
                            </span>

                            <strong>
                                ${escapeHTML(component.name)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                CHANCE
                            </span>

                            <strong>
                                ${formatChance(component.chance)}
                            </strong>

                        </div>

                    </div>

                `).join("")}

            </div>

            ${
                routes.length > 1
                    ? buildAlternativeRoutes(
                        routes.slice(1, 4)
                    )
                    : ""
            }

        </div>
    `;
}

<details class="gps-explanation">

    <summary>
        Pourquoi cette route ?
    </summary>

    <div class="gps-explanation-content">

        <p>
            ✓ ${bestRoute.components.length}
            composant(s) farmable(s) ici
        </p>

        <p>
            ✓ Chance moyenne :
            ${
                formatChance(
                    bestRoute.components.reduce(
                        (total, component) =>
                            total + component.chance,
                        0
                    ) / bestRoute.components.length
                )
            }
        </p>

        <p>
            ⚡ Mission :
            ${
                escapeHTML(
                    analyzeLocation(
                        bestRoute.location
                    ).missionType
                )
            }
        </p>

        <p>
            ⟳ Rotation :
            ${
                analyzeLocation(
                    bestRoute.location
                ).rotation || "Non précisée"
            }
        </p>

    </div>

</details>
// ==========================================
// ROUTES ALTERNATIVES
// ==========================================

function buildAlternativeRoutes(routes) {

    if (!routes.length) {
        return "";
    }

    return `

        <details class="smart-alternatives">

            <summary>
                Voir les routes alternatives
            </summary>

            ${routes.map(route => `

                <div class="smart-alternative">

                    <div>

                        <strong>
                            ${escapeHTML(route.location)}
                        </strong>

                        <span>
                            ${route.components.length}
                            composant(s)
                        </span>

                    </div>

                </div>

            `).join("")}

        </details>
    `;
}


// ==========================================
// AUTRES DESTINATIONS
// ==========================================

function buildDrops(drops) {

    if (!drops.length) {
        return "";
    }


    const sorted =
        [...drops]
            .sort(
                (a, b) =>
                    getChance(b) -
                    getChance(a)
            )
            .slice(0, 8);


    return `

        <div class="drops-section">

            <h4>
                AUTRES DESTINATIONS
            </h4>

            ${sorted.map(drop => {

                const location =
                    drop.location ||
                    drop.place ||
                    drop.node ||
                    drop.mission ||
                    "Destination inconnue";

                return `

                    <div class="drop-row">

                        <span>
                            ${escapeHTML(location)}
                        </span>

                        <strong>
                            ${formatChance(
                                getChance(drop)
                            )}
                        </strong>

                    </div>
                `;

            }).join("")}

        </div>
    `;
}


// ==========================================
// COMPOSANTS
// ==========================================

function getComponents(item) {

    if (!Array.isArray(item.components)) {
        return [];
    }

    return item.components;
}


function buildComponents(
    components,
    itemName
) {

    if (!components.length) {
        return "";
    }


    return `

        <div class="components-section">

            <h4>
                ROUTE DE FABRICATION
            </h4>


            ${components.map(
                (component, index) => {

                    const name =
                        component.name ||
                        "Composant";

                    const quantity =
                        component.itemCount ||
                        component.quantity ||
                        component.count ||
                        1;

                    const drops =
                        Array.isArray(component.drops)
                            ? component.drops
                            : [];

                    const bestDrop =
                        chooseBestDrop(drops);

                    const owned =
                        isComponentOwned(
                            itemName,
                            name
                        );

                    const image =
                        component.imageName
                            ? `https://cdn.warframestat.us/img/${component.imageName}`
                            : null;


                    let destinationHTML = "";


                    if (owned) {

                        destinationHTML = `

                            <div class="owned-message">

                                ✓ Composant déjà obtenu —
                                retiré de la route GPS.

                            </div>
                        `;

                    } else if (bestDrop) {

                        const location =
                            bestDrop.location ||
                            bestDrop.place ||
                            bestDrop.node ||
                            bestDrop.mission ||
                            "Destination inconnue";


                        destinationHTML = `

                            <div class="component-destination">

                                <span>
                                    DESTINATION RECOMMANDÉE
                                </span>

                                <strong>
                                    ${escapeHTML(location)}
                                </strong>

                                <small>
                                    Chance :
                                    ${formatChance(
                                        getChance(bestDrop)
                                    )}

                                    ${
                                        bestDrop.rarity
                                            ? ` • ${escapeHTML(bestDrop.rarity)}`
                                            : ""
                                    }
                                </small>

                            </div>
                        `;

                    } else {

                        destinationHTML = `

                            <div class="component-destination">

                                <span>
                                    ACQUISITION
                                </span>

                                <strong>
                                    Pas de drop direct identifié
                                </strong>

                            </div>
                        `;
                    }


                    const alternatives =
                        !owned && drops.length > 1
                            ? buildComponentAlternatives(
                                drops
                            )
                            : "";


                    return `

                        <div class="
                            component-route
                            ${owned ? "component-owned" : ""}
                        ">

                            <div class="component-gps">

                                <div class="component-number">

                                    ${
                                        owned
                                            ? "✓"
                                            : index + 1
                                    }

                                </div>


                                <div class="component-main">

                                    <div class="component-header">

                                        ${
                                            image
                                                ? `
                                                    <img
                                                        class="component-image"
                                                        src="${image}"
                                                        alt="${escapeHTML(name)}"
                                                    >
                                                `
                                                : ""
                                        }


                                        <div>

                                            <strong>
                                                ${escapeHTML(name)}
                                            </strong>

                                            <span>
                                                Quantité : ${quantity}
                                            </span>

                                        </div>


                                        <label class="owned-toggle">

                                            <input
                                                type="checkbox"
                                                ${owned ? "checked" : ""}
                                                onchange="toggleComponent(
                                                    '${escapeJS(itemName)}',
                                                    '${escapeJS(name)}',
                                                    this.checked
                                                )"
                                            >

                                            <span>
                                                Je l'ai
                                            </span>

                                        </label>

                                    </div>


                                    ${destinationHTML}

                                    ${alternatives}

                                </div>

                            </div>

                        </div>
                    `;

                }
            ).join("")}

        </div>
    `;
}


// ==========================================
// ALTERNATIVES COMPOSANTS
// ==========================================

function buildComponentAlternatives(drops) {

    const sorted =
        [...drops].sort(
            (a, b) =>
                getChance(b) -
                getChance(a)
        );


    return `

        <details class="component-alternatives">

            <summary>
                Voir les autres destinations
            </summary>


            ${sorted.slice(1, 6).map(drop => {

                const location =
                    drop.location ||
                    drop.place ||
                    drop.node ||
                    drop.mission ||
                    "Destination inconnue";

                return `

                    <div class="alternative-row">

                        <span>
                            ${escapeHTML(location)}
                        </span>

                        <strong>
                            ${formatChance(
                                getChance(drop)
                            )}
                        </strong>

                    </div>
                `;

            }).join("")}

        </details>
    `;
}


// ==========================================
// CONSEIL GPS
// ==========================================

function buildGPSAdvice(
    item,
    drops,
    components
) {

    if (components.length) {

        return `

            <div class="gps-advice">

                <span class="gps-label">
                    ANALYSE GPS
                </span>

                <p>
                    Warframe GPS analyse les
                    composants et leurs destinations
                    afin de proposer une route de farm.
                    Les composants cochés comme obtenus
                    sont retirés automatiquement.
                </p>

            </div>
        `;
    }


    if (drops.length) {

        return `

            <div class="gps-advice">

                <span class="gps-label">
                    ANALYSE GPS
                </span>

                <p>
                    La destination affichée est basée
                    sur les données de drop disponibles.
                    Une probabilité plus élevée ne
                    signifie pas toujours que la mission
                    est la plus rapide en pratique.
                </p>

            </div>
        `;
    }


    return "";
}


// ==========================================
// PROGRESSION DU JOUEUR
// ==========================================

function getOwnedComponents() {

    try {

        return JSON.parse(
            localStorage.getItem(
                "warframeGPS_ownedComponents_v2"
            )
        ) || {};

    } catch {

        return {};
    }
}


function componentStorageKey(
    itemName,
    componentName
) {

    return (
        normalizeText(itemName) +
        "::" +
        normalizeText(componentName)
    );
}


function isComponentOwned(
    itemName,
    componentName
) {

    const owned =
        getOwnedComponents();

    const key =
        componentStorageKey(
            itemName,
            componentName
        );

    return owned[key] === true;
}


function toggleComponent(
    itemName,
    componentName,
    checked
) {

    const owned =
        getOwnedComponents();

    const key =
        componentStorageKey(
            itemName,
            componentName
        );


    if (checked) {

        owned[key] = true;

    } else {

        delete owned[key];
    }


    localStorage.setItem(
        "warframeGPS_ownedComponents_v2",
        JSON.stringify(owned)
    );


    // Recalcule immédiatement la page
    // sans refaire une requête API.

    if (currentItem) {
        displayGPS(currentItem);
    }
}


// ==========================================
// RECHERCHE DE COMPOSANT
// ==========================================

function searchComponent(name) {

    searchInput.value =
        name;

    searchItem();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// ==========================================
// INTERFACE
// ==========================================

function showLoading(message) {

    searchResults.innerHTML = `

        <div class="result-card">

            <strong>
                ${escapeHTML(message)}
            </strong>

        </div>
    `;
}


function showMessage(message) {

    searchResults.innerHTML = `

        <div class="result-card">

            <strong>
                ${escapeHTML(message)}
            </strong>

        </div>
    `;
}


function selectCategory(category) {

    searchInput.focus();

    searchInput.placeholder =
        `Recherche : ${category}`;
}


// ==========================================
// SÉCURITÉ HTML
// ==========================================

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        String(value);

    return div.innerHTML;
}


function escapeJS(value) {

    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}


// ==========================================
// ÉVÉNEMENTS
// ==========================================

if (searchButton) {

    searchButton.addEventListener(
        "click",
        searchItem
    );
}


if (searchInput) {

    searchInput.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {
                searchItem();
            }
        }
    );
}
