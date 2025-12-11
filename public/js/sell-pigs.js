document.addEventListener("DOMContentLoaded", () => {
    const addBtn = document.querySelector(".add-btn");

    if (addBtn) {
        addBtn.addEventListener("click", openBarnPopup);
    }

    // Nút đóng (icon X)
    const closeBtn = document.querySelector(".barn-close-btn");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeBarnPopup);
    }

    // Click ra ngoài -> đóng popup
    const popup = document.getElementById("barnPopup");
    popup.addEventListener("click", (e) => {
        if (e.target === popup) {
            closeBarnPopup();
        }
    });

    const priceInput = document.getElementById("price");
    priceInput.addEventListener("input", function () {
        let raw = this.value.replace(/\D/g, "");
        this.value = raw ? formatMoney(raw) : "";
        calculateInvoice();
    });

    // --- UPDATE DISCOUNT REALTIME ---
    const discountInput = document.getElementById("discount");
    discountInput.addEventListener("input", function () {
        calculateInvoice();
        calculateTableSummary();
    });

    const updateBtn = document.querySelector(".update-btn");
    if (updateBtn) {
        updateBtn.addEventListener("click", updateInvoice);
    }

    loadCustomers();

    const releaseBtn = document.getElementById("releaseWarehouseBtn");

    releaseBtn.addEventListener("click", () => {
        saveInvoice();
    });
    
});

async function openBarnPopup() {
    const popup = document.getElementById("barnPopup");
    const barnList = document.getElementById("barnList");

    // Hiện popup
    popup.classList.remove("hidden");

    try {
        // Lấy danh sách chuồng thuộc khu Fattening
        const res = await fetch("/sell-pigs/list-barn");
        const barns = await res.json();

        barnList.innerHTML = "";

        barns.forEach(barn => {
            const li = document.createElement("li");
            li.textContent = barn.name;
            li.dataset.id = barn._id;

            li.addEventListener("click", () => selectBarn(barn._id, barn.name));

            barnList.appendChild(li);
        });

    } catch (err) {
        console.error("Error loading barns:", err);
    }
}

function closeBarnPopup() {
    const popup = document.getElementById("barnPopup");
    popup.classList.add("hidden");
}

async function selectBarn(barnId, barnName) {
    document.getElementById("productName").value = barnName;
    document.getElementById("barnPopup").classList.add("hidden");

    const res = await fetch(`/sell-pigs/${barnId}/price-per-pig`);
    const data = await res.json();

    if (data.price) {
        document.getElementById("price").value = formatMoney(data.price);
    }

    if (data.totalPigs) {
        document.getElementById("totalPigs").value = data.totalPigs;
    }

    if (data.herdName) {
        document.getElementById("productName").value = data.herdName;
    }

    window.selectedBarnId = barnId;
    window.selectedHerdId = data.herdId;

    calculateInvoice(); 
}

function calculateInvoice() {
    const priceInput = document.getElementById("price");
    const discountInput = document.getElementById("discount");
    const totalPigs = Number(document.getElementById("totalPigs").value || 0);

    // Lấy giá raw (không format)
    const priceRaw = getRawNumber(priceInput.value);
    const discountRaw = Number(discountInput.value || 0);

    if (!priceRaw || !totalPigs) {
        document.querySelector(".discount-value").textContent = "";
        return;
    }

    // Tính toán
    const subtotal = priceRaw * totalPigs;
    const discountAmount = (subtotal * discountRaw) / 100;
    const finalTotal = subtotal - discountAmount;

    const html = `    
        Total: <b style="color:green">${formatMoney(finalTotal)} đ</b>
    `;

    document.querySelector(".discount-value").innerHTML = html;
}

function formatMoney(num) {
    if (!num) return "";
    return Number(num).toLocaleString("vi-VN");
}

function getRawNumber(value) {
    if (!value) return 0;

    // Loại bỏ toàn bộ ký tự không phải số (kể cả đ, ₫, dấu cách…)
    const cleaned = value.replace(/[^\d]/g, "");

    return Number(cleaned) || 0;
}

const priceInput = document.getElementById("price");

priceInput.addEventListener("input", function () {
    let raw = this.value.replace(/\D/g, "");
    if (!raw) {
        this.value = "";
        return;
    }
    this.value = formatMoney(raw);
});

function getPayloadForSave() {
    return {
        barn: document.getElementById("productName").value,
        price: getRawNumber(document.getElementById("price").value)
    };
}

function updateInvoice() {
    const productName = document.getElementById("productName").value;
    const price = document.getElementById("price").value;
    const discountHTML = document.querySelector(".discount-value").innerHTML;
    const totalPigs = document.getElementById("totalPigs").value;
    const barnId = window.selectedBarnId;
    const herdId = window.selectedHerdId;

    if (!productName || !price || !totalPigs) {
        alert("Bạn cần chọn chuồng và có giá trước khi cập nhật hóa đơn!");
        return;
    }

    // Từ discount-value extract ra final total
    const finalTotal = extractFinalTotalFromHTML(discountHTML);

    // Lấy tbody
    const tbody = document.querySelector("tbody");

    // Ẩn dòng empty message
    const emptyRow = document.querySelector(".empty-row-message");
    if (emptyRow) emptyRow.style.display = "none";

    // Tạo dòng mới
    const tr = document.createElement("tr");

    tr.innerHTML = `
        <td>Herd</td>
        <td data-barn-id="${barnId}" data-herd-id="${herdId}">${productName}</td>
        <td>${totalPigs}</td>
        <td>Pig</td>
        <td>${price} đ</td>
        <td>${formatMoney(finalTotal)} đ</td>
        <td><button class="delete-row-btn">✖</button></td>
    `;

    tbody.appendChild(tr);

    calculateTableSummary();

    // Gán sự kiện xóa dòng
    tr.querySelector(".delete-row-btn").addEventListener("click", function () {
        tr.remove();
        checkEmptyInvoice();
        calculateTableSummary();
    });
}

function extractFinalTotalFromHTML(html) {
    if (!html) return 0;

    const match = html.match(/Total:.*?>(.*?) đ/);

    if (match && match[1]) {
        return getRawNumber(match[1]);
    }

    return 0;
}

function checkEmptyInvoice() {
    const tbody = document.querySelector("tbody");
    const emptyRow = document.querySelector(".empty-row-message");
    const rows = tbody.querySelectorAll("tr:not(.empty-row-message)");

    if (rows.length === 0) {
        emptyRow.style.display = "";
    } else {
        emptyRow.style.display = "none";
    }
}

function calculateTableSummary() {
    const rows = document.querySelectorAll("tbody tr:not(.empty-row-message)");
    let total = 0;

    rows.forEach(row => {
        const totalCell = row.children[5];
        if (totalCell) {
            total += getRawNumber(totalCell.textContent);
        }
    });

    // --- TOTAL ---
    const totalEl = document.querySelector(".total-value");
    if (totalEl) totalEl.textContent = formatMoney(total) + "₫";

    // --- DISCOUNT ---
    const discountRaw = document.getElementById("discount").value || 0;
    const discountEl = document.querySelector(".discount-summary-value");
    if (discountEl) discountEl.textContent = discountRaw + "%";

    // --- FINAL TOTAL ---
    const finalEl = document.querySelector(".final-total .final-value");
    if (finalEl) finalEl.textContent = formatMoney(total) + "₫";
}

async function loadCustomers() {
    const select = document.getElementById("supplier");
    if (!select) return;

    try {
        const res = await fetch("/sell-pigs/customers/list");
        const customers = await res.json();

        customers.forEach(cust => {
            const option = document.createElement("option");
            option.value = cust._id;
            option.textContent = cust.name;
            select.appendChild(option);
        });

    } catch (error) {
        console.error("Failed to load customers:", error);
    }
}

async function saveInvoice() {
    // ---- Lấy thông tin chung ----
    const customer = document.getElementById("supplier").value;
    const invoiceCode = document.getElementById("invoiceCode").value;
    const note = document.getElementById("note").value;

    const totalAmount = getRawNumber(
        document.querySelector(".final-value").textContent
    );

    const paymentDate = document.getElementById("paymentDate").value;
    const paymentStatus = document.getElementById("paymentMethod").value;

    // ---- Lấy các dòng chi tiết invoice ----
    const rows = document.querySelectorAll("tbody tr:not(.empty-row-message)");
    const detailList = [];

    rows.forEach(row => {
        const cols = row.children;

        const detail = {
            warehouse: cols[0].textContent,
            productName: cols[1].textContent,
            herd: cols[1].dataset.herdId,
            barn: cols[1].dataset.barnId,        // barnId → cần cho update pigs theo chuồng
            quantity: Number(cols[2].textContent),
            unit: cols[3].textContent,
            price: getRawNumber(cols[4].textContent),
            totalPrice: getRawNumber(cols[5].textContent),
            discount: Number(document.getElementById("discount").value)
        };

        detailList.push(detail);
    });

    const payload = {
        customer,
        invoiceCode,
        note,
        paymentStatus,
        paymentDate,
        totalAmount,
        details: detailList,
        discount: Number(document.getElementById("discount").value)
    };

    console.log("INVOICE PAYLOAD:", payload);

    try {
        const res = await fetch('/sell-pigs/create-invoice', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success) {
            alert("Invoice saved successfully and pigs released from barn!");
        } else {
            alert("Failed to save invoice.");
        }
    } catch (error) {
        console.error("Save invoice error:", error);
        alert("Error saving invoice.");
    }
}

