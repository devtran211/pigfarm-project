document.addEventListener("DOMContentLoaded", () => {
    const inputName = document.getElementById("search-med-name");
    const inputPrice = document.getElementById("search-med-price");
    const inputInventory = document.getElementById("search-med-inventory");

    function triggerFilter() {
        filterMedicineTable(inputName, inputPrice, inputInventory, ".custom-table");
    }

    inputName.addEventListener("input", triggerFilter);
    inputPrice.addEventListener("input", triggerFilter);
    inputInventory.addEventListener("input", triggerFilter);

    initCreateMedicineModal();
    initEditMedicineModal();
    initDeleteMedicine();
    initDetailMedicineModal();
});

function initCreateMedicineModal() {
    const modal = document.getElementById("createNewMedicine");
    const openBtn = document.getElementById("openCreateModal");
    const closeBtn = modal.querySelector(".close-btn");
    const saveBtn = modal.querySelector(".save-btn");

    // mở popup
    openBtn.addEventListener("click", () => {
        modal.style.display = "flex";
    });

    // đóng popup
    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    // đóng popup khi click ra ngoài modal-content
    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
    });

    // Lưu dữ liệu
    saveBtn.addEventListener("click", async () => {
        const data = {
            name: modal.querySelector("input[name='name']").value.trim(),
            brand: modal.querySelector("input[name='brand']").value.trim(),
            medicineType: modal.querySelector("select[name='medicineType']").value,
            usageType: modal.querySelector("select[name='usageType']").value,
            unit: modal.querySelector("input[name='unit']").value.trim(),
            capacity: modal.querySelector("input[name='capacity']").value.trim(),
            dateOfManufacture: modal.querySelector("input[name='dateOfManufacture']").value,
            expiry: modal.querySelector("input[name='expiry']").value,
            note: modal.querySelector("textarea[name='note']").value
        };

        try {
            const res = await fetch("/medition-warehouse/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            console.log("Save:", result);

            alert("Thêm thuốc thành công!");
            modal.style.display = "none";
            location.reload();

        } catch (err) {
            console.error(err);
            alert("Đã xảy ra lỗi khi lưu thuốc");
        }
    });
}

function initEditMedicineModal() {
    const modal = document.getElementById("editMedicine");
    const closeBtn = modal.querySelector(".close-btn");
    const saveBtn = modal.querySelector(".save-btn");

    let currentEditId = null;

    // MỞ POPUP KHI NHẤN EDIT
    document.querySelectorAll(".btn-edit").forEach(btn => {
        btn.addEventListener("click", async () => {
            currentEditId = btn.dataset.id;

            // Gọi API lấy dữ liệu medicine theo id
            const res = await fetch(`/medition-warehouse/detail/${currentEditId}`);
            const data = await res.json();

            // Đổ dữ liệu vào form
            modal.querySelector("input[name='name']").value = data.name;
            modal.querySelector("input[name='brand']").value = data.brand;
            modal.querySelector("select[name='medicineType']").value = data.medicineType;
            modal.querySelector("select[name='usageType']").value = data.usageType;
            modal.querySelector("input[name='unit']").value = data.unit;
            modal.querySelector("input[name='capacity']").value = data.capacity;
            modal.querySelector("input[name='inventory']").value = data.inventory;

            modal.querySelector("input[name='dateOfManufacture']").value = data.dateOfManufacture?.substring(0, 10);
            modal.querySelector("input[name='expiry']").value = data.expiry?.substring(0, 10);
            modal.querySelector("textarea[name='note']").value = data.note || "";

            modal.style.display = "flex";
        });
    });

    // ĐÓNG POPUP
    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
    });

    // LƯU CHỈNH SỬA
    saveBtn.addEventListener("click", async () => {
        const body = {
            name: modal.querySelector("input[name='name']").value,
            brand: modal.querySelector("input[name='brand']").value,
            medicineType: modal.querySelector("select[name='medicineType']").value,
            usageType: modal.querySelector("select[name='usageType']").value,
            unit: modal.querySelector("input[name='unit']").value,
            capacity: modal.querySelector("input[name='capacity']").value,
            inventory: Number(modal.querySelector("input[name='inventory']").value),

            dateOfManufacture: modal.querySelector("input[name='dateOfManufacture']").value,
            expiry: modal.querySelector("input[name='expiry']").value,
            note: modal.querySelector("textarea[name='note']").value
        };

        const res = await fetch(`/medition-warehouse/edit/${currentEditId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const result = await res.json();
        console.log(result);

        alert("Update successful!");
        modal.style.display = "none";
        location.reload();
    });
}

function initDeleteMedicine() {
    document.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;

            const confirmDelete = confirm("Bạn có chắc chắn muốn xóa thuốc này không?");
            if (!confirmDelete) return;

            const res = await fetch(`/medition-warehouse/delete/${id}`, {
                method: "DELETE"
            });

            const result = await res.json();
            console.log(result);

            alert("Xóa thành công!");
            location.reload();
        });
    });
}

function initDetailMedicineModal() {
    const modal = document.getElementById("detailMedicine");
    if (!modal) {
        console.warn("[detailModal] element #detailMedicine not found on page. Detail modal will be disabled.");
        return;
    }

    const closeBtn = modal.querySelector(".close-btn");
    if (!closeBtn) {
        console.warn("[detailModal] .close-btn not found inside modal.");
    }

    // helper để an toàn set text
    function safeSet(id, value) {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`[detailModal] Element with id="${id}" not found. Skipping.`);
            return;
        }
        el.textContent = value ?? "—";
    }

    // Lấy tất cả row có class .medicine-row
    const rows = document.querySelectorAll(".medicine-row");
    if (!rows || rows.length === 0) {
        // Không nhất thiết là lỗi, nhưng log để bạn biết
        console.info("[detailModal] No .medicine-row found on page.");
    }

    rows.forEach(row => {
        row.addEventListener("click", async (e) => {
            // Nếu click vào action buttons (edit/delete), không mở detail
            if (e.target.closest(".action-wrapper")) return;

            const id = row.dataset.id;
            if (!id) {
                console.warn("[detailModal] clicked row has no data-id attribute.");
                return;
            }

            try {
                const res = await fetch(`/medition-warehouse/detail/${id}`);
                if (!res.ok) {
                    console.error("[detailModal] failed to fetch detail:", res.status, res.statusText);
                    return;
                }
                const data = await res.json();

                // Set dữ liệu một cách an toàn
                safeSet("detail-name", data?.name);
                safeSet("detail-brand", data?.brand);
                safeSet("detail-medicinetype", data?.medicineType);
                safeSet("detail-usagetype", data?.usageType);
                safeSet("detail-unit", data?.unit);
                safeSet("detail-capacity", data?.capacity);
                safeSet("detail-inventory", (data?.inventory ?? "—").toString());

                // format ngày an toàn
                const dom = data?.dateOfManufacture ? data.dateOfManufacture.substring(0,10) : "—";
                const exp = data?.expiry ? data.expiry.substring(0,10) : "—";
                safeSet("detail-dom", dom);
                safeSet("detail-expiry", exp);

                // note (id detail-note may be a <p>, so set textContent)
                const noteEl = document.getElementById("detail-note");
                if (noteEl) noteEl.textContent = data?.note ?? "—";
                else console.warn('[detailModal] element with id="detail-note" not found.');

                modal.style.display = "flex";
            } catch (err) {
                console.error("[detailModal] error loading detail:", err);
            }
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            modal.style.display = "none";
        });
    }

    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
    });
}

function filterMedicineTable(nameInput, priceInput, inventoryInput, tableSelector) {
    const rows = document.querySelectorAll(`${tableSelector} tbody tr`);

    const nameValue = nameInput.value.toLowerCase().trim();
    const priceValue = priceInput.value.trim();
    const inventoryValue = inventoryInput.value.trim();

    rows.forEach(row => {
        const medicineName = row.querySelector("td strong")?.textContent.toLowerCase() || "";
        const medicinePrice = row.querySelectorAll("td")[2]?.textContent.replace(/[^0-9]/g, "") || "";
        const medicineInventory = row.querySelectorAll("td")[3]?.textContent.trim() || "";

        let isMatch = true;

        // Name
        if (nameValue && !medicineName.includes(nameValue)) isMatch = false;

        // Price (nhập 1000 → tìm chứa 1000)
        if (priceValue && !medicinePrice.includes(priceValue)) isMatch = false;

        // Inventory
        if (inventoryValue && !medicineInventory.includes(inventoryValue)) isMatch = false;

        row.style.display = isMatch ? "" : "none";
    });
}
