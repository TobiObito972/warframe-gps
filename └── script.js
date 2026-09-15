const database = [
    {
        name: "Tellurium",
        category: "Ressource",
        planet: "Uranus",
        mission: "Ophelia",
        type: "Survie",
        method: "Élimine les ennemis et reste suffisamment longtemps dans la mission pour augmenter tes chances.",
        tip: "Une Warframe orientée farm peut améliorer le rendement."
    },

    {
        name: "Neurodes",
        category: "Ressource",
        planet: "Terre",
        mission: "Mariana",
        type: "Extermination",
        method: "Explore la mission et détruis les conteneurs tout en éliminant les ennemis.",
        tip: "Utilise un mod de radar de butin pour repérer plus facilement les ressources."
    },

    {
        name: "Gauss",
        category: "Warframe",
        planet: "Sedna",
        mission: "Kappa",
        type: "Perturbation",
        method: "Complète les conduits de Perturbation pour obtenir ses composants.",
        tip: "Une escouade efficace permet d'enchaîner les rotations plus rapidement."
    }
];

const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchResults = document.getElementById("searchResults");


function searchItem() {

    const query = searchInput.value
        .trim()
        .toLowerCase();

    if (!query) {

        searchResults.innerHTML = `
            <div class="result-card">
                Entre le nom d'une ressource,
                d'un Warframe, d'une arme ou d'un mod.
            </div>
        `;

        return;
    }


    const result = database.find(item =>
        item.name.toLowerCase().includes(query)
    );


    if (!result) {

        searchResults.innerHTML = `
            <div class="result-card">

                <strong>Aucun résultat trouvé</strong>

                <p>
                    "${escapeHTML(searchInput.value)}"
                    n'est pas encore présent dans notre base.
                </p>

            </div>
        `;

        return;
    }


    searchResults.innerHTML = `
        <div class="result-card">

            <div class="result-top">

                <div>
                    <span class="result-category">
                        ${result.category}
                    </span>

                    <h3>
                        ${result.name}
                    </h3>
                </div>

                <span class="recommended">
                    RECOMMANDÉ
                </span>

            </div>


            <div class="location">

                <div>
                    <span>PLANÈTE</span>
                    <strong>${result.planet}</strong>
                </div>

                <div>
                    <span>MISSION</span>
                    <strong>${result.mission}</strong>
                </div>

                <div>
                    <span>TYPE</span>
                    <strong>${result.type}</strong>
                </div>

            </div>


            <div class="farm-method">

                <span>MÉTHODE DE FARM</span>

                <p>
                    ${result.method}
                </p>

            </div>


            <div class="farm-tip">

                <strong>Conseil :</strong>
                ${result.tip}

            </div>

        </div>
    `;
}


function selectCategory(category) {

    document
        .getElementById("searchInput")
        .focus();

    searchInput.placeholder =
        "Recherche dans : " + category;
}


function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}


searchButton.addEventListener(
    "click",
    searchItem
);


searchInput.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Enter") {
            searchItem();
        }

    }
);
