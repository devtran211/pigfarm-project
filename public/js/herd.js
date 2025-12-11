document.addEventListener("DOMContentLoaded", () => {

    const nameInput = document.getElementById("search-herd-name");
    const priceInput = document.getElementById("search-herd-price");
    const inventoryInput = document.getElementById("search-herd-inventory");

    function handleFilter() {
        filterHerdsTable(nameInput, priceInput, inventoryInput, ".custom-table");
    }

    nameInput.addEventListener("input", handleFilter);
    priceInput.addEventListener("input", handleFilter);
    inventoryInput.addEventListener("input", handleFilter);
    
    setupCreateHerdModal();
    setupEditHerdModal();
    setupHerdPigListModal();
    setupHerdDetailModal();
    setupDeleteHerd();
});

// CHẶN SỰ KIỆN LAN LÊN TR
document.querySelectorAll(".action-more").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const menu = btn.nextElementSibling;
        menu.classList.toggle("show");
    });
});

document.querySelectorAll(".action-menu button").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
    });
});

function setupCreateHerdModal() {
    const modal = document.getElementById("createNewHerd");
    const openBtn = document.getElementById("openCreateModal");
    const closeBtn = modal.querySelector(".close-btn");
    const saveBtn = modal.querySelector(".save-btn");

    // Mở popup
    function openModal() {
        modal.style.display = "flex";
    }

    // Đóng popup
    function closeModal() {
        modal.style.display = "none";
    }

    // Reset form
    function resetForm() {
        modal.querySelectorAll("input, textarea, select").forEach(el => {
            if (el.type === "select-one") el.selectedIndex = 0;
            else el.value = "";
        });
    }

    // Gửi dữ liệu tạo mới Herd
    async function saveHerd() {
        const formData = {
            name: modal.querySelector('input[name="name"]').value,
            origin: modal.querySelector('input[name="origin"]').value,
            type: modal.querySelector('input[name="type"]').value,
            sex: modal.querySelector('select[name="sex"]').value,
            weight_at_import: modal.querySelector('input[name="weight_at_import"]').value,
            health: modal.querySelector('input[name="health"]').value,
            vaccination: modal.querySelector('select[name="vaccination"]').value,
            note: modal.querySelector('textarea[name="note"]').value
        };

        const res = await fetch('/herd/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await res.json();

        if (data.success) {
            alert("Herd added successfully!");
            resetForm();
            closeModal();
            location.reload(); // load lại danh sách
        } else {
            alert("Error creating herd!");
        }
    }

    // Event handlers
    openBtn.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });

    saveBtn.addEventListener("click", saveHerd);

    // Export cho nơi khác nếu bạn dùng module
    return { openModal, closeModal, saveHerd };
}

function setupEditHerdModal() {
    const modal = document.getElementById("editHerd");
    const closeBtn = modal.querySelector(".close-btn");
    const saveBtn = modal.querySelector(".save-btn");
    let currentEditId = null;

    // -----------------------
    // ⭐ Hàm mở popup + load
    // -----------------------
    async function openEditModal(id) {
        currentEditId = id;

        const res = await fetch(`/herd/edit/${id}`);
        const data = await res.json();

        modal.querySelector('input[name="name"]').value = data.name || "";
        modal.querySelector('input[name="origin"]').value = data.origin || "";
        modal.querySelector('input[name="type"]').value = data.type || "";
        modal.querySelector('select[name="sex"]').value = data.sex;
        modal.querySelector('input[name="weightAtImport"]').value = data.weightAtImport || "";
        modal.querySelector('input[name="health"]').value = data.health || "";
        modal.querySelector('select[name="vaccination"]').value = data.vaccination ? "true" : "false";
        modal.querySelector('input[name="inventory"]').value = data.inventory || "";
        modal.querySelector('textarea[name="note"]').value = data.note || "";

        modal.style.display = "flex";
    }

    // -----------------------
    // Tự tìm tất cả nút 3 chấm
    // -----------------------
    document.querySelectorAll(".btn-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            const herdId = btn.getAttribute("data-id"); // <-- LẤY ID TẠI ĐÂY
            openEditModal(herdId);
        });
    });

    // -----------------------
    // Đóng popup
    // -----------------------
    function closeModal() {
        modal.style.display = "none";
    }

    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });

    // -----------------------
    // ⭐ Lưu dữ liệu sửa
    // -----------------------
    async function saveEditedHerd() {
        const body = {
            name: modal.querySelector('input[name="name"]').value,
            origin: modal.querySelector('input[name="origin"]').value,
            type: modal.querySelector('input[name="type"]').value,
            sex: modal.querySelector('select[name="sex"]').value,
            weightAtImport: modal.querySelector('input[name="weightAtImport"]').value,
            health: modal.querySelector('input[name="health"]').value,
            vaccination: modal.querySelector('select[name="vaccination"]').value === "true",
            inventory: modal.querySelector('input[name="inventory"]').value,
            note: modal.querySelector('textarea[name="note"]').value
        };

        await fetch(`/herd/edit/${currentEditId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        alert("Update succeed!");
        closeModal();
        location.reload();
    }

    saveBtn.addEventListener("click", saveEditedHerd);

    // Không cần return gì nữa vì mọi thứ đã tự xử lý
}

function setupHerdPigListModal() {
    const modal = document.getElementById("herdPigListModal");
    const closeBtn = modal.querySelector(".close-btn");
    const tableBody = document.getElementById("pigTableBody");

    // Tự động gắn sự kiện click vào tất cả dòng herd-row
    document.querySelectorAll(".herd-row").forEach(row => {
        row.addEventListener("click", () => {
            const herdId = row.getAttribute("data-id");  // <-- Lấy herdId ngay tại đây
            openModal(herdId);
        });
    });

    // Hàm mở modal và load dữ liệu Pig theo herdId
    async function openModal(herdId) {
        const res = await fetch(`/herd/pigs/${herdId}`);
        const data = await res.json();

        tableBody.innerHTML = ""; // sạch bảng cũ

        if (data.success) {
            data.pigs.forEach(pig => {
                const tr = document.createElement("tr");

                tr.innerHTML = `
                    <td>${pig.tag || ""}</td>
                    
                    <td>${pig.birthDate ? new Date(pig.birthDate).toLocaleDateString() : "-"}</td>

                    <td>
                        <span class="tag sex-${pig.sex}">
                            ${pig.sex === "boar" ? "Boar" : "Sow"}
                        </span>
                    </td>

                    <td>
                        <span class="tag ${pig.vaccination ? "vacc-yes" : "vacc-no"}">
                            ${pig.vaccination ? "Yes" : "No"}
                        </span>
                    </td>

                    <td>
                        <span class="tag status">${pig.status || "Unknown"}</span>
                    </td>

                    <td>${pig.barn ? pig.barn.name ?? "" : "-"}</td>
                `;

                tableBody.appendChild(tr);
            });
        }

        modal.style.display = "flex";
    }

    // Đóng modal
    function closeModal() {
        modal.style.display = "none";
    }

    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });
}

function setupHerdDetailModal() {
    const modal = document.getElementById("herdDetailModal");
    const closeBtn = modal.querySelector(".close-btn");
    const body = document.getElementById("herdDetailBody");

    // GẮN SỰ KIỆN CHO NÚT DETAIL
    document.querySelectorAll(".btn-detail").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();   // tránh mở PigList
            const herdId = btn.getAttribute("data-id");
            openDetailModal(herdId);
        });
    });

    // Mở popup + load dữ liệu
    async function openDetailModal(id) {
        const res = await fetch(`/herd/detail/${id}`);
        const data = await res.json();

        if (!data.success) return alert("Cannot load detail!");

        const h = data.herd;

        body.innerHTML = `
            <tr><td class="title">Name</td><td>${h.name}</td></tr>
            <tr><td class="title">Origin</td><td>${h.origin}</td></tr>
            <tr><td class="title">Type</td><td>${h.type}</td></tr>
            <tr><td class="title">Sex</td><td>${h.sex}</td></tr>
            <tr><td class="title">Weight At Import</td><td>${h.weightAtImport ?? "-"}</td></tr>
            <tr><td class="title">Health</td><td>${h.health}</td></tr>
            <tr><td class="title">Vaccination</td><td>${h.vaccination ? "Yes" : "No"}</td></tr>
            <tr><td class="title">Inventory</td><td>${h.inventory}</td></tr>
            <tr><td class="title">Original Inventory</td><td>${h.originalInventory}</td></tr>
            <tr><td class="title">Import Price</td><td>${h.importPrice}</td></tr>
            <tr><td class="title">Date of Entry</td><td>${h.dateOfEntry ? new Date(h.dateOfEntry).toLocaleDateString() : "-"}</td></tr>
            <tr><td class="title">Note</td><td>${h.note ?? "-"}</td></tr>
        `;

        modal.style.display = "flex";
    }

    // Đóng popup
    function closeModal() {
        modal.style.display = "none";
    }

    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", e => {
        if (e.target === modal) closeModal();
    });
}

function setupDeleteHerd() {
    document.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation(); // tránh mở PigList

            const herdId = btn.getAttribute("data-id");

            if (!confirm("Are you sure you want to delete this herd and all its pigs?")) {
                return;
            }

            const res = await fetch(`/herd/delete/${herdId}`, {
                method: "DELETE"
            });

            const data = await res.json();

            if (data.success) {
                alert("Delete succeed!");
                location.reload();
            } else {
                alert("Delete failed: " + data.message);
            }
        });
    });
}

function filterHerdsTable(nameInput, priceInput, inventoryInput, tableSelector) {
    const rows = document.querySelectorAll(`${tableSelector} tbody tr`);

    const nameValue = nameInput.value.toLowerCase().trim();
    const priceValue = priceInput.value.trim();
    const inventoryValue = inventoryInput.value.trim();

    rows.forEach(row => {
        const herdName = row.querySelector("td strong")?.textContent.toLowerCase() || "";
        const herdPrice = row.querySelectorAll("td")[2]?.textContent.replace(/[^0-9]/g, "") || "";
        const herdInventory = row.querySelectorAll("td")[3]?.textContent.trim() || "";

        let isMatch = true;

        // Name filter
        if (nameValue && !herdName.includes(nameValue)) isMatch = false;

        // Price filter (number only)
        if (priceValue && !herdPrice.includes(priceValue)) isMatch = false;

        // Inventory filter
        if (inventoryValue && !herdInventory.includes(inventoryValue)) isMatch = false;

        row.style.display = isMatch ? "" : "none";
    });
}
