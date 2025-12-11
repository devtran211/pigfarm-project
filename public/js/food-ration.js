// DOCUMENT READY
document.addEventListener("DOMContentLoaded", () => {
    initRationPopup();
    initRationPopupDynamicRows();
    initEditAddRowButtons();

    document.querySelectorAll(".action-more").forEach(btn => {
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            const menu = this.nextElementSibling;

            // Đóng tất cả menu khác
            document.querySelectorAll(".action-menu").forEach(m => {
                if (m !== menu) m.style.display = "none";
            });

            // Toggle menu
            menu.style.display = menu.style.display === "block" ? "none" : "block";
        });
    });

    document.addEventListener("click", () => {
        document.querySelectorAll(".action-menu").forEach(menu => {
            menu.style.display = "none";
        });
    });


    // Save button in create modal
    const createSaveBtn = document.querySelector("#createRationModal .save-button");
    if (createSaveBtn) createSaveBtn.addEventListener("click", handleCreateRation);

    // Edit button(s) on page (delegated)
    document.addEventListener("click", async (e) => {
            const btn = e.target.closest(".btn-edit");
            if (!btn) return;
            const id = btn.dataset.id;
            if (id) await openEditRationPopup(id);
        });

        document.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-detail");
        if (!btn) return;

        const id = btn.dataset.id;
        openDetailRationPopup(id);
    });

    initDeleteRationHandler();
});

// 1. POPUP OPEN / CLOSE (Create)
function initRationPopup() {
    console.log("Init Ration Popup");

    const modal = document.getElementById("createRationModal");
    if (!modal) {
        console.error("Popup #createRationModal không tồn tại!");
        return;
    }

    const closeBtn = modal.querySelector(".close-button");
    const areaBtns = document.querySelectorAll(".btn-add-meal-area");
    const barnBtns = document.querySelectorAll(".btn-add-meal-barn");

    console.log("Area buttons:", areaBtns.length);
    console.log("Barn buttons:", barnBtns.length);

    // OPEN POPUP - AREA
    areaBtns.forEach(btn => {
        btn.addEventListener("click", async () => {

            const modal = document.getElementById("createRationModal");

            // Tìm khu đang click
            const areaBlock = btn.closest(".area-block");

            // Lấy tất cả các chuồng trong khu
            const barnCards = areaBlock.querySelectorAll(".barn-card");
            const barnIds = [...barnCards].map(b => b.dataset.barnId);

            console.log("Open popup AREA → barnIds =", barnIds);

            modal.dataset.mode = "area";
            modal.dataset.barnIds = JSON.stringify(barnIds);
            console.log("SET barnIds:", modal.dataset.barnIds);

            await loadFoods();
            await loadMeds();
            initMedicineUnitBehaviorForDefaultRow();

            modal.classList.add("active");
        });
    });

    // OPEN POPUP - BARN
    barnBtns.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const barnCard = e.target.closest(".barn-card");
            const barnId = barnCard?.dataset.barnId;

            console.log("Open popup - BARN", barnId);

            modal.classList.add("active");
            modal.dataset.mode = "barn";
            modal.dataset.barnId = barnId;

            await loadFoods();
            await loadMeds();
            initMedicineUnitBehaviorForDefaultRow();
        });
    });

    // CLOSE POPUP
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            modal.classList.remove("active");
        });
    }

    // Click outside to close
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.classList.remove("active");
        }
    });
}

// 2. CREATE FOOD + MED ROW
function createFoodRow() {
    return `
        <div class="item-row food-row">
            <input type="text" name="meal[]" class="meal-select">

            <select name="food_warehouse[]">
                ${window.foodOptionsHTML || ""}
            </select>

            <input type="text" name="weight[]" placeholder="Weight">

            <select name="weight_unit[]" class="unit-select">
                <option>kg</option>
                <option>g</option>
            </select>

            <button type="button" class="remove-button">&minus;</button>
        </div>
    `;
}

function createSupplementRow() {
    return `
        <div class="item-row supplement-row">
            <input type="text" name="meal[]" class="meal-select">

            <select name="medition_warehouse[]" class="med-select">
                ${window.medOptionsHTML || ""}
            </select>

            <input type="text" name="dosage[]" placeholder="Dosage">

            <select name="dosage_unit[]" class="unit-select">
                <option>g</option>
                <option>l</option>
                <option>ml</option>
            </select>

            <button type="button" class="remove-button">&minus;</button>
        </div>
    `;
}

// 3. DYNAMIC ROW MANAGEMENT
function addItemRow(containerId, createRowFn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.insertAdjacentHTML("beforeend", createRowFn());
}

function setupRemoveListeners(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.addEventListener("click", (event) => {
        if (event.target.classList.contains("remove-button")) {
            const row = event.target.closest(".item-row");
            if (row) row.remove();
        }
    });
}

function initRationPopupDynamicRows() {
    // Add Food
    const addFoodBtn = document.getElementById("add-food-button");
    if (addFoodBtn)
        addFoodBtn.addEventListener("click", () => {
            addItemRow("food-items-container", createFoodRow);
        });

    // Add Supplement
    const addSupplementBtn = document.getElementById("add-supplement-button");
    if (addSupplementBtn)
        addSupplementBtn.addEventListener("click", () => {
            const container = document.getElementById("supplement-items-container");
            if (!container) return;
            container.insertAdjacentHTML("beforeend", createSupplementRow());

            const newRow = container.lastElementChild;
            applyMedicineUnitBehavior(newRow);
        });

    // Remove events
    setupRemoveListeners("food-items-container");
    setupRemoveListeners("supplement-items-container");
}

// LOAD FOOD + MED JSON
async function loadFoods() {
    console.log("Loading foods...");

    try {
        const res = await fetch("/food-ration/foods");
        if (!res.ok) {
            console.error("loadFoods API error", res.status);
            return;
        }
        const foods = await res.json();

        const html = foods.map(f => `
            <option value="${f._id}" data-unit="${f.unit}">
                ${f.name} (${f.unit})
            </option>
        `).join("");

        window.foodOptionsHTML = html;

        // Fill DEFAULT row (create modal)
        const baseSelect = document.querySelector("#food-items-container select[name='food_warehouse[]']");
        if (baseSelect) baseSelect.innerHTML = html;

        // Also, if edit modal exists and has a default empty select, fill it
        const editBase = document.querySelector("#editRationModal #food-items-container select[name='food_warehouse[]']");
        if (editBase) editBase.innerHTML = html;
    } catch (err) {
        console.error("loadFoods fetch error", err);
    }
}

async function loadMeds() {
    console.log("Loading meds...");

    try {
        const res = await fetch("/food-ration/meds");
        if (!res.ok) {
            console.error("loadMeds API error", res.status);
            return;
        }
        const meds = await res.json();

        const html = meds.map(m => `
            <option value="${m._id}" data-capacity="${m.capacity}">
                ${m.name} (${m.capacity})
            </option>
        `).join("");

        window.medOptionsHTML = html;

        // Fill DEFAULT row (create modal)
        const baseSelect = document.querySelector("#supplement-items-container select[name='medition_warehouse[]']");
        if (baseSelect) baseSelect.innerHTML = html;

        // Also fill edit modal default select if present
        const editBase = document.querySelector("#editRationModal #supplement-items-container select[name='medition_warehouse[]']");
        if (editBase) editBase.innerHTML = html;
    } catch (err) {
        console.error("loadMeds fetch error", err);
    }
}

// AUTO CHANGE UNIT WHEN MED SELECTED
function applyMedicineUnitBehavior(row) {
    const medSelect = row.querySelector(".med-select");
    const unitSelect = row.querySelector(".unit-select");

    if (!medSelect || !unitSelect) return;

    // remove previous listener by cloning (to avoid double handlers if row reused)
    const newMedSelect = medSelect.cloneNode(true);
    medSelect.parentNode.replaceChild(newMedSelect, medSelect);

    newMedSelect.addEventListener("change", () => {
        const option = newMedSelect.selectedOptions[0];
        if (!option) return;

        const capacity = option.dataset.capacity || "";  // ví dụ: "25kg", "1l"

        // Lấy phần đơn vị từ capacity
        const medUnit = capacity.replace(/[0-9]/g, "").trim().toLowerCase();   // → "kg", "l", "ml"

        unitSelect.innerHTML = ""; // clear

        if (medUnit === "kg" || medUnit === "g") {
            unitSelect.innerHTML = `<option value="g">g</option>`;
        } else if (medUnit === "l" || medUnit === "ml") {
            unitSelect.innerHTML = `
                <option value="l">l</option>
                <option value="ml">ml</option>
            `;
        } else {
            // fallback: show all
            unitSelect.innerHTML = `
                <option value="g">g</option>
                <option value="l">l</option>
                <option value="ml">ml</option>
            `;
        }
    });

    // trigger once to set initial state if an option is selected
    if (newMedSelect.selectedOptions[0]) {
        const ev = new Event('change');
        newMedSelect.dispatchEvent(ev);
    }
}

function initMedicineUnitBehaviorForDefaultRow() {
    const defaultRow = document.querySelector("#supplement-items-container .supplement-row");
    if (defaultRow) applyMedicineUnitBehavior(defaultRow);
}

// ================= CREATE RATION =================
async function handleCreateRation() {
    console.log("Saving ration...");

    const modal = document.getElementById("createRationModal");
    if (!modal) {
        console.error("Create modal not found");
        return;
    }

    // 1. Thông tin cơ bản
    const name = modal.querySelector("#ration-name").value.trim();
    const start_time = modal.querySelector("#start-date").value;
    const end_time = modal.querySelector("#end-date").value;
    const feeds = modal.querySelector("#meals-per-day").value;

    // xác định theo chuồng hay theo khu
    const mode = modal.dataset.mode; // "barn" | "area"
    const barnId = modal.dataset.barnId || null;

    // 2. Gom FOOD DETAILS
    const foodRows = modal.querySelectorAll("#food-items-container .food-row");
    const foodDetails = [];

    foodRows.forEach(row => {
        const meal = row.querySelector("input[name='meal[]']").value.trim();
        const warehouse = row.querySelector("select[name='food_warehouse[]']").value;
        const weight = row.querySelector("input[name='weight[]']").value;
        const weight_unit = row.querySelector("select[name='weight_unit[]']").value;

        if (meal && warehouse) {
            foodDetails.push({
                meal,
                weight: Number(weight),
                weight_unit,
                warehouse
            });
        }
    });

    // 3. Gom MED DETAILS
    const medRows = modal.querySelectorAll("#supplement-items-container .supplement-row");
    const medDetails = [];

    medRows.forEach(row => {
        const meal = row.querySelector("input[name='meal[]']").value.trim();
        const warehouse = row.querySelector("select[name='medition_warehouse[]']").value;
        const dosage = row.querySelector("input[name='dosage[]']").value;
        const dosage_unit = row.querySelector("select[name='dosage_unit[]']").value;

        if (meal && warehouse) {
            // dosage_unit bắt buộc dạng: g/kg, ml/kg, l/kg...
            const finalUnit = `${dosage_unit}/kg`;

            medDetails.push({
                meal,
                dosage: Number(dosage),
                dosage_unit: finalUnit,
                warehouse
            });
        }
    });

    // 4. Build payload
    const payload = {
        name,
        start_time,
        end_time,
        number_of_feedings_per_day: Number(feeds),
        foodDetails,
        medDetails
    };

    if (mode === "barn") {
        payload.barn = [barnId];
    } else if (mode === "area") {
        try {
            payload.barn = JSON.parse(modal.dataset.barnIds);
        } catch (e) {
            payload.barn = [];
        }
    }

    console.log("Payload gửi lên server:", payload);

    // 5. Gửi API
    try {
        const res = await fetch("/food-ration/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            alert("Lỗi: " + (data.error || JSON.stringify(data)));
            return;
        }

        alert("Tạo khẩu phần thành công!");
        location.reload();

    } catch (err) {
        console.error(err);
        alert("Lỗi hệ thống!");
    }
}

// ================= EDIT RATION =================
async function openEditRationPopup(id) {
    console.log("➡ Opening edit popup for ration:", id);

    const modal = document.getElementById("editRationModal");
    if (!modal) {
        console.error("❌ editRationModal not found in DOM!");
        return;
    }

    modal.classList.add("active");
    modal.dataset.rationId = id;

    // Reset removeMeals array for this editing session
    modal._removedMeals = [];

    // LOAD FOOD + MED OPTIONS before rendering rows
    await loadFoods();
    await loadMeds();

    // Fetch ration data
    const res = await fetch(`/food-ration/${id}`);
    if (!res.ok) {
        alert("Không tải được dữ liệu khẩu phần!");
        return;
    }
    const data = await res.json();

    // Fill basic fields
    modal.querySelector("#ration-name").value = data.name ?? "";
    modal.querySelector("#start-date").value = data.start_time?.substring(0, 10) ?? "";
    modal.querySelector("#end-date").value = data.end_time?.substring(0, 10) ?? "";
    modal.querySelector("#meals-per-day").value = data.number_of_feedings_per_day ?? "";

    // Clear containers
    const foodContainer = modal.querySelector("#food-items-container");
    const medContainer = modal.querySelector("#supplement-items-container");

    foodContainer.innerHTML = "";
    medContainer.innerHTML = "";

    // Render food rows
    renderFoodRowsForEdit(data.foodDetails || []);
    // Render supplement rows
    renderMedRowsForEdit(data.medDetails || []);

    // Attach save handler
    const saveBtn = modal.querySelector(".save-button");
    if (saveBtn) {
        saveBtn.onclick = () => handleUpdateRation(id, modal);
    }
}

function renderFoodRowsForEdit(foodDetails) {
    const container = document.querySelector("#editRationModal #food-items-container");
    if (!container) return;

    (foodDetails || []).forEach(item => {
        const html = `
            <div class="item-row food-row" data-old-id="${item._id}">
                <input type="text" name="meal[]" class="meal-select" value="${escapeHtml(item.meal)}">
                
                <select name="food_warehouse[]">
                    ${window.foodOptionsHTML || ""}
                </select>

                <input type="text" name="weight[]" value="${item.weight ?? ''}">

                <select name="weight_unit[]" class="unit-select">
                    <option value="kg" ${item.weight_unit === "kg" ? "selected" : ""}>kg</option>
                    <option value="g" ${item.weight_unit === "g" ? "selected" : ""}>g</option>
                </select>

                <button type="button" class="remove-button">&minus;</button>
            </div>
        `;

        container.insertAdjacentHTML("beforeend", html);

        // Set selected food warehouse
        const last = container.lastElementChild;
        try {
            if (item.warehouse) last.querySelector("select[name='food_warehouse[]']").value = item.warehouse;
        } catch (e) {
            // ignore if value not in options
        }
    });
}

function renderMedRowsForEdit(medDetails) {
    const container = document.querySelector("#editRationModal #supplement-items-container");
    if (!container) return;

    (medDetails || []).forEach(item => {
        const html = `
            <div class="item-row supplement-row" data-old-id="${item._id}">
                <input type="text" name="meal[]" class="meal-select" value="${escapeHtml(item.meal)}">
                
                <select name="medition_warehouse[]" class="med-select">
                    ${window.medOptionsHTML || ""}
                </select>

                <input type="text" name="dosage[]" value="${item.dosage ?? ''}">

                <select name="dosage_unit[]" class="unit-select">
                    <option value="g" ${item.dosage_unit && item.dosage_unit.includes("g") ? "selected" : ""}>g</option>
                    <option value="l" ${item.dosage_unit && item.dosage_unit.includes("l") ? "selected" : ""}>l</option>
                    <option value="ml" ${item.dosage_unit && item.dosage_unit.includes("ml") ? "selected" : ""}>ml</option>
                </select>

                <button type="button" class="remove-button">&minus;</button>
            </div>
        `;

        container.insertAdjacentHTML("beforeend", html);

        const last = container.lastElementChild;
        try {
            if (item.warehouse) last.querySelector(".med-select").value = item.warehouse;
        } catch (e) {
            // ignore if not present
        }

        applyMedicineUnitBehavior(last);
    });
}

function initEditAddRowButtons() {
    const modal = document.getElementById("editRationModal");
    if (!modal) return;

    const foodBtn = modal.querySelector("#edit-add-food-button");
    const medBtn  = modal.querySelector("#edit-add-supplement-button");

    if (foodBtn) {
        foodBtn.addEventListener("click", () => {
            const container = modal.querySelector("#food-items-container");
            container.insertAdjacentHTML("beforeend", createFoodRow());
        });
    }

    if (medBtn) {
        medBtn.addEventListener("click", () => {
            const container = modal.querySelector("#supplement-items-container");
            container.insertAdjacentHTML("beforeend", createSupplementRow());

            // apply behavior to new med row
            const lastRow = container.lastElementChild;
            applyMedicineUnitBehavior(lastRow);
        });
    }
}

// Remove in edit modal (collect removed meal names)
document.addEventListener("click", (e) => {
    const modal = document.getElementById("editRationModal");
    if (!modal || !modal.classList.contains("active")) return;

    if (e.target.classList.contains("remove-button")) {
        const row = e.target.closest(".item-row");
        if (!row) return;

        // Only for EDIT mode: collect removed meal name if this row was existing
        if (row.dataset.oldId) {
            const mealName = row.querySelector("input[name='meal[]']").value;
            modal._removedMeals = modal._removedMeals || [];
            modal._removedMeals.push(mealName);
        }

        row.remove();
    }
});

async function handleUpdateRation(id, modal) {
    const name = modal.querySelector("#ration-name").value.trim();
    const start_time = modal.querySelector("#start-date").value;
    const end_time = modal.querySelector("#end-date").value;
    const feeds = modal.querySelector("#meals-per-day").value;

    // Collect food
    const foodRows = modal.querySelectorAll(".food-row");
    const foodDetails = [...foodRows].map(r => ({
        meal: r.querySelector("input[name='meal[]']").value,
        warehouse: r.querySelector("select[name='food_warehouse[]']").value,
        weight: Number(r.querySelector("input[name='weight[]']").value) || 0,
        weight_unit: r.querySelector("select[name='weight_unit[]']").value
    }));

    // Collect meds
    const medRows = modal.querySelectorAll(".supplement-row");
    const medDetails = [...medRows].map(r => {
        const du = r.querySelector("select[name='dosage_unit[]']").value;
        return {
            meal: r.querySelector("input[name='meal[]']").value,
            warehouse: r.querySelector("select[name='medition_warehouse[]']").value,
            dosage: Number(r.querySelector("input[name='dosage[]']").value) || 0,
            dosage_unit: `${du}/kg`
        };
    });

    const payload = {
        name,
        start_time,
        end_time,
        number_of_feedings_per_day: Number(feeds),
        foodDetails,
        medDetails,
        removeMeals: modal._removedMeals || []
    };

    console.log("UPDATE PAYLOAD:", payload);

    try {
        const res = await fetch(`/food-ration/edit/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.error || "Cập nhật thất bại");
            return;
        }

        alert("Cập nhật thành công!");
        // close modal and refresh
        modal.classList.remove("active");
        location.reload();
    } catch (err) {
        console.error("Update error", err);
        alert("Lỗi khi cập nhật khẩu phần");
    }
}

// Escape helper to avoid breaking HTML when injecting values
function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Close popup edit handlers (guard existence)
(function setupEditModalCloseHandlers() {
    const editModal = document.getElementById("editRationModal");
    if (!editModal) return;

    // nút X
    const closeBtn = editModal.querySelector(".close-button");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            editModal.classList.remove("active");
        });
    }

    // click ngoài modal
    editModal.addEventListener("click", (e) => {
        if (e.target === editModal) {
            editModal.classList.remove("active");
        }
    });

    // ESC để đóng
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && editModal.classList.contains("active")) {
            editModal.classList.remove("active");
        }
    });
})();

function initDeleteRationHandler() {
    document.addEventListener("click", async (e) => {
        const btn = e.target.closest(".btn-delete");
        if (!btn) return;

        const rationId = btn.dataset.id;
        if (!rationId) return;

        // Confirm xóa
        const confirmDelete = confirm("Bạn có chắc chắn muốn xóa chế độ ăn này?");
        if (!confirmDelete) return;

        try {
            const res = await fetch(`/food-ration/delete/${rationId}`, {
                method: "DELETE"
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.message || "Xóa thất bại!");
                return;
            }

            alert("Đã xóa thành công chế độ ăn!");
            location.reload();

        } catch (err) {
            console.error("Delete ration error:", err);
            alert("Lỗi hệ thống!");
        }
    });
}

async function openDetailRationPopup(id) {
    const modal = document.getElementById("detailRationModal");
    modal.classList.add("active");

    try {
        const res = await fetch(`/food-ration/${id}`);
        const data = await res.json();

        document.getElementById("detail-name").innerText = data.name;
        document.getElementById("detail-start").innerText = data.start_time?.substring(0,10);
        document.getElementById("detail-end").innerText = data.end_time?.substring(0,10);
        document.getElementById("detail-meals").innerText = data.number_of_feedings_per_day;
        document.getElementById("detail-barns").innerText = data.barn?.map(b => b.name).join(", ");

        // FOOD LIST
        const foodList = document.getElementById("detail-food-list");
        foodList.innerHTML = "";
        data.foodDetails.forEach(f => {
            foodList.insertAdjacentHTML("beforeend", `
                <div class="detail-item-row">
                    <span class="meal">${f.meal}</span>
                    <span class="dash">•</span>
                    <span>${f.weight}${f.weight_unit}</span>
                </div>
            `);
        });

        // MED LIST
        const medList = document.getElementById("detail-med-list");
        medList.innerHTML = "";
        data.medDetails.forEach(m => {
            medList.insertAdjacentHTML("beforeend", `
                <div class="detail-item-row">
                    <span class="meal">${m.meal}</span>
                    <span class="dash">•</span>
                    <span>${m.dosage}${m.dosage_unit}</span>
                </div>
            `);
        });

    } catch (err) {
        console.error(err);
        alert("Không thể tải dữ liệu chi tiết!");
    }
}

document.querySelector(".detail-close-btn").onclick = () =>
    document.getElementById("detailRationModal").classList.remove("active");

document.getElementById("detailRationModal").onclick = (e) => {
    if (e.target.id === "detailRationModal") {
        e.target.classList.remove("active");
    }
};
