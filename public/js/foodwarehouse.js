document.addEventListener("DOMContentLoaded", () => {

    const openModalBtn = document.getElementById("openCreateModal");
    const modal = document.getElementById("createItemModal");
    const closeBtn = modal.querySelector(".close-btn");
    const form = modal.querySelector("form");

    // Show create popup
    openModalBtn.addEventListener("click", () => {
        openCreateItemModal();
    });

    // Close create popup
    closeBtn.addEventListener("click", () => {
        closeCreateItemModal();
    });

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeCreateItemModal();
        }
    });

    // Submit create form
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        submitCreateItemForm();
    });

    document.querySelectorAll(".btn-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            openEditItemModal(id);
        });
    });

    document.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            confirmDeleteItem(id);
        });
    });

    const inputName = document.getElementById("search-name");
    const inputPrice = document.getElementById("search-price");
    const inputInventory = document.getElementById("search-inventory");

    function handleFilter() {
        filterProducts(inputName, inputPrice, inputInventory, ".custom-table");
    }

    inputName.addEventListener("input", handleFilter);
    inputPrice.addEventListener("input", handleFilter);
    inputInventory.addEventListener("input", handleFilter);

    submitEvent();
    closePopupEvent();

});

// display popup
function openCreateItemModal() {
    const modal = document.getElementById("createItemModal");
    modal.style.display = "flex";
}

// close popup
function closeCreateItemModal() {
    const modal = document.getElementById("createItemModal");
    modal.style.display = "none";
}

// create new item
function submitCreateItemForm() {
    const modal = document.getElementById("createItemModal");
    const form = modal.querySelector("form");

    const name = form.querySelector("input[name='name']").value.trim();
    const weight = form.querySelector("input[name='weight']").value.trim();
    const unit = form.querySelector("select[name='unit']").value.trim();
    const energy = form.querySelector("input[name='energy_content']").value.trim();
    const dom = form.querySelector("input[name='date_of_manufacture']").value.trim();
    const expiry = form.querySelector("input[name='expiry']").value.trim();

    // Validate
    if (!name || !weight || !unit || !energy || !dom || !expiry) {
        alert("Vui lòng nhập đầy đủ các trường bắt buộc!");
        return;
    }

    // Submit
    form.submit();
}

function openEditItemModal(id) {
    const modal = document.getElementById("editItemModal");
    const form = modal.querySelector("form");

    // Clear old data
    form.reset();

    // Set form action to update route
    form.action = `/food-warehouse/update/${id}`;

    // Hiện popup
    modal.style.display = "flex";

    // Gọi API lấy dữ liệu
    fetch(`/food-warehouse/detail/${id}`)
        .then(res => res.json())
        .then(data => {
            fillEditForm(data);
        })
        .catch(err => {
            console.error("Load item failed:", err);
            alert("Không thể tải dữ liệu!");
        });
}

function closeEditItemModal() {
    const modal = document.getElementById("editItemModal");
    modal.style.display = "none";
}

function fillEditForm(data) {
    const modal = document.getElementById("editItemModal");
    const form = modal.querySelector("form");

    form.querySelector("input[name='name']").value = data.name || "";
    form.querySelector("input[name='inventory']").value = data.inventory || "";
    form.querySelector("input[name='weight']").value = data.weight || "";
    form.querySelector("select[name='unit']").value = data.unit || "";
    form.querySelector("input[name='protein_content']").value = data.protein_content || "";
    form.querySelector("input[name='energy_content']").value = data.energy_content || "";
    form.querySelector("input[name='date_of_manufacture']").value = formatDateInput(data.date_of_manufacture);
    form.querySelector("input[name='expiry']").value = formatDateInput(data.expiry);
    form.querySelector("textarea[name='note']").value = data.note || "";
}

function submitEditItemForm() {
    const modal = document.getElementById("editItemModal");
    const form = modal.querySelector("form");

    const requiredFields = [
        "name",
        "inventory",
        "weight",
        "unit",
        "energy_content",
        "date_of_manufacture",
        "expiry"
    ];

    for (let field of requiredFields) {
        const element = form.querySelector(`[name='${field}']`);
        if (!element) {
            console.error(`Không tìm thấy input name='${field}' trong popup edit`);
            return;
        }
        if (!element.value.trim()) {
            alert("Vui lòng nhập đầy đủ các trường bắt buộc!");
            return;
        }
    }

    form.submit();
}

function formatDateInput(dateValue) {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    return date.toISOString().split("T")[0];
}

function submitEvent(){
    const modal = document.getElementById("editItemModal");
    const form = modal.querySelector("form");

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        submitEditItemForm();
    });
}

function closePopupEvent(){
    const modal = document.getElementById("editItemModal");
    const closeBtn = modal.querySelector(".close-btn");

    closeBtn.addEventListener("click", () => {
        closeEditItemModal();
    });

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeEditItemModal();
        }
    });

}

function confirmDeleteItem(id) {
    const isConfirmed = confirm("Bạn có chắc chắn muốn xóa mặt hàng này không?");

    if (!isConfirmed) return;

    deleteItem(id);
}

function deleteItem(id) {
    fetch(`/food-warehouse/delete/${id}`)
        .then(res => res.json())
        .then(msg => {
            console.log(msg);
            // Reload lại trang sau khi xóa
            window.location.reload();
        })
        .catch(err => {
            console.error("Delete failed:", err);
            alert("Không thể xóa mặt hàng!");
        });
}

function filterProducts(inputName, inputPrice, inputInventory, tableSelector) {
    const rows = document.querySelectorAll(`${tableSelector} tbody tr`);

    const nameVal = inputName.value.toLowerCase().trim();
    const priceVal = inputPrice.value.trim();
    const inventoryVal = inputInventory.value.trim();

    rows.forEach(row => {
        const productName = row.querySelector("td strong")?.textContent.toLowerCase() || "";
        const productPrice = row.querySelectorAll("td")[1]?.textContent.replace(/[^0-9]/g, "") || "";
        const productInventory = row.querySelectorAll("td")[2]?.textContent.trim() || "";

        let isMatch = true;

        if (nameVal && !productName.includes(nameVal)) isMatch = false;
        if (priceVal && !productPrice.includes(priceVal)) isMatch = false;
        if (inventoryVal && !productInventory.includes(inventoryVal)) isMatch = false;

        row.style.display = isMatch ? "" : "none";
    });
}
