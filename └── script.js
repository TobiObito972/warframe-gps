const API_URL = "https://api.warframestat.us/items/search/";

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchResults = document.getElementById("searchResults");


// ==============================
// RECHERCHE
// ==============================

async function searchItem() {

    const query = searchInput.value.trim();

    if (!query) {
        showMessage("Entre le nom d'un objet à rechercher.");
        return;
    }

    showLoading();

    try {

        const response = await fetch(
            API_URL + encodeURIComponent(query)
        );

        if (!response.ok) {
            throw new Error("Erreur API");
        }

        const data = await response.json();

        let items = [];

        if (Array.isArray(data)) {
            items = data;
        } else if (data && Array.isArray(data.items)) {
            items = data.items;
        } else if (data) {
            items = [data];
        }

        if (items.length === 0) {
            showMessage(
                `Aucun résultat trouvé pour "${escapeHTML(query)}".`
            );
            return;
        }

        // On cherche d'abord une correspondance exacte
        const exactItem = items.find(item =>
            item.name &&
            item.name.toLowerCase() === query.toLowerCase()
        );

        const item = exactItem || items[0];

        displayItem(item);

    } catch (error) {

        console.error(error);

        searchResults.innerHTML = `
            <div class="result-card">

                <strong>
                    Impossible de contacter la base Warframe.
                </strong>

                <p>
                    Réessaie dans quelques instants.
                </p>

            </div>
        `;
    }
}


// ==============================
// AFFICHAGE
// ==============================

function displayItem(item) {

    const name =
        item.name ||
        "Objet inconnu";

    const category =
        item.category ||
        item.type ||
        "Objet Warframe";

    const description =
        item.description ||
        "Aucune description disponible.";

    const image = item.imageName
        ? `https://cdn.warframestat.us/img/${item.imageName}`
        : null;


    let dropsHTML = "";

    if (
        Array.isArray(item.drops) &&
        item.drops.length > 0
    ) {

        const drops = item.drops.slice(0, 5);

        dropsHTML = `
            <div class="drops-section">

                <span class="gps-label">
                    LOCALISATIONS / DROPS
                </span>

                ${drops.map(drop => {

                    const location =
                        drop.location ||
                        "Localisation inconnue";

                    const chance =
                        typeof drop.chance === "number"
                            ? `${(drop.chance * 100).toFixed(2)} %`
                            : "Chance inconnue";

                    const rarity =
                        drop.rarity ||
                        "";

                    return `
                        <div class="drop-row">

                            <div>
                                <strong>
                                    ${escapeHTML(location)}
                                </strong>

                                ${
                                    rarity
                                    ? `<small>${escapeHTML(rarity)}</small>`
                                    : ""
                                }
                            </div>

                            <span>
                                ${escapeHTML(chance)}
                            </span>

                        </div>
                    `;

                }).join("")}

            </div>
        `;

    } else {

        dropsHTML = `
            <div class="drops-section">

                <span class="gps-label">
                    LOCALISATION
                </span>

                <p class="no-drop">
                    Aucune donnée de drop directe disponible
                    pour cet objet.
                </p>

            </div>
        `;
    }


    searchResults.innerHTML = `
        <div class="result-card">

            <div class="result-top">

                <div class="result-title">

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

                        <span class="result-category">
                            ${escapeHTML(category)}
                        </span>

                        <h3>
                            ${escapeHTML(name)}
                        </h3>

                    </div>

                </div>


                <span class="recommended">
                    WARFRAME GPS
                </span>

            </div>


            <p class="item-description">
                ${escapeHTML(description)}
            </p>


            ${dropsHTML}


            <div class="gps-info">

                <strong>
                    GPS
                </strong>

                <p>
                    Nous allons prochainement utiliser
                    ces données pour calculer automatiquement
                    la meilleure route de farm.
                </p>

            </div>

        </div>
    `;
}


// ==============================
// INTERFACE
// ==============================

function showLoading() {

    searchResults.innerHTML = `
        <div class="result-card loading">
            Recherche dans la base Warframe...
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


// ==============================
// SECURITE HTML
// ==============================

function escapeHTML(value) {

    const div = document.createElement("div");

    div.textContent = String(value);

    return div.innerHTML;
}


// ==============================
// EVENEMENTS
// ==============================

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
