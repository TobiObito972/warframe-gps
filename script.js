function calculateRoute() {

    const input = document.getElementById("searchInput");

    const result = document.getElementById("result");

    const goal = document.getElementById("goal");

    const value = input.value.trim();


    if (value === "") {

        alert("Entre un objectif.");

        return;
    }


    goal.textContent = value;

    result.classList.remove("hidden");


    result.scrollIntoView({
        behavior: "smooth"
    });

}
