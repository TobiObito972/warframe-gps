const API = "https://api.warframestat.us";

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchResults = document.getElementById("searchResults");


// ==========================================
// RECHERCHE PRINCIPALE
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

        // Si la recherche directe échoue,
        // on cherche dans la base complète.
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

        displayGPS(item);

    } catch (error) {

        console.error("WARFRAME GPS ERROR:", error);

        searchResults.innerHTML = `
            <div class="result-card">

                <strong>
                    Impossible de récupérer les données.
                </strong>

                <p class="item-description">
                    La base Warframe est peut-être temporairement
                    indisponible. Réessaie dans quelques instants.
                </p>

            </div>
        `;
    }
}


// ==========================================
// RECHERCHE API DIRECTE
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

    } catch {
        return [];
    }
}


// ==========================================
// RECHERCHE DE SECOURS
// ==========================================

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


// ==========================================
// CHOIX DU MEILLEUR RESULTAT
// ==========================================

function chooseBestResult(items, query) {

    const normalizedQuery = normalizeText(query);

    const exact = items.find(item =>
        item.name &&
        normalizeText(item.name) === normalizedQuery
    );

    return exact || items[0];
}


// ==========================================
// GPS
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

    const bestDrop = chooseBestDrop(drops);


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
            
${buildSmartRoute(item, drops, components)}

${buildDrops(drops)}

${buildComponents(components)}

            ${buildGPSAdvice(
                item,
                drops,
                components
            )}

        </div>
    `;
}

// ==========================================
// ROUTE GPS INTELLIGENTE V5
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

    // Objet classique / ressource
    if (!isWarframe) {

        const bestDrop = chooseBestDrop(drops);

        return buildRoute(bestDrop);
    }

    // WARFRAME
    return buildWarframeRoute(components);
}


// ==========================================
// ROUTE WARFRAME
// ==========================================

function buildWarframeRoute(components) {

    if (!components.length) {

        return `
            <div class="gps-route">

                <span class="gps-label">
                    ROUTE GPS
                </span>

                <h4>
                    Données de fabrication indisponibles
                </h4>

            </div>
        `;
    }


    const destinations = {};


    components.forEach(component => {

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


            destinations[location].components.push({

                name:
                    component.name ||
                    "Composant",

                chance:
                    getChance(drop),

                rarity:
                    drop.rarity || ""

            });


            destinations[location].totalChance +=
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
                    Les composants ont été identifiés,
                    mais aucune mission commune exploitable
                    n'a encore été trouvée.
                </p>

            </div>
        `;
    }


    // Priorité :
    // 1. nombre de composants disponibles au même endroit
    // 2. probabilités disponibles

    routes.sort((a, b) => {

        const componentDifference =
            b.components.length -
            a.components.length;

        if (componentDifference !== 0) {
            return componentDifference;
        }

        return (
            b.totalChance -
            a.totalChance
        );
    });


    const bestRoute = routes[0];


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

            </div>


            <p class="route-explanation">

                Cette destination permet d'obtenir
                <strong>
                    ${bestRoute.components.length}
                </strong>

                composant(s) recherché(s)
                dans la même mission.

            </p>


            <div class="route-components">

                ${bestRoute.components.map(component => `

                    <div class="route-component">

                        <div>

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
                ? buildAlternativeRoutes(routes.slice(1, 4))
                : ""
            }

        </div>
    `;
}


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
// HEADER
// ==========================================

function buildHeader(name, category, image) {

    return `
        <div class="result-top">

            <div class="result-title">

                ${
                    image
                    ? `
                        <img
                            class="item-image"
                            src="${escapeHTML(image)}"
                            alt="${escapeHTML(name)}"
                        >
                    `
                    : ""
                }

                <div>

                    <span class="result-category">
                        ${escapeHTML(category)}
                    </span>

                    <h3>
                        ${escapeHTML(name)}
                    </h3>

                </div>

            </div>

            <span class="recommended">
                GPS ACTIVE
            </span>

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


// ==========================================
// MEILLEUR DROP
// ==========================================

function chooseBestDrop(drops) {

    if (!drops.length) {
        return null;
    }

    return [...drops].sort((a, b) => {

        return getChance(b) - getChance(a);

    })[0];
}


function getChance(drop) {

    const chance = Number(drop?.chance);

    if (!Number.isFinite(chance)) {
        return 0;
    }

    return chance;
}


function formatChance(chance) {

    const value = Number(chance);

    if (!Number.isFinite(value)) {
        return "Non précisée";
    }

    /*
      Certaines données utilisent 0.1 = 10 %,
      d'autres peuvent déjà être exprimées en %.
    */

    const percentage =
        value <= 1
            ? value * 100
            : value;

    return `${percentage.toFixed(2)} %`;
}


// ==========================================
// ROUTE GPS
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
                    Cet objet existe dans la base,
                    mais aucune destination exploitable
                    n'est fournie directement.
                </p>

            </div>
        `;
    }


    const location =
        drop.location ||
        drop.place ||
        drop.node ||
        drop.mission ||
        "Localisation inconnue";


    return `
        <div class="gps-route">

            <div class="gps-route-title">

                <span class="gps-label">
                    ROUTE GPS RECOMMANDÉE
                </span>

                <span class="best-badge">
                    ★ MEILLEUR DROP DISPONIBLE
                </span>

            </div>

            <h4>
                ${escapeHTML(location)}
            </h4>

            <div class="gps-stats">

                <div>

                    <span>
                        CHANCE
                    </span>

                    <strong>
                        ${formatChance(drop.chance)}
                    </strong>

                </div>

                <div>

                    <span>
                        RARETÉ
                    </span>

                    <strong>
                        ${escapeHTML(
                            drop.rarity || "Non précisée"
                        )}
                    </strong>

                </div>

            </div>

        </div>
    `;
}


// ==========================================
// LISTE DES DROPS
// ==========================================

function buildDrops(drops) {

    if (!drops.length) {
        return "";
    }

    const sortedDrops = [...drops]
        .sort(
            (a, b) =>
                getChance(b) - getChance(a)
        )
        .slice(0, 8);


    return `
        <div class="drops-section">

            <span class="gps-label">
                AUTRES DESTINATIONS
            </span>

            ${sortedDrops.map((drop, index) => {

                const location =
                    drop.location ||
                    drop.place ||
                    drop.node ||
                    drop.mission ||
                    "Localisation inconnue";

                return `
                    <div class="drop-row">

                        <div>

                            <strong>
                                ${index + 1}.
                                ${escapeHTML(location)}
                            </strong>

                            ${
                                drop.rarity
                                ? `
                                    <small>
                                        ${escapeHTML(drop.rarity)}
                                    </small>
                                `
                                : ""
                            }

                        </div>

                        <span>
                            ${formatChance(drop.chance)}
                        </span>

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


function buildComponents(components) {

    if (!components.length) {
        return "";
    }

    return `
        <div class="components-section">

            <span class="gps-label">
                ROUTE DE FABRICATION
            </span>

            <div class="component-route">

                ${components.map((component, index) => {

                    const name =
                        component.name ||
                        "Composant";

                    const quantity =
                        component.itemCount ||
                        component.count ||
                        1;

                    const drops =
                        Array.isArray(component.drops)
                            ? component.drops
                            : [];

                    const bestDrop =
                        chooseBestDrop(drops);

                    const location =
                        bestDrop
                            ? (
                                bestDrop.location ||
                                bestDrop.place ||
                                bestDrop.node ||
                                bestDrop.mission ||
                                "Localisation inconnue"
                              )
                            : null;

                    const image =
                        component.imageName
                            ? `https://cdn.warframestat.us/img/${component.imageName}`
                            : null;

                    return `
                        <div class="component-gps">

                            <div class="component-number">
                                ${String(index + 1).padStart(2, "0")}
                            </div>

                            <div class="component-main">

                                <div class="component-header">

                                    ${
                                        image
                                        ? `
                                            <img
                                                class="component-image"
                                                src="${escapeHTML(image)}"
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

                                </div>


                                ${
                                    bestDrop
                                    ? `
                                        <div class="component-destination">

                                            <span>
                                                DESTINATION RECOMMANDÉE
                                            </span>

                                            <strong>
                                                ${escapeHTML(location)}
                                            </strong>

                                            <small>
                                                Chance :
                                                ${formatChance(bestDrop.chance)}

                                                ${
                                                    bestDrop.rarity
                                                    ? ` • ${escapeHTML(bestDrop.rarity)}`
                                                    : ""
                                                }
                                            </small>

                                        </div>
                                    `
                                    : `
                                        <div class="component-destination unavailable">

                                            <span>
                                                ACQUISITION
                                            </span>

                                            <strong>
                                                Pas de drop direct identifié
                                            </strong>

                                        </div>
                                    `
                                }


                                ${
                                    drops.length > 1
                                    ? `
                                        <details class="component-alternatives">

                                            <summary>
                                                Voir ${drops.length} sources
                                            </summary>

                                            ${[...drops]
                                                .sort(
                                                    (a, b) =>
                                                        getChance(b) -
                                                        getChance(a)
                                                )
                                                .slice(0, 6)
                                                .map(drop => {

                                                    const dropLocation =
                                                        drop.location ||
                                                        drop.place ||
                                                        drop.node ||
                                                        drop.mission ||
                                                        "Localisation inconnue";

                                                    return `
                                                        <div class="alternative-row">

                                                            <span>
                                                                ${escapeHTML(dropLocation)}
                                                            </span>

                                                            <strong>
                                                                ${formatChance(drop.chance)}
                                                            </strong>

                                                        </div>
                                                    `;

                                                }).join("")}

                                        </details>
                                    `
                                    : ""
                                }

                            </div>

                        </div>
                    `;

                }).join("")}

            </div>

        </div>
    `;
}

   


// ==========================================
// CONSEILS GPS
// ==========================================

function buildGPSAdvice(item, drops, components) {

    let text;

    if (drops.length > 1) {

        text =
            `Warframe GPS a trouvé ${drops.length} sources possibles. ` +
            `La route affichée en premier possède la meilleure ` +
            `probabilité numérique disponible dans les données.`;

    } else if (drops.length === 1) {

        text =
            "Une source directe a été trouvée pour cet objet.";

    } else if (components.length) {

        text =
            "Aucun drop direct n'est disponible, mais les composants " +
            "nécessaires ont été identifiés. Clique sur un composant " +
            "pour poursuivre la route GPS.";

    } else {

        text =
            "Les données disponibles ne permettent pas encore de " +
            "calculer automatiquement une route de farm fiable.";
    }


    return `
        <div class="gps-info">

            <strong>
                ANALYSE GPS
            </strong>

            <p>
                ${escapeHTML(text)}
            </p>

        </div>
    `;
}


// ==========================================
// RECHERCHE D'UN COMPOSANT
// ==========================================

function searchComponent(name) {

    searchInput.value = name;

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
        <div class="result-card loading">
            ${escapeHTML(message)}
        </div>
    `;
}


function showMessage(message) {

    searchResults.innerHTML = `
        <div class="result-card">
            ${message}
        </div>
    `;
}


function selectCategory(category) {

    searchInput.focus();

    searchInput.placeholder =
        `Recherche : ${category}`;
}


// ==========================================
// SECURITE
// ==========================================

function escapeHTML(value) {

    const div = document.createElement("div");

    div.textContent = String(value);

    return div.innerHTML;
}


function escapeJS(value) {

    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
}


// ==========================================
// EVENEMENTS
// ==========================================

searchButton.addEventListener(
    "click",
    searchItem
);


searchInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            searchItem();
        }

    }
);
