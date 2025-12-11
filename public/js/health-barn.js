document.addEventListener("DOMContentLoaded", () => {
    console.log("LOADED: health.js");

    document.querySelectorAll(".action-more").forEach(btn => {
        btn.addEventListener("click", function (e) {
            e.stopPropagation();

            const menu = this.nextElementSibling;

            // Đóng tất cả menu khác
            document.querySelectorAll(".action-menu").forEach(m => {
                if (m !== menu) m.style.display = "none";
            });

            // Toggle menu hiện tại
            menu.style.display = menu.style.display === "block" ? "none" : "block";
        });
    });

    // Click ra ngoài để đóng menu
    document.addEventListener("click", () => {
        document.querySelectorAll(".action-menu").forEach(menu => {
            menu.style.display = "none";
        });
    });


    initAreaFilter();
    initHealthCreatePopup();
    initHealthEditPopup();
    initHealthDelete();

    initNavigateBarnToPigList();
});

function initAreaFilter() {
    const select = document.getElementById("filterAreaSelect");
    if (!select) return;

    // Khi chọn area → redirect để server render đúng
    select.addEventListener("change", () => {
        const areaId = select.value;
        if (!areaId) return;

        window.location.href = `/barn-health?area=${areaId}`;
    });

    // Auto-select khu đầu tiên nếu chưa có gì
    if (!select.value) {
        const first = [...select.options].find(o => o.value);
        if (first) {
            select.value = first.value;
            window.location.href = `/barn-health?area=${first.value}`;
        }
    }
}

function initHealthCreatePopup() {

    const modal = document.getElementById("healthModal");
    const form = document.getElementById("healthForm");
    const btnCreates = document.querySelectorAll(".btn-add-health");

    const API_CREATE = "/barn-health/create";

    let currentBarnId = null;

    //Open popup
    btnCreates.forEach(btn => {
        btn.addEventListener("click", () => {

            currentBarnId = btn.dataset.barnId;

            if (!currentBarnId) {
                console.error("Missing barnId from Create button");
                return;
            }

            resetCreateForm();
            openModal();
        });
    });

    function openModal() {
        modal.style.display = "flex";
    }

    function closeModal() {
        modal.style.display = "none";
    }

    modal.querySelector(".close-btn").addEventListener("click", closeModal);

    modal.addEventListener("click", e => {
        if (e.target.classList.contains("modal-overlay")) closeModal();
    });

    // reset form
    function resetCreateForm() {
        form.reset();
    }

    //submit
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        // Thêm barn vào payload
        payload.barn = currentBarnId;

        const res = await fetch(API_CREATE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!data.success) {
            alert("Create failed!");
            return;
        }

        alert("Created successfully!");
        closeModal();
        location.reload();
    });
}

function initHealthEditPopup() {

    const modal = document.getElementById("editHealthModal");
    const form = document.getElementById("editHealthForm");
    const btnEdits = document.querySelectorAll(".btn-edit");

    const API_GET = "/barn-health/";
    const API_UPDATE = "/barn-health/update/";

    let editingId = null;

    /*  OPEN POPUP */
    btnEdits.forEach(btn => {
        btn.addEventListener("click", async () => {
            editingId = btn.dataset.id;

            const res = await fetch(API_GET + editingId);
            const data = await res.json();

            fillEditForm(data);
            openModal();
        });
    });

    function openModal() {
        modal.style.display = "flex";
    }

    function closeModal() {
        modal.style.display = "none";
    }

    modal.querySelector(".close-btn").addEventListener("click", closeModal);

    modal.addEventListener("click", e => {
        if (e.target.classList.contains("modal-overlay")) closeModal();
    });

    /* FILL FORM */
    function fillEditForm(data) {
        form.averageWeight.value = data.averageWeight;
        form.loss.value = data.loss;
        form.faecesStatus.value = data.faecesStatus;
        form.dateOfInspection.value = data.dateOfInspection?.split("T")[0];
        form.note.value = data.note || "";
    }

    /*  submit  */
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        const res = await fetch(API_UPDATE + editingId, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!data.success) {
            alert("Update failed!");
            return;
        }

        alert("Record updated!");
        closeModal();
        location.reload();
    });
}

function initHealthDelete() {

    const btnDeletes = document.querySelectorAll(".btn-delete");

    const API_DELETE = "/barn-health/delete/";

    btnDeletes.forEach(btn => {

        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;

            const confirmDelete = confirm("Are you sure you want to delete this record?");
            if (!confirmDelete) return;

            const res = await fetch(API_DELETE + id, {
                method: "POST"
            });

            const data = await res.json();

            if (!data.success) {
                alert("Delete failed!");
                return;
            }

            alert("Record deleted!");
            location.reload();
        });
    });
}

function initNavigateBarnToPigList() {

    const barnNames = document.querySelectorAll(".barn-name");

    barnNames.forEach(barn => {
        barn.addEventListener("click", () => {
            const barnId = barn.dataset.barnId;

            if (!barnId) {
                console.error("Missing barnId on barn name");
                return;
            }

            // Điều hướng sang trang danh sách lợn
            window.location.href = `/barn-health/${barnId}/pigs`;
        });
    });
}

