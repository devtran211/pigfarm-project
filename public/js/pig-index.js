document.addEventListener("DOMContentLoaded", () => {
    initHealthHistoryCreatePopup();
    initPigTagSearch();
});

function initHealthHistoryCreatePopup() {

    const modal = document.getElementById("healthHistoryModal");
    const form = document.getElementById("healthHistoryForm");
    const btns = document.querySelectorAll(".btn-add-health-history");

    let currentPigId = null;

    btns.forEach(btn => {
        btn.addEventListener("click", async () => {

            currentPigId = btn.dataset.pigId;

            form.reset();
            modal.style.display = "flex";

            // -----------------------------------------
            // 1) LOAD VACCINATION STATUS OF THIS PIG
            // -----------------------------------------

            const res = await fetch(`/pig/${currentPigId}`);
            const data = await res.json();

            if (data.success) {
                const vaccination = data.pig.vaccination;

                form.vaccinationHistory.value = vaccination ? "Yes" : "No";
            }
        });
    });

    modal.querySelector(".close-btn").addEventListener("click", () => {
        modal.style.display = "none";
    });

    modal.addEventListener("click", (e) => {
        if (e.target.id === "healthHistoryModal") {
            modal.style.display = "none";
        }
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData);

        payload.pig = currentPigId;

        const res = await fetch("/health-history/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!data.success) {
            alert("Create failed!");
            return;
        }

        alert("Health history created!");
        modal.style.display = "none";
        location.reload();
    });
}

function initPigTagSearch() {
    const searchInput = document.getElementById("searchPigTag");
    const rows = document.querySelectorAll(".farmgo-table tbody tr");

    searchInput.addEventListener("input", () => {
        const keyword = searchInput.value.trim().toLowerCase();

        rows.forEach(row => {
            const tagCell = row.querySelector("td:first-child");
            if (!tagCell) return;

            const tag = tagCell.textContent.toLowerCase();

            if (tag.includes(keyword)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    });
}