document.addEventListener('DOMContentLoaded', () => {
    initCreateAreaModal();
    initCreateAreaHandler();
    initEditAreaHandler();
    initDeleteAreaHandler();
    initAreaRowClick();
    initAreaActionMenu();
    initAreaNameSearch();
    initAreaBarnCountSearch();
    initAreaTypeSearch();
    initAreaStatusSearch();
    initAreaDateSearch();
});

function initCreateAreaModal() {
    const modal = document.getElementById('createAreaModal');
    const openBtn = document.querySelector('.btn-create-area'); // nút mở popup
    const closeBtn = modal.querySelector('.close-btn');
    
    if (!modal) return;

    // Hàm mở popup
    function openModal() {
        modal.style.display = 'flex';       // hiện popup
        document.body.style.overflow = 'hidden'; // khóa scroll background
    }

    // Hàm đóng popup
    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';   // bật scroll lại
        resetForm(); // reset dữ liệu khi đóng popup
    }

    // Reset form khi đóng popup
    function resetForm() {
        const form = modal.querySelector('form');
        if (form) form.reset();
    }

    // Sự kiện mở popup
    if (openBtn) {
        openBtn.addEventListener('click', openModal);
    }

    // Sự kiện đóng popup bằng nút X
    closeBtn.addEventListener('click', closeModal);

    // Đóng popup khi click ra ngoài vùng nội dung
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

function initCreateAreaHandler() {
    const saveBtn = document.querySelector('.save-btn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
        const data = {
            name: document.querySelector('input[name="name"]').value,
            acreage: document.querySelector('input[name="acreage"]').value,
            numberOfBarns: document.querySelector('input[name="numberOfBarns"]').value,
            type: document.querySelector('select[name="type"]').value,
            status: document.querySelector('select[name="status"]').value,
            creationDate: document.querySelector('input[name="creationDate"]').value,
            note: document.querySelector('textarea[name="note"]').value
        };

        try {
            const res = await fetch('/area/create', {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            location.reload();   // Hoặc chuyển trang nếu bạn muốn
        } else {
            alert("Error creating area");
        }
        } catch (error) {
            console.error(error);
            alert("Cannot send request to server");
        }
    });
}

function initEditAreaHandler() {
    const editButtons = document.querySelectorAll('.btn-edit');
    const modal = document.getElementById('editAreaModal');
    const closeBtn = modal.querySelector('.close-btn');

    const nameInput = modal.querySelector('input[name="name"]');
    const acreageInput = modal.querySelector('input[name="acreage"]');
    const numberInput = modal.querySelector('input[name="numberOfBarns"]');
    const typeSelect = modal.querySelector('select[name="type"]');
    const statusSelect = modal.querySelector('select[name="status"]');
    const creationInput = modal.querySelector('input[name="creationDate"]');
    const noteInput = modal.querySelector('textarea[name="note"]');

    let currentAreaId = null;

    // Mở popup khi bấm nút Sửa
    editButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            currentAreaId = btn.dataset.id;

            // Gọi API lấy data
            const res = await fetch(`/area/detail/${currentAreaId}`);
            const data = await res.json();

            // Đổ dữ liệu vào form
            nameInput.value = data.name || "";
            acreageInput.value = data.acreage || "";
            numberInput.value = data.numberOfBarns || "";
            typeSelect.value = data.type || "";
            statusSelect.value = data.status || "";

            // format ngày YYYY-MM-DD
            if (data.creationDate) {
                creationInput.value = new Date(data.creationDate)
                    .toISOString()
                    .split("T")[0];
            }

            noteInput.value = data.note || "";

            modal.style.display = 'flex';
            document.body.style.overflow = "hidden";
        });
    });

    // Đóng popup
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        document.body.style.overflow = "auto";
    });

    modal.addEventListener('click', e => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = "auto";
        }
    });

    // Xử lý lưu dữ liệu
    const saveBtn = modal.querySelector('.save-btn');

    saveBtn.addEventListener('click', async () => {
        const payload = {
            name: nameInput.value,
            acreage: acreageInput.value,
            numberOfBarns: numberInput.value,
            type: typeSelect.value,
            status: statusSelect.value,
            creationDate: creationInput.value,
            note: noteInput.value
        };

        const res = await fetch(`/area/edit/${currentAreaId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (result.success) {
            location.reload();
        } else {
            alert("Update failed!");
        }
    });
}

function initDeleteAreaHandler() {
    const deleteButtons = document.querySelectorAll('.btn-delete');

    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;

            // Confirm xóa
            const isConfirmed = confirm("Are you sure you want to delete this area?");
            if (!isConfirmed) return;

            try {
                const res = await fetch(`/area/delete/${id}`, {
                    method: "DELETE"
                });

                const result = await res.json();

                if (result.success) {
                    // Reload lại trang
                    location.reload();
                } else {
                    alert("Delete failed!");
                }

            } catch (err) {
                console.error(err);
                alert("Cannot send request to server");
            }
        });
    });
}

function initAreaRowClick() {
    const rows = document.querySelectorAll(".area-row");

    rows.forEach(row => {
        row.addEventListener("click", (e) => {
            // Nếu click vào nút Edit/Delete thì KHÔNG chuyển trang
            if (e.target.closest(".action-cell")) return;

            const id = row.dataset.id;
            if (id) {
                window.location.href = `/area/barns/${id}`;
            }
        });
    });
}

function initAreaActionMenu() {
    const moreButtons = document.querySelectorAll(".action-more");

    moreButtons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation(); // Ngăn không click vào row
            const actionMenu = btn.parentElement.querySelector(".action-menu");

            // Ẩn tất cả menu khác trước khi hiện menu này
            document.querySelectorAll(".action-menu").forEach(menu => {
                if (menu !== actionMenu) menu.style.display = "none";
            });

            // Toggle on/off
            actionMenu.style.display =
                actionMenu.style.display === "block" ? "none" : "block";
        });
    });

    // Click ra ngoài → tắt tất cả menu
    document.addEventListener("click", () => {
        document.querySelectorAll(".action-menu").forEach(menu => {
            menu.style.display = "none";
        });
    });
}

function initAreaNameSearch() {
    const searchInput = document.getElementById("searchAreaByName");

    if (!searchInput) {
        console.warn("Search input #searchAreaByName not found!");
        return;
    }

    searchInput.addEventListener("input", function () {
        const keyword = this.value.trim().toLowerCase();

        // Lấy tất cả các dòng trong bảng
        const tableRows = document.querySelectorAll(".area-table tbody tr");

        tableRows.forEach(row => {
            const areaName = row.querySelector("td:first-child").textContent.toLowerCase();

            // Kiểm tra trùng khớp
            if (areaName.includes(keyword)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    });
}

function initAreaBarnCountSearch() {
    const searchInput = document.getElementById("searchAreaByBarnCount");

    if (!searchInput) {
        console.warn("Search input #searchAreaByBarnCount not found");
        return;
    }

    searchInput.addEventListener("input", function () {
        const keyword = this.value.trim();

        const rows = document.querySelectorAll(".area-table tbody tr");

        rows.forEach(row => {
            // Lấy nội dung cột "Number of barns"
            const barnText = row.querySelector("td:nth-child(2)").textContent.trim();

            // Tách phần số trước (VD: "5 (3 barns in use)" → lấy "5")
            const barnCount = barnText.split(" ")[0];

            // Nếu input rỗng → hiện tất cả
            if (keyword === "") {
                row.style.display = "";
                return;
            }

            // Kiểm tra khớp số
            if (barnCount.includes(keyword)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    });
}

function initAreaTypeSearch() {
    const selectType = document.getElementById("searchAreaByType");

    if (!selectType) {
        console.warn("Search select #searchAreaByType not found");
        return;
    }

    selectType.addEventListener("change", function () {
        const selected = this.value.trim().toLowerCase();

        const rows = document.querySelectorAll(".area-table tbody tr");

        rows.forEach(row => {
            const typeText = row.querySelector("td:nth-child(4)").textContent.trim().toLowerCase();

            // Nếu chọn trống → hiển thị tất cả
            if (selected === "") {
                row.style.display = "";
                return;
            }

            // So khớp đúng loại
            if (typeText === selected) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    });
}

function initAreaStatusSearch() {
    const selectStatus = document.getElementById("searchAreaByStatus");

    if (!selectStatus) {
        console.warn("Search select #searchAreaByStatus not found");
        return;
    }

    selectStatus.addEventListener("change", function () {
        const selected = this.value.trim().toLowerCase();

        const rows = document.querySelectorAll(".area-table tbody tr");

        rows.forEach(row => {
            const statusText = row.querySelector("td:nth-child(5)").textContent.trim().toLowerCase();

            // Nếu chọn trống → hiển thị tất cả
            if (selected === "") {
                row.style.display = "";
                return;
            }

            // Nếu status trong row = status đã chọn → hiện
            if (statusText === selected) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    });
}

function initAreaDateSearch() {
    const dateInput = document.getElementById("searchAreaByDate");

    if (!dateInput) {
        console.warn("Search input #searchAreaByDate not found");
        return;
    }

    dateInput.addEventListener("input", function () {
        const selectedDate = this.value.trim(); // yyyy-mm-dd
        const rows = document.querySelectorAll(".area-table tbody tr");

        rows.forEach(row => {
            const dateCell = row.querySelector("td:nth-child(6)");
            const cellDateText = dateCell.textContent.trim(); // dd/mm/yyyy

            // Chuyển dd/mm/yyyy → yyyy-mm-dd
            const cellISODate = convertToISODate(cellDateText);

            // Nếu không chọn ngày → hiện tất cả
            if (selectedDate === "") {
                row.style.display = "";
                return;
            }

            // So sánh trực tiếp dạng yyyy-mm-dd
            if (cellISODate === selectedDate) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    });
}

function convertToISODate(dateStr) {
    const parts = dateStr.split("/");
    if (parts.length !== 3) return "";

    const day = parts[0];
    const month = parts[1];
    const year = parts[2];

    return `${year}-${month.padStart(2,"0")}-${day.padStart(2,"0")}`;
}
