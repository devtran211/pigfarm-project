document.addEventListener('DOMContentLoaded', function () {
    loadInvoiceOptions();
    initInvoicePopup();
    initInvoiceDynamicRows();
    initInvoicePriceCalculator();
    initPriceAutoFormat(); 
    initInvoiceDelete();

    document.addEventListener("click", function (e) {
        if (e.target.classList.contains("submit-btn")) {
            e.preventDefault();
            submitInvoice();
        }
    });

    document.addEventListener('click', function(e) {

        // Mở menu 3 chấm
        if (e.target.classList.contains('more-btn')) {
            e.preventDefault();
            const menu = e.target.nextElementSibling;
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                if (m !== menu) m.classList.remove('show');
            });
            menu.classList.toggle('show');
        }

        // Nhấn ngoài để đóng
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
        }

        // Chuyển sang trang detail
        if (e.target.classList.contains('btn-detail')) {
            const id = e.target.dataset.id;
            window.location.href = `/invoices/${id}`;
        }
    });
});

function initInvoicePopup() {
    const overlay = document.getElementById('invoiceOverlay');
    const popup = document.getElementById('createInvoiceModal');
    const openBtn = document.querySelector('.btn-farmgo');
    const closeBtn = document.querySelector('#createInvoiceModal .close-btn');

    if (!overlay || !popup) {
        console.warn('Popup hoặc overlay không tồn tại!');
        return;
    }

    // --- Mở popup ---
    openBtn?.addEventListener('click', () => {
        overlay.style.display = 'flex';
    });

    // --- Đóng popup bằng nút X ---
    closeBtn?.addEventListener('click', () => {
        overlay.style.display = 'none';
    });

    // --- Đóng popup khi click ra ngoài ---
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });
}

async function loadInvoiceOptions() {
    try {
        const res = await fetch("/invoices/options");
        const data = await res.json();

        // 1. Supplier
        const supplierSelect = document.getElementById("supplier");
        data.suppliers.forEach(s => {
            supplierSelect.innerHTML += `<option value="${s._id}">${s.name}</option>`;
        });

        // 2. Herd (breeding)
        document.querySelectorAll('select[name="select-breeding"]').forEach(sel => {
            data.herds.forEach(h => {
                sel.innerHTML += `<option value="${h._id}">${h.name}</option>`;
            });
        });

        // 3. Food
        document.querySelectorAll('select[name="select-food"]').forEach(sel => {
            data.foods.forEach(f => {
                sel.innerHTML += `<option value="${f._id}">${f.name}</option>`;
            });
        });

        // 4. Medition
        document.querySelectorAll('select[name="select-medition"]').forEach(sel => {
            data.meds.forEach(m => {
                sel.innerHTML += `<option value="${m._id}">${m.name}</option>`;
            });
        });

    } catch (err) {
        console.error("Failed to load options", err);
    }
}

function collectInvoiceItems() {
    const sections = document.querySelectorAll(".import-section");
    const items = [];

    sections.forEach(section => {
        const title = section.querySelector("h3").textContent.toLowerCase();

        let type = "";
        if (title.includes("breeding")) type = "Herd";
        if (title.includes("food")) type = "Food";
        if (title.includes("medition")) type = "Medition";

        // 1. Dòng đầu tiên
        const firstSelect = section.querySelector(".import-header-row select");
        const firstInputs = section.querySelectorAll(".import-detail-fields input");

        if (firstSelect && firstSelect.value && firstInputs.length === 2) {
            const price = parseFloat(firstInputs[0].value.replace(/,/g, "")) || 0;
            const quantity = parseFloat(firstInputs[1].value.replace(/,/g, "")) || 0;

            if (price > 0 && quantity > 0) {
                items.push({
                    type,
                    refId: firstSelect.value,
                    price,
                    quantity
                });
            }
        }

        // 2. Các dòng add thêm
        const newRows = section.querySelectorAll(".new-item-entry-wrapper");

        newRows.forEach(row => {
            const sel = row.querySelector("select");
            const inputs = row.querySelectorAll(".import-detail-fields input");

            if (sel && inputs.length === 2) {
                const price = parseFloat(inputs[0].value.replace(/,/g, "")) || 0;
                const quantity = parseFloat(inputs[1].value.replace(/,/g, "")) || 0;

                if (price > 0 && quantity > 0) {
                    items.push({
                        type,
                        refId: sel.value,
                        price,
                        quantity
                    });
                }
            }
        });
    });

    return items;
}

async function submitInvoice() {
    const name = document.getElementById("name").value.trim();
    const discount = parseFloat(document.getElementById("discount-total").value.replace(/,/g, "")) || 0;
    const payment_status = document.getElementById("payment-status").value;
    const supplier = document.getElementById("supplier").value;

    const items = collectInvoiceItems();
    if (items.length === 0) {
        alert("Please add at least one item");
        return;
    }

    // Total đã được tính sẵn
    let grandTotal = 0;
    items.forEach(i => grandTotal += (i.price * i.quantity));
    const totalFinal = grandTotal - discount;

    const body = {
        name,
        items,
        discount,
        totalFinal,
        payment_status,
        supplier,
        creation_date: new Date()
    };

    try {
        const res = await fetch("/invoices/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (res.ok) {
            alert("Invoice created successfully!");
            location.reload();
        } else {
            alert(data.error || "Error creating invoice");
        }

    } catch (err) {
        console.error("Submit error:", err);
        alert("Network error");
    }
}

function initInvoiceDelete() {
    document.addEventListener("click", async function (e) {
        const deleteBtn = e.target.closest(".btn-delete");
        if (!deleteBtn) return;

        const id = deleteBtn.dataset.id;
        if (!id) {
            console.error("❌ Invoice ID not found!");
            return;
        }

        // Xác nhận xóa (không popup, chỉ alert confirm)
        const confirmDelete = window.confirm("Are you sure you want to delete this invoice?");
        if (!confirmDelete) return;

        try {
            const res = await fetch(`/invoices/delete/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" }
            });

            const data = await res.json();

            if (res.ok) {
                alert("Invoice deleted successfully!");
                location.reload();
            } else {
                alert(data.error || "Delete failed!");
            }

        } catch (err) {
            console.error("Delete error:", err);
            alert("Server error!");
        }
    });
}

function initInvoiceDynamicRows() {

    // --- Hàm tạo nhóm nút hành động (Xóa + Add) ---
    function createActionGroup(rowContainer, sectionElement, headerSelectName) {
        const actionGroup = document.createElement('div');
        actionGroup.className = 'import-action-group';

        // Nút Xóa
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'Xóa';

        removeBtn.addEventListener('click', function (e) {
            e.preventDefault();
            rowContainer.remove();

            // Nếu không còn dòng mới → hiện lại nút Add ban đầu
            const remainingRows = sectionElement.querySelectorAll('.new-item-entry-wrapper');
            const initialActionContainer = sectionElement.querySelector('.initial-add-container');

            if (remainingRows.length === 0 && initialActionContainer) {
                initialActionContainer.style.display = 'block';
            }
        });

        // Nút Add
        const newAddBtn = document.createElement('button');
        newAddBtn.className = 'add-btn';
        newAddBtn.textContent = '+ Add';

        newAddBtn.addEventListener('click', function (e) {
            e.preventDefault();
            addNewImportRow(sectionElement, headerSelectName, rowContainer.nextElementSibling);
        });

        actionGroup.appendChild(removeBtn);
        actionGroup.appendChild(newAddBtn);

        return actionGroup;
    }

    // --- Hàm tìm parent import-section ---
    function findParentSection(button) {
        let current = button.parentNode;
        while (current && !current.classList.contains('import-section')) {
            current = current.parentNode;
        }
        return current;
    }

    // --- Hàm thêm dòng mới ---
    function addNewImportRow(sectionElement, headerSelectName, insertBeforeElement) {

        const originalHeaderRow = sectionElement.querySelector('.import-header-row');
        const originalDetailFields = sectionElement.querySelector('.import-detail-fields');

        const newHeaderRow = originalHeaderRow.cloneNode(true);
        const newDetailFields = originalDetailFields.cloneNode(true);

        // Reset giá trị
        newHeaderRow.querySelector(`select[name="${headerSelectName}"]`).selectedIndex = 0;
        newDetailFields.querySelectorAll('input').forEach(input => input.value = "");

        const newRowContainer = document.createElement('div');
        newRowContainer.classList.add('new-item-entry-wrapper');
        newRowContainer.style.paddingTop = '15px';
        newRowContainer.style.borderTop = '1px dashed #ddd';
        newRowContainer.style.marginBottom = '20px';

        newRowContainer.appendChild(newHeaderRow);
        newRowContainer.appendChild(newDetailFields);

        const actionGroup = createActionGroup(newRowContainer, sectionElement, headerSelectName);
        newRowContainer.appendChild(actionGroup);

        sectionElement.insertBefore(newRowContainer, insertBeforeElement);
    }

    // --- Gắn sự kiện cho các nút Add ban đầu ---
    const initialAddButtons = document.querySelectorAll('.add-btn');

    initialAddButtons.forEach(button => {
        const initialActionContainer = button.parentNode;
        initialActionContainer.classList.add('initial-add-container');

        button.addEventListener('click', function (e) {
            e.preventDefault();

            const section = findParentSection(button);
            if (!section) return;

            const sectionTitle = section.querySelector('h3').textContent.toLowerCase().trim();
            let selectName = '';

            if (sectionTitle.includes('breeding')) {
                selectName = 'select-breeding';
            } else if (sectionTitle.includes('food')) {
                selectName = 'select-food';
            } else if (sectionTitle.includes('medition')) {
                selectName = 'select-medition';
            }

            if (selectName) {
                addNewImportRow(section, selectName, initialActionContainer);
                initialActionContainer.style.display = 'none';
            }
        });
    });
}

function initInvoicePriceCalculator() {
    const totalInfo = document.querySelector('.total-info');

    // Nếu không có totalInfo, không làm gì
    if (!totalInfo) return;

    // Delegated click listener: hỗ trợ button nằm trong DOM sau khi bind
    document.addEventListener('click', function (e) {
        const target = e.target;
        if (!target) return;

        // nếu bấm nút update-price-btn (cả khi là <button> hoặc element con)
        if (target.classList.contains('update-price-btn') || target.closest('.update-price-btn')) {
            // prevent default nếu cần (nếu nút là trong form)
            e.preventDefault && e.preventDefault();

            // Bắt đầu tính
            let grandTotal = 0;

            // Lấy tất cả section import
            const sections = document.querySelectorAll('.import-section');

            sections.forEach(section => {
                // ---- 1) Dòng gốc (không phải .new-item-entry-wrapper) ----
                // Lấy .import-detail-fields đầu tiên trong section (dòng gốc)
                const firstDetail = section.querySelector('.import-detail-fields');
                if (firstDetail) {
                    const inputs = firstDetail.querySelectorAll('input');
                    if (inputs.length >= 2) {
                        const price = parseNumber(inputs[0].value);
                        const qty = parseNumber(inputs[1].value);
                        // Cộng nếu có số nào hợp lệ (tránh row rỗng)
                        if (price !== 0 || qty !== 0) {
                            grandTotal += price * qty;
                        }
                    }
                }

                // ---- 2) Các dòng thêm (.new-item-entry-wrapper) ----
                const newRows = section.querySelectorAll('.new-item-entry-wrapper');
                newRows.forEach(row => {
                    const detail = row.querySelector('.import-detail-fields');
                    if (!detail) return;
                    const inputs = detail.querySelectorAll('input');
                    if (inputs.length >= 2) {
                        const price = parseNumber(inputs[0].value);
                        const qty = parseNumber(inputs[1].value);
                        if (price !== 0 || qty !== 0) {
                            grandTotal += price * qty;
                        }
                    }
                });
            });

            // ---- 3) Global discount (nếu có) ----
            const globalDiscountEl = document.getElementById('discount-total');
            const globalDiscount = globalDiscountEl ? parseNumber(globalDiscountEl.value) : 0;

            const finalTotal = grandTotal - globalDiscount;

            // Hiển thị: format tiền, nếu âm vẫn hiển thị dấu -
            totalInfo.textContent = `Total: ${formatMoney(finalTotal.toFixed(0))}`;
        }
    });
}

function parseNumber(value) {
    if (value === null || value === undefined) return 0;
    // Loại bỏ mọi ký tự không phải chữ số, dấu - hoặc dấu chấm
    const cleaned = String(value).replace(/[^0-9.\-]+/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}

function formatMoney(value) {
    if (!value) return "0";
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function initPriceAutoFormat() {
    document.addEventListener("input", function (e) {
        if (e.target.name === "price[]") {
            let raw = unformatMoney(e.target.value);
            if (isNaN(raw)) raw = "0";

            e.target.value = formatMoney(raw);
        }
    });
}

function unformatMoney(value) {
    return value.replace(/,/g, "");
}

// function calcItem(inputs) {
//     const price = parseFloat(unformatMoney(inputs[0].value)) || 0;
//     const qty   = parseFloat(unformatMoney(inputs[1].value)) || 0;
//     return price * qty;
// }
