document.addEventListener("DOMContentLoaded", () => {

    initDrugUseAreaFilter();
    initCreateDrugUseHandler();
    initEditDrugUseHandler();
    initDeleteDrugUseHandler();
    initDrugUseDetailHandler();
});

document.addEventListener("click", function (e) {
        const menuBtn = e.target.closest(".action-more");
        const clickedMenu = e.target.closest(".action-menu");

        // Nếu click vào dấu 3 chấm → toggle menu
        if (menuBtn) {
            const wrapper = menuBtn.closest(".action-wrapper");
            const menu = wrapper.querySelector(".action-menu");

            document.querySelectorAll(".action-menu").forEach(m => {
                if (m !== menu) m.style.display = "none";
            });

            menu.style.display = (menu.style.display === "block") ? "none" : "block";
            return;
        }

        // Nếu click bên trong action-menu → ĐỪNG ĐÓNG MENU
        if (clickedMenu) {
            return; // rất quan trọng
        }

        // Nhấn ra ngoài → đóng menu
        document.querySelectorAll(".action-menu").forEach(m => m.style.display = "none");
    });

function initDrugUseAreaFilter() {
  const select = document.getElementById("filterAreaSelect");
  if (!select) return;

  // Khi thay đổi select → ẩn/hiện đúng khu
  select.addEventListener("change", (e) => {
    const val = e.target.value;

    document.querySelectorAll(".area-block").forEach(block => {
      const areaId = block.dataset.areaId;

      if (!val) {
        block.style.display = "";   // Hiện tất cả
      } else {
        block.style.display = (areaId === val) ? "" : "none";
      }
    });
  });

  // Khi load trang: nếu server gán selectedAreaId → dùng luôn
  if (select.value) {
    select.dispatchEvent(new Event("change"));
  } else {
    // Ngược lại → tự động chọn khu đầu tiên có value
    const firstNonEmpty = [...select.options].find(o => o.value);
    if (firstNonEmpty) {
      select.value = firstNonEmpty.value;
      select.dispatchEvent(new Event("change"));
    }
  }
}

function initCreateDrugUseHandler() {
    const modal = document.getElementById("medicationModal");
    const form = document.getElementById("medicationForm");
    const barnSelect = form.querySelector('select[name="barn"]');
    const hiddenBarnId = document.getElementById("rationBarnId");

    const addMedBtn = document.getElementById("add-medicine-row");
    const medList = document.getElementById("medicine-list");

    const closeBtn = modal.querySelector(".modal-close");

    const API_BARN = "/barn/all";
    const API_MED = "/medition-warehouse/list";
    const API_CREATE = "/drug-use/add";

    let cachedMeds = null;

    // --------------------
    // NÚT CREATE THEO KHU
    // --------------------
    document.querySelectorAll(".btn-add-drug-area").forEach(btn => {
        btn.addEventListener("click", async () => {
            const areaId = btn.closest(".area-block")?.dataset.areaId;
            if (!areaId) return;

            await openCreatePopup({ areaId, barnId: null });
        });
    });

    // NÚT CREATE THEO CHUỒNG
    document.querySelectorAll(".btn-add-drug").forEach(btn => {
        btn.addEventListener("click", async () => {
            const barnId = btn.dataset.barnId;
            const areaId = btn.dataset.areaId;
            if (!barnId) return;

            await openCreatePopup({ areaId, barnId });
        });
    });

    // HÀM MỞ POPUP (giống 100% logic Food Ration openCreatePopup)
    async function openCreatePopup({ areaId, barnId }) {
        form.reset();
        resetMedicineRows();

        modal.dataset.areaId = areaId || "";
        hiddenBarnId.value = barnId || "";

        // Nếu tạo theo CHUỒNG → ẩn select barn
        if (barnId) {
            barnSelect.parentElement.style.display = "none";
        } else {
            barnSelect.parentElement.style.display = "block";
            await loadBarnSelect(areaId);
        }

        await loadMeditions();
        fillMedSelects();

        attachRowControls();

        modal.style.display = "flex";
    }

    // ===============================
    // LOAD BARN (khi tạo theo KHU)
    // ===============================
    async function loadBarnSelect(areaId) {
        barnSelect.innerHTML = `<option value="">-- Select barn --</option>`;

        const res = await fetch(API_BARN);
        const barns = await res.json();

        barns
            .filter(b => b.breedingarea?._id === areaId)
            .forEach(b => {
                barnSelect.appendChild(new Option(b.name, b._id));
            });
    }

    // ===============================
    // LOAD MEDITION WAREHOUSE CACHE
    // ===============================
    async function loadMeditions() {
        if (!cachedMeds) {
            const meds = await fetch(API_MED).then(r => r.json());
            cachedMeds = meds;
        }
    }

    function resolveDosageUnits(capacity) {
        if (!capacity) return ["g"];

        const cap = capacity.toLowerCase();

        if (cap.includes("kg")) return ["g"];
        if (cap.includes("l")) return ["l", "ml"];
        if (cap.includes("ml")) return ["ml"];
        if (cap.includes("g")) return ["g"];

        return ["g"];
    }


    // ===============================
    // FILL MED SELECT
    // ===============================
    function fillMedSelects() {
        medList.querySelectorAll("select[name='medition_warehouse[]']").forEach(sel => {
            fillMedSelect(sel);
        });
    }

    function fillMedSelect(select) {
        select.innerHTML = `<option value="">Select medition</option>`;
        cachedMeds.forEach(m => {
            select.appendChild(new Option(m.name, m._id));
        });
    }

    // ===============================
    // RESET ROWS
    // ===============================
    function resetMedicineRows() {
        while (medList.children.length > 1) medList.lastChild.remove();
        medList.querySelectorAll("input, select").forEach(i => (i.value = ""));
    }

    // ===============================
    // ADD/REMOVE ROW
    // ===============================
    function attachRowControls() {
        // Khi nhấn nút + Add
        addMedBtn.onclick = () => {
            const row = medList.children[0].cloneNode(true);
            row.querySelectorAll("input, select").forEach(i => (i.value = ""));
            fillMedSelect(row.querySelector('select[name="medition_warehouse[]"]'));

            attachMedChangeEvent(row); // <== thêm dòng này

            medList.appendChild(row);
        };

        // Gán sự kiện change cho row đầu tiên
        medList.querySelectorAll(".medicine-row").forEach(row => {
            attachMedChangeEvent(row);
        });

        // Event remove row
        medList.addEventListener("click", e => {
            if (e.target.classList.contains("btn-remove-row")) {
                if (medList.children.length > 1) {
                    e.target.closest(".medicine-row").remove();
                }
            }
        });
    }

    function attachMedChangeEvent(row) {
        const medSelect = row.querySelector('select[name="medition_warehouse[]"]');
        const unitSelect = row.querySelector('select[name="dosage_unit[]"]');

        medSelect.addEventListener("change", () => {
            const medId = medSelect.value;
            const med = cachedMeds.find(m => m._id === medId);

            if (!med) return;

            const units = resolveDosageUnits(med.capacity);

            // render lại danh sách đơn vị
            unitSelect.innerHTML = "";
            units.forEach(u => {
                const opt = document.createElement("option");
                opt.value = u;
                opt.textContent = u;
                unitSelect.appendChild(opt);
            });
        });
    }

    // ===============================
    // COLLECT PAYLOAD
    // ===============================
    function collectPayload() {
        const fd = new FormData(form);

        const barnIdHidden = hiddenBarnId.value;
        const barnSelected = fd.get("barn");
        const areaId = modal.dataset.areaId;

        // Nếu tạo theo CHUỒNG → gửi barnIds
        // Nếu tạo theo KHU → gửi areaId
        let payload = {
            start_date: fd.get("start_date"),
            end_date: fd.get("end_date"),
            reason: fd.get("reason"),
            details: []
        };

        if (barnIdHidden) {
            payload.barnIds = [barnIdHidden];
        } else if (barnSelected) {
            payload.barnIds = [barnSelected];
        } else {
            payload.areaId = areaId;
        }

        // Thuốc chi tiết
        medList.querySelectorAll(".medicine-row").forEach(row => {
            const time = row.querySelector('input[name="time[]"]').value;
            const medition = row.querySelector('select[name="medition_warehouse[]"]').value;
            const method = row.querySelector('input[name="method[]"]').value;
            const dosage = row.querySelector('input[name="dosage[]"]').value;
            const dosage_unit = row.querySelector('select[name="dosage_unit[]"]').value;

            if (time || medition || dosage) {
                payload.details.push({
                    time,
                    method,
                    dosage: dosage ? Number(dosage) : null,
                    dosage_unit,
                    medition_warehouse: medition
                });
            }
        });

        return payload;
    }

    // ===============================
    // SUBMIT
    // ===============================
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const payload = collectPayload();

        const res = await fetch(API_CREATE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const body = await res.json();
        if (!res.ok) {
            return alert(body.error || "Create failed!");
        }

        alert("Medication regimen created successfully!");
        modal.style.display = "none";
        setTimeout(() => location.reload(), 300);
    });

    // ===============================
    // CLOSE POPUP
    // ===============================
    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
    });
}


function initEditDrugUseHandler() {
    
    const editModal = document.getElementById("editMedicationModal");
    const editForm = document.getElementById("editMedicationForm");
    const editBarnIdHidden = document.getElementById("editBarnId");
    const editBarnSelect = editForm.querySelector('select[name="barn"]');
    const editMedList = document.getElementById("edit-medicine-list");
    const editAddRowBtn = document.getElementById("edit-add-medicine-row");

    const API_GET_DETAIL = "/drug-use/detail/";
    const API_GET_MED = "/medition-warehouse/list";
    const API_EDIT = "/drug-use/edit/";

    let cachedMeds = null;

    // Load medicines
    async function loadMeds() {
        if (!cachedMeds) {
            cachedMeds = await fetch(API_GET_MED).then(r => r.json());
        }
    }

    function resolveUnits(capacity) {
        if (!capacity) return ["g"];
        const c = capacity.toLowerCase();

        if (c.includes("kg")) return ["g"];
        if (c.includes("l")) return ["l", "ml"];
        if (c.includes("ml")) return ["ml"];
        if (c.includes("g")) return ["g"];

        return ["g"];
    }

    // Create a medicine-row with optional detail fill
    function createRow(detail = null) {
        const row = document.createElement("div");
        row.className = "medicine-row";
        row.innerHTML = `
            <input type="text" name="time[]" class="input-small">

            <select name="medition_warehouse[]" class="input-select">
                <option value="">Select medition</option>
            </select>

            <input type="text" name="method[]" class="input-select small">

            <input type="text" name="dosage[]" class="input-small">

            <select name="dosage_unit[]" class="input-select"></select>

            <button type="button" class="btn-remove-row">−</button>
        `;

        const medSelect = row.querySelector('select[name="medition_warehouse[]"]');
        const unitSelect = row.querySelector('select[name="dosage_unit[]"]');

        // Fill med list FIRST
        cachedMeds.forEach(m => {
            medSelect.appendChild(new Option(m.name, m._id));
        });

        if (detail) {
            row.querySelector('input[name="time[]"]').value = detail.time || "";
            row.querySelector('input[name="method[]"]').value = detail.method || "";
            row.querySelector('input[name="dosage[]"]').value = detail.dosage || "";

            medSelect.value = detail.medition_warehouse;

            const selectedMed = cachedMeds.find(x => x._id === detail.medition_warehouse);
            const units = resolveUnits(selectedMed?.capacity);

            unitSelect.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join("");
            unitSelect.value = detail.dosage_unit;
        } else {
            unitSelect.innerHTML = `<option value="g">g</option>`;
        }

        medSelect.addEventListener("change", () => {
            const m = cachedMeds.find(x => x._id === medSelect.value);
            if (!m) return;
            const units = resolveUnits(m.capacity);
            unitSelect.innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join("");
        });

        return row;
    }

    editAddRowBtn.addEventListener("click", () => {
        editMedList.appendChild(createRow());
    });

    editMedList.addEventListener("click", e => {
        if (e.target.classList.contains("btn-remove-row") && editMedList.children.length > 1) {
            e.target.closest(".medicine-row").remove();
        }
    });

    async function openEditPopup(id) {

        await loadMeds();

        editModal.style.display = "flex";
        editForm.reset();
        editBarnIdHidden.value = "";
        editMedList.innerHTML = "";

        const res = await fetch(API_GET_DETAIL + id);
        const rs = await res.json();
        if (!rs.success) {
            alert("Cannot load edit data");
            return;
        }

        const data = rs.data;

        editForm.querySelector('input[name="start_date"]').value = data.start_date?.split("T")[0];
        editForm.querySelector('input[name="end_date"]').value = data.end_date?.split("T")[0];
        editForm.querySelector('input[name="reason"]').value = data.reason;

        if (data.barn?.length > 0) {
            editBarnIdHidden.value = data.barn[0]._id;
            editBarnSelect.parentElement.style.display = "none";
        } else {
            editBarnSelect.parentElement.style.display = "";
        }

        if (Array.isArray(data.details) && data.details.length > 0) {
            data.details.forEach(d => editMedList.appendChild(createRow(d)));
        } else {
            editMedList.appendChild(createRow());
        }

        editForm.dataset.id = id;
    }

    // Delegated event listener for dynamic edit buttons
    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-edit");
        if (!btn) return;
        openEditPopup(btn.dataset.id);
    });

    editForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = editForm.dataset.id;

        const fd = new FormData(editForm);

        const payload = {
            start_date: fd.get("start_date"),
            end_date: fd.get("end_date"),
            reason: fd.get("reason"),
            details: []
        };

        if (editBarnIdHidden.value) {
            payload.barnIds = [editBarnIdHidden.value];
        }

        editMedList.querySelectorAll(".medicine-row").forEach(row => {
            payload.details.push({
                time: row.querySelector('input[name="time[]"]').value,
                medition_warehouse: row.querySelector('select[name="medition_warehouse[]"]').value,
                method: row.querySelector('input[name="method[]"]').value,
                dosage: Number(row.querySelector('input[name="dosage[]"]').value) || null,
                dosage_unit: row.querySelector('select[name="dosage_unit[]"]').value
            });
        });

        const res = await fetch(API_EDIT + id, {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (!result.success) {
            alert("Update failed!");
            return;
        }

        alert("Updated successfully!");
        editModal.style.display = "none";
        location.reload();
    });

    editModal.querySelector(".modal-close").addEventListener("click", () => {
        editModal.style.display = "none";
    });

    editModal.addEventListener("click", e => {
        if (e.target === editModal) editModal.style.display = "none";
    });
}













function initDeleteDrugUseHandler() {

    // Bắt tất cả nút delete trong bảng
    document.querySelectorAll(".btn-delete").forEach(btn => {

        btn.addEventListener("click", async () => {

            const id = btn.dataset.id;   // ID của drug use

            if (!id) {
                alert("Không tìm thấy ID drug use để xóa");
                return;
            }

            const ok = confirm("Bạn có chắc chắn muốn xoá thiết lập thuốc này?");
            if (!ok) return;

            try {
                const res = await fetch(`/drug-use/delete/${id}`, {
                    method: "DELETE"
                });

                if (!res.ok) {
                    const err = await res.json();
                    alert("Xóa thất bại: " + err.error);
                    return;
                }

                alert("Xóa thành công!");
                location.reload();

            } catch (error) {
                console.error("Delete drug use error:", error);
                alert("Có lỗi xảy ra khi xóa!");
            }
        });
    });
}

function initDrugUseDetailHandler() {
    const modal = document.getElementById("meditionDetailModal");

    const reasonEl = document.getElementById("detail-reason");
    const barnEl   = document.getElementById("detail-barn");
    const startEl  = document.getElementById("detail-start");
    const endEl    = document.getElementById("detail-end");

    const medTableBody = document.querySelector("#detail-med-table tbody");

    const API_GET_DETAIL = "/drug-use/detail/";

    // ================================
    // 1️⃣ CLICK VÀO "Detail" TRONG MENU
    // ================================
    document.addEventListener("click", async (e) => {

        const btn = e.target.closest(".btn-detail");
        if (!btn) return;

        const id = btn.dataset.id;
        if (!id) return;

        modal.style.display = "flex";
        medTableBody.innerHTML = "";

        // Fetch detail data
        const res = await fetch(API_GET_DETAIL + id);
        const rs = await res.json();

        if (!rs.success) {
            alert("Không tải được dữ liệu chi tiết");
            modal.style.display = "none";
            return;
        }

        const data = rs.data;

        // Fill general info
        reasonEl.textContent = data.reason || "(Không có lý do)";
        barnEl.textContent   = data.barn?.[0]?.name || "N/A";
        startEl.textContent  = data.start_date?.split("T")[0] || "";
        endEl.textContent    = data.end_date?.split("T")[0] || "";

        // Fill medication details
        data.details.forEach(d => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${d.time || ""}</td>
                <td>${d.method || ""}</td>
                <td>${d.dosage || ""}</td>
                <td>${d.dosage_unit || ""}</td>
                <td>${d.medition_warehouse_name || ""}</td>
            `;
            medTableBody.appendChild(tr);
        });

    });

    // ================================
    // 2️⃣ Đóng popup
    // ================================
    modal.querySelector(".detail-close").addEventListener("click", () => {
        modal.style.display = "none";
    });

    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.style.display = "none";
    });
}








