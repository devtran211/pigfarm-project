document.addEventListener("DOMContentLoaded", () => {
    const barnId = document.getElementById("currentBarn").dataset.id;

    loadHerdList(barnId);
    initInvestmentChart(barnId);
    initBarnHealth();
    initImportHerdModal(barnId);
    initEditHerdButtons();
    initCloseEditHerdModal();
    initSaveEditHerd();
    initSplitModule();
    initRecallHerdButtons();
    initPigListModalEvents();
    initHerdDetailButton();
});

//  Hàm khởi tạo tất cả logic chart
async function initInvestmentChart(barnId) {
    const data = await loadInvestmentData(barnId);
    renderCostChart(data);
    updateSummaryFooter(data);
}

//  Hàm load dữ liệu chi phí
async function loadInvestmentData(barnId) {
    const res = await fetch(`/barn/${barnId}/investment`);
    return await res.json();
}

//  Hàm vẽ Pie Chart
function renderCostChart(data) {
    console.log("Rendering chart with data:", data);

    const canvas = document.getElementById('costChart');

    // Xóa chart cũ nếu có (tránh vẽ chồng)
    if (window.costChartInstance) {
        window.costChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');

    const chartData = [
        data.food_cost || 0,
        data.medition_cost || 0,
        data.breeding_cost || 0,
        (data.total || 0) - ((data.food_cost || 0) + (data.medition_cost || 0) + (data.breeding_cost || 0))
    ];

    window.costChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Thức ăn', 'Thuốc', 'Con giống', 'Khác'],
            datasets: [{
                data: chartData,
                backgroundColor: ['#ffeb3b', '#ff9800', '#9c27b0', '#4caf50']
            }]
        },
        options: {
            plugins: {
                legend: { display: false }   // 🔥 Tắt legend mặc định
            }
        }
    });
}

//  Hàm cập nhật Total & Profit
function updateSummaryFooter(data) {
    const total = data.total || 0;
    const profit = 0 - total; // hoặc công thức bạn muốn

    document.querySelector(".summary-item.cost .value").innerText =
        `${total.toLocaleString()}₫`;

    document.querySelector(".summary-item.profit .value").innerText =
        `${profit.toLocaleString()}₫`;
}

// format helper
function fmtNumber(n) {
    if (n === null || n === undefined) return '-';
    return Number(n).toLocaleString(); // có thể thêm đơn vị nếu cần
}
function fmtKg(n) {
    if (n === null || n === undefined) return '-';
    return `${Number(n).toLocaleString()} kg`;
}
function fmtDateISO(d) {
    if (!d) return '-';
    const dt = new Date(d);
    if (isNaN(dt)) return '-';
    return dt.toLocaleDateString(); // hoặc dt.toISOString().split('T')[0]
}

// Hàm load data BarnHealth cho barnId
async function loadBarnHealth(barnId) {
    try {
        const res = await fetch(`/barn/${barnId}/health`);
        if (!res.ok) throw new Error('Fetch health failed: ' + res.status);
        const data = await res.json();
        return data;
    } catch (err) {
        console.error('loadBarnHealth error', err);
        return null;
    }
}

// Hàm render dữ liệu vào DOM (tách riêng để dễ gọi lại)
function renderBarnHealth(data) {
    // Nếu bạn đã thêm id trong HTML thì chọn bằng id:
    const avgEl = document.getElementById('bh-averageWeight');
    const lossEl = document.getElementById('bh-loss');
    const faecesEl = document.getElementById('bh-faecesStatus');
    const dateEl = document.getElementById('bh-date');

    if (!avgEl || !lossEl || !faecesEl || !dateEl) {
        // fallback: tìm bằng selector theo cấu trúc nếu id không có
        console.warn('Some BH elements not found, trying fallback selectors');
    }

    // Điền dữ liệu an toàn
    if (data) {
        if (avgEl) avgEl.innerText = data.averageWeight != null ? fmtKg(data.averageWeight) : '-';
        if (lossEl) lossEl.innerText = data.loss != null ? `${fmtNumber(data.loss)} con` : '-';
        if (faecesEl) faecesEl.innerText = data.faecesStatus || '-';
        if (dateEl) dateEl.innerText = data.dateOfInspection ? fmtDateISO(data.dateOfInspection) : '-';
    } else {
        if (avgEl) avgEl.innerText = '-';
        if (lossEl) lossEl.innerText = '-';
        if (faecesEl) faecesEl.innerText = '-';
        if (dateEl) dateEl.innerText = '-';
    }
}

// Hàm init để gọi trong DOMContentLoaded
async function initBarnHealth() {
    // Lấy barnId từ DOM (bạn đã thêm #currentBarn trước đó)
    const barnEl = document.getElementById('currentBarn');
    if (!barnEl) {
        console.warn('currentBarn element not found — cannot load BarnHealth');
        return;
    }
    const barnId = barnEl.dataset.id;
    if (!barnId) {
        console.warn('barnId not found in #currentBarn');
        return;
    }

    const data = await loadBarnHealth(barnId);
    renderBarnHealth(data);
}

function initImportHerdModal(barnId) {
    const importBtn = document.querySelector(".add-button");
    const modal = document.querySelector(".modal-overlay");
    const closeBtn = modal.querySelector(".close-btn");
    const saveBtn = modal.querySelector(".save-btn");

    // Mở popup
    importBtn.addEventListener("click", () => {
        modal.style.display = "flex";
        loadHerdOptions();
    });

    // Đóng popup
    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    // Submit nhập đàn
    saveBtn.addEventListener("click", async () => {
        const herdId = document.querySelector("select[name='herd']").value;
        const herdCode = document.querySelector("input[name='herdCode']").value;
        const avgWeight = document.querySelector("input[name='avgWeight']").value;
        const importDate = document.querySelector("input[name='importDate']").value;
        const note = document.querySelector("textarea[name='note']").value;
        const quantity = document.querySelector("input[name='quantity']")?.value;

        const payload = {
            herdId,
            barnId,
            herdCode,
            avgWeight,
            importDate,
            note,
            importQuantity: quantity
        };

        try {
            const res = await fetch('/barn/import-herd', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (!res.ok) {
                return alert(result.message);
            }

            alert("Thêm đàn thành công!");

            modal.style.display = "none";

            // Cập nhật lại bảng herd ngay sau khi thêm
            //...
        } catch (err) {
            console.error("Error importing herd:", err);
            alert("Có lỗi xảy ra khi nhập đàn.");
        }
    });
}

async function loadHerdList(barnId) {
    const res = await fetch(`/barn/${barnId}/herd-list`);
    const data = await res.json();

    const tbody = document.getElementById("herdTableBody");

    tbody.innerHTML = data.map(h => `
        <tr class="herd-row" data-id="${h._id}">
            <td>${h.herdCode || '-'}</td>
            <td>${h.importQuantity || '-'}</td>
            <td>${Number(h.avgWeight).toFixed(2)}</td>
            <td>${h.sex || '-'}</td>
            <td>${new Date(h.importDate).toLocaleDateString()}</td>

            <td class="action-cell">
                <div class="action-wrapper">
                    <span class="action-more">&#8942;</span>
                    <div class="action-menu">
                        <button class="btn-detail" data-id="${h._id}">Detail</button>
                        <button class="btn-edit" data-id="${h._id}">Edit</button>
                        <button class="btn-split" data-id="${h._id}">Split</button>
                        <button class="btn-recall" data-id="${h._id}">Recall</button>
                    </div>
                </div>
            </td>
        </tr>
    `).join("");

    // Kích hoạt menu 3 chấm sau khi load xong bảng
    initHerdActionMenu();
}

async function loadHerdOptions() {
    const select = document.querySelector("select[name='herd']");
    if (!select) return;

    try {
        const res = await fetch("/barn/herd-list");
        const data = await res.json();

        // Xóa options cũ
        select.innerHTML = `<option value="">-- Select herd --</option>`;

        data.forEach(h => {
            const opt = document.createElement("option");
            opt.value = h._id;

            // Hiển thị label dễ hiểu hơn
            opt.textContent = `${h.name} (${h.inventory} con tồn)`;

            select.appendChild(opt);
        });

    } catch (err) {
        console.error("Không load được danh sách herd:", err);
    }
}

function initHerdActionMenu() {
    document.addEventListener("click", function (e) {
        const isMoreBtn = e.target.classList.contains("action-more");
        const allMenus = document.querySelectorAll(".action-menu");

        // Nếu click ngoài menu → đóng hết
        if (!isMoreBtn) {
            allMenus.forEach(m => m.style.display = "none");
            return;
        }

        const menu = e.target.nextElementSibling;
        const isVisible = menu.style.display === "block";

        // Đóng tất cả menu trước khi mở menu mới
        allMenus.forEach(m => (m.style.display = "none"));

        // Toggle menu
        menu.style.display = isVisible ? "none" : "block";
    });
}

function initEditHerdButtons() {
    document.addEventListener("click", async function (e) {
        if (!e.target.classList.contains("btn-edit")) return;

        const id = e.target.dataset.id;

        const res = await fetch(`/barn/herd-detail/${id}`);
        const data = await res.json();
        console.log(data);

        openEditHerdModal(data);
    });
}

function openEditHerdModal(data) {
    const modal = document.getElementById("editHerdModal");
    modal.style.display = "flex";

    // Populate fields
    modal.querySelector("input[name='herdCode']").value = data.herdCode || "";
    modal.querySelector("input[name='quantity']").value = data.importQuantity || 0;
    modal.querySelector("input[name='avgWeight']").value = data.avgWeight || "";
    modal.querySelector("input[name='importDate']").value = data.importDate ? data.importDate.split("T")[0] : "";
    modal.querySelector("textarea[name='note']").value = data.note || "";

    // Select herd (locked)
    const selectHerd = modal.querySelector("select[name='herd']");
    selectHerd.innerHTML = `<option value="${data.herd._id}">${data.herd.name}</option>`;
    selectHerd.disabled = true; // không cho chỉnh sửa herd

    // Gắn ID vào modal để dùng khi save
    modal.dataset.id = data._id;
}

function initSaveEditHerd() {
    const saveBtn = document.querySelector("#editHerdModal .save-btn");

    saveBtn.addEventListener("click", async function () {

        const modal = document.getElementById("editHerdModal");
        const id = modal.dataset.id;

        const payload = {
            newQuantity: Number(modal.querySelector("input[name='quantity']").value),
            avgWeight: modal.querySelector("input[name='avgWeight']").value,
            note: modal.querySelector("textarea[name='note']").value,
            date: modal.querySelector("input[name='importDate']").value
        };

        const res = await fetch(`/barn/update-herd/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.message);
            return;
        }

        alert("Cập nhật thành công!");

        modal.style.display = "none";

        const barnId = document.getElementById("currentBarn").dataset.id;
        
        loadHerdList(barnId);
        initHerdActionMenu();
    });
}

function initCloseEditHerdModal() {
    const modal = document.getElementById("editHerdModal");

    // Click nút Close
    modal.querySelector(".close-btn").addEventListener("click", () => {
        modal.style.display = "none";
    });

    // Click ra ngoài
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });
}

function initTagInputs() {
  const tagsContainer = document.getElementById('tagsContainer');
  if (!tagsContainer) return;

  tagsContainer.addEventListener('click', (event) => {
    // Thêm dòng tag mới
    if (event.target.classList.contains('add-tag-btn')) {
      const currentTagGroup = event.target.closest('.tag-input-group');

      // chuyển nút + hiện tại thành nút -
      event.target.classList.remove('add-tag-btn');
      event.target.classList.add('remove-tag-btn');
      event.target.textContent = '–';
      event.target.setAttribute('type', 'button');

      // style input cũ (nếu bạn cần)
      const currentInput = currentTagGroup.querySelector('.tag-input');
      currentInput.style.borderTopRightRadius = '4px';
      currentInput.style.borderBottomRightRadius = '4px';
      currentInput.style.borderRight = '1px solid #ccc';

      // tạo dòng tag mới
      const newTagGroup = document.createElement('div');
      newTagGroup.classList.add('input-with-button', 'tag-input-group');

      newTagGroup.innerHTML = `
        <input type="text" class="tag-input" placeholder="Enter tag">
        <button type="button" class="add-tag-btn">+</button>
      `;

      tagsContainer.appendChild(newTagGroup);
      newTagGroup.querySelector('.tag-input').focus();
      return;
    }

    // Xóa dòng tag
    if (event.target.classList.contains('remove-tag-btn')) {
      const tagGroupToRemove = event.target.closest('.tag-input-group');
      if (tagsContainer.children.length > 1) {
        tagsContainer.removeChild(tagGroupToRemove);
      }
      return;
    }
  });
}

async function loadBarnsIntoSelect(excludeBarnId = null) {
  const sel = document.getElementById('selectBarn');
  if (!sel) return;

  try {
    const res = await fetch('/barn/all'); 
    if (!res.ok) throw new Error('Cannot load barns');
    const barns = await res.json();

    // clear & default option
    sel.innerHTML = `<option value="" disabled selected>Select barn</option>`;

    barns.forEach(b => {
      // nếu muốn exclude barn hiện tại: if (b._id === excludeBarnId) return;
      sel.insertAdjacentHTML('beforeend', `<option value="${b._id}">${b.name || b._id}</option>`);
    });
  } catch (err) {
    console.error('Error loading barns:', err);
  }
}

function openSplitHerdModal(fromBarnHerdDetailId) {
  const modal = document.getElementById('splitHerdModal');
  if (!modal) return;

  modal.style.display = 'flex';
  modal.dataset.detailId = fromBarnHerdDetailId;

  // reset fields
  const q = document.getElementById('quantity');
  const avg = document.getElementById('averageWeight');
  const note = document.getElementById('note');
  const tagsContainer = document.getElementById('tagsContainer');

  if (q) q.value = '';
  if (avg) avg.value = '';
  if (note) note.value = '';

  // reset tags to single input row
  if (tagsContainer) {
    tagsContainer.innerHTML = `
      <div class="input-with-button tag-input-group">
        <input type="text" class="tag-input" placeholder="Enter tag">
        <button type="button" class="add-tag-btn">+</button>
      </div>
    `;
  }
}

function initSplitModalClose() {
  const modal = document.getElementById('splitHerdModal');
  if (!modal) return;

  // close buttons: .close-btn inside modal
  modal.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-btn') || e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

function initSplitHerdButtons() {
  // event delegation
  document.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('btn-split')) return;

    const detailId = e.target.dataset.id;
    if (!detailId) return alert('Missing detail id');

    await loadBarnsIntoSelect(); 

    openSplitHerdModal(detailId);
  });
}

function initSaveSplitHerd() {
  const saveBtn = document.querySelector('#splitHerdModal .save-btn');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', async () => {
    const modal = document.getElementById('splitHerdModal');
    if (!modal) return;
    const fromBarnHerdDetailId = modal.dataset.detailId;
    if (!fromBarnHerdDetailId) return alert('Không xác định được bản ghi nguồn');

    const toBarnId = document.getElementById('selectBarn').value;
    // collect tags
    const tagInputs = Array.from(document.querySelectorAll('.tag-input'));
    const tags = tagInputs.map(i => i.value.trim()).filter(v => v !== '');

    const quantityEl = document.getElementById('quantity');
    const quantity = quantityEl ? Number(quantityEl.value) : 0;

    const avgWeight = Number(document.getElementById('averageWeight').value || 0);
    const note = document.getElementById('note').value || '';

    // validation
    if (!toBarnId) return alert('Vui lòng chọn chuồng đích');

    // if tags exist -> let backend use tags; else require quantity > 0
    if (tags.length === 0) {
      if (!quantity || isNaN(quantity) || quantity <= 0) {
        return alert('Vui lòng nhập số lượng (quantity) lớn hơn 0 hoặc nhập tags để tách theo tag');
      }
    }

    // payload: send tags when present, otherwise send quantity
    const payload = {
      fromBarnHerdDetailId,
      toBarnId,
      quantity: tags.length > 0 ? 0 : quantity, // backend will check tags first; quantity optional if tags provided
      tags, // [] if none
      avgWeight,
      note
    };

    console.log('Split payload:', payload);

    try {
      const res = await fetch('/barn/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const body = await res.json();
      if (!res.ok) {
        alert(body.message || 'Tách đàn thất bại');
        return;
      }

      alert(body.message || 'Tách đàn thành công');

      // close modal
      modal.style.display = 'none';

      // refresh herd list of current barn (source barn)
      const barnId = document.getElementById('currentBarn')?.dataset?.id;
      if (barnId) {
        loadHerdList(barnId);
      }
      initHerdActionMenu();

    } catch (err) {
      console.error('Error split:', err);
      alert('Lỗi khi tách đàn');
    }
  });
}

//  Init all split-related stuff
function initSplitModule() {
  initTagInputs();
  initSplitHerdButtons();
  initSaveSplitHerd();
  initSplitModalClose();
}

function initRecallHerdButtons() {
    document.addEventListener("click", async function (e) {
        if (!e.target.classList.contains("btn-recall")) return;

        const detailId = e.target.dataset.id;

        if (!confirm("Bạn có chắc chắn muốn thu hồi đàn này?")) {
            return;
        }

        try {
            const res = await fetch(`/barn/recall/${detailId}`, {
                method: "DELETE"
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.message);
                return;
            }

            alert("Thu hồi đàn thành công!");

            // Refresh lại bảng herd
            const barnId = document.getElementById("currentBarn").dataset.id;
            loadHerdList(barnId);

        } catch (error) {
            console.error("Recall error:", error);
            alert("Lỗi khi thu hồi đàn");
        }
    });
}

function openPigListModal() {
    document.getElementById("pigListModal").style.display = "flex";
}

function initPigListModalEvents() {

    const modal = document.getElementById("pigListModal");

    // Hàm đóng popup
    function closePigListModal() {
        modal.style.display = "none";
    }

    // Sự kiện click chung cho toàn trang
    document.addEventListener("click", function (e) {

        // 1. Bấm vào nút X
        if (e.target.closest("#pigListModal .close-btn")) {
            closePigListModal();
            return;
        }

        // 2. Bấm nút Close (nút màu xanh)
        if (e.target.id === "closePigListButton") {
            closePigListModal();
            return;
        }

        // 3. Click vào overlay (bên ngoài modal)
        if (e.target === modal) {
            closePigListModal();
            return;
        }
    });

    // Cho phép các hàm khác (như loadPigList) gọi đóng popup
    window.closePigListModal = closePigListModal;
}

async function loadPigList(detailId) {
    const res = await fetch(`/barn/pigs/${detailId}`);
    const data = await res.json();

    if (!res.ok) {
        alert(data.message);
        return;
    }

    // Set herd name
    document.getElementById("pigListHerdName").textContent = data.herdName;

    // Render table
    const tbody = document.getElementById("pigListBody");
    tbody.innerHTML = data.pigs.map(p => `
        <tr>
            <td>${p.tag}</td>
            <td>${p.sex}</td>
            <td>${p.status || "-"}</td>
            <td>${p.birthDate ? new Date(p.birthDate).toLocaleDateString() : "-"}</td>
        </tr>
    `).join("");

    // Show popup
    openPigListModal();
}

function initHerdDetailButton() {
    document.addEventListener("click", async function (e) {
        if (!e.target.classList.contains("btn-detail")) return;

        const detailId = e.target.dataset.id;

        console.log("Load pigs for herd detail:", detailId);

        await loadPigList(detailId);  
        openPigListModal();           
    });
}

