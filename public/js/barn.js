document.addEventListener("DOMContentLoaded", () => {
    initCreateBarnModal();
    initCreateBarnHandler();
    initEditBarnModal();
    initEditBarnHandler();
    initDeleteBarnHandler();
    initActionMenu();
    initBarnRowClick();
    initBarnNameSearch();
    initBarnPigCountSearch();
    initBarnStatusSearch();
});

function initCreateBarnModal() {
    const openBtn = document.querySelector(".btn-create-barn");
    const modal = document.getElementById("createBarnModal");
    const closeBtn = modal.querySelector(".close-btn");

    function openModal() {
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
        modal.querySelector("form").reset();
    }

    openBtn.addEventListener("click", async() => {
        const ok = await checkBarnLimit();
        if (!ok) return;
        openModal();
    });
    closeBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", e => {
        if (e.target === modal) closeModal();
    });
}

function initCreateBarnHandler() {
    const modal = document.getElementById("createBarnModal");
    const saveBtn = modal.querySelector(".save-btn");

    const areaId = document.getElementById("currentArea").dataset.id;

    const nameInput = modal.querySelector('input[name="name"]');
    const acreageInput = modal.querySelector('input[name="acreage"]');
    const maxCapInput = modal.querySelector('input[name="maximumCapacity"]');
    const statusSelect = modal.querySelector('select[name="status"]');
    const creationDateInput = modal.querySelector('input[name="creationDate"]');
    const noteInput = modal.querySelector('textarea[name="note"]');

    saveBtn.addEventListener("click", async () => {
        const payload = {
            name: nameInput.value,
            acreage: acreageInput.value,
            maximumCapacity: maxCapInput.value,
            status: statusSelect.value,
            creationDate: creationDateInput.value,
            note: noteInput.value
        };

        try {
            const res = await fetch(`/barn/create/${areaId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            // if (result.success) {
            //     location.reload();  // reload lại trang danh sách chuồng
            // } else {
            //     alert("Error creating barn");
            // }

            if (!result.success) {
                alert(result.message);
                return;
            }

            location.reload();

        } catch (err) {
            console.error(err);
            alert("Cannot send request to server");
        }
    });
}

function initEditBarnModal() {
    const editButtons = document.querySelectorAll(".btn-edit");
    const modal = document.getElementById("editBarnModal");
    const closeBtn = modal.querySelector(".close-btn");

    const nameInput = modal.querySelector('input[name="name"]');
    const acreageInput = modal.querySelector('input[name="acreage"]');
    const maxCapInput = modal.querySelector('input[name="maximumCapacity"]');
    const statusSelect = modal.querySelector('select[name="status"]');
    const creationInput = modal.querySelector('input[name="creationDate"]');
    const noteInput = modal.querySelector('textarea[name="note"]');

    let currentBarnId = null;

    editButtons.forEach(btn => {
        btn.addEventListener("click", async () => {
            currentBarnId = btn.dataset.id;

            // Gọi API để load dữ liệu
            const res = await fetch(`/barn/detail/${currentBarnId}`);
            const data = await res.json();

            // Gán dữ liệu vào input
            nameInput.value = data.name || "";
            acreageInput.value = data.acreage || "";
            maxCapInput.value = data.maximumCapacity || "";
            statusSelect.value = data.status || "";

            if (data.creationDate) {
                creationInput.value = new Date(data.creationDate).toISOString().split("T")[0];
            }

            noteInput.value = data.note || "";

            // Mở popup
            modal.style.display = "flex";
            document.body.style.overflow = "hidden";
        });
    });

    // Đóng popup
    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
    });

    modal.addEventListener("click", e => {
        if (e.target === modal) {
            modal.style.display = "none";
            document.body.style.overflow = "auto";
        }
    });
}

function initEditBarnHandler() {
    const modal = document.getElementById("editBarnModal");
    const saveBtn = modal.querySelector(".save-btn");

    const nameInput = modal.querySelector('input[name="name"]');
    const acreageInput = modal.querySelector('input[name="acreage"]');
    const maxCapInput = modal.querySelector('input[name="maximumCapacity"]');
    const statusSelect = modal.querySelector('select[name="status"]');
    const creationInput = modal.querySelector('input[name="creationDate"]');
    const noteInput = modal.querySelector('textarea[name="note"]');

    let currentBarnId = null;

    // Lấy ID khi mở popup
    document.querySelectorAll(".btn-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            currentBarnId = btn.dataset.id;
        });
    });

    saveBtn.addEventListener("click", async () => {
        const payload = {
            name: nameInput.value,
            acreage: acreageInput.value,
            maximumCapacity: maxCapInput.value,
            status: statusSelect.value,
            creationDate: creationInput.value,
            note: noteInput.value
        };

        try {
            const res = await fetch(`/barn/update/${currentBarnId}`, {
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

        } catch (err) {
            console.error(err);
            alert("Cannot send request to server");
        }
    });
}

function initDeleteBarnHandler() {
    const deleteButtons = document.querySelectorAll('.btn-delete');

    deleteButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const barnId = btn.dataset.id;

            const isConfirm = confirm("Are you sure you want to delete this barn?");
            if (!isConfirm) return;

            try {
                const res = await fetch(`/barn/delete/${barnId}`, {
                    method: "DELETE"
                });

                const result = await res.json();

                if (result.success) {
                    location.reload();
                } else {
                    alert("Delete failed");
                }

            } catch (error) {
                console.error(error);
                alert("Cannot send request to server");
            }
        });
    });
}

async function checkBarnLimit() {
    const areaId = document.getElementById("currentArea").dataset.id;
    const res = await fetch(`/area/detail/${areaId}`); // route get area info
    const area = await res.json();

    const barnCountRes = await fetch(`/barn/count/${areaId}`);
    const barnCount = await barnCountRes.json();

    if (barnCount >= area.numberOfBarns) {
        alert("This area has reached the maximum number of barns.");
        return false;
    }

    return true;
}

function initActionMenu() {
    const rows = document.querySelectorAll(".action-wrapper");

    rows.forEach(row => {
        const moreBtn = row.querySelector(".action-more");
        const menu = row.querySelector(".action-menu");

        // Toggle menu khi bấm 3 chấm
        moreBtn.addEventListener("click", (e) => {
            e.stopPropagation(); // Ngăn click lan ra ngoài
            const isOpen = menu.style.display === "block";

            // Đóng tất cả menu khác
            document.querySelectorAll(".action-menu").forEach(m => {
                m.style.display = "none";
            });

            // Chỉ mở menu của dòng hiện tại
            menu.style.display = isOpen ? "none" : "block";
        });
    });

    // Bấm ra ngoài → đóng toàn bộ menu
    document.addEventListener("click", () => {
        document.querySelectorAll(".action-menu").forEach(m => {
            m.style.display = "none";
        });
    });
}

function initBarnRowClick() {
    const rows = document.querySelectorAll(".barn-row");

    rows.forEach(row => {
        row.addEventListener("click", (e) => {
            // Nếu click vào action menu → không chuyển trang
            if (e.target.closest(".action-wrapper")) return;

            const barnId = row.dataset.id;
            if (barnId) {
                window.location.href = `/barn/info/${barnId}`;
            }
        });
    });
}

function initBarnNameSearch() {
    const searchInput = document.getElementById("searchBarnByName");

    if (!searchInput) {
        console.warn("Không tìm thấy input #searchBarnByName");
        return;
    }

    searchInput.addEventListener("input", function () {
        const keyword = this.value.trim().toLowerCase();

        const rows = document.querySelectorAll(".custom-table tbody .barn-row");

        rows.forEach(row => {
            const barnName = row.querySelector("td:nth-child(1)").textContent.trim().toLowerCase();

            // Nếu không nhập gì -> hiển thị tất cả
            if (keyword === "") {
                row.style.display = "";
                return;
            }

            // Lọc theo tên
            if (barnName.includes(keyword)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    });
}

function initBarnPigCountSearch() {
    const searchInput = document.getElementById("searchBarnByPigCount");

    if (!searchInput) {
        console.warn("Không tìm thấy input #searchBarnByPigCount");
        return;
    }

    searchInput.addEventListener("input", function () {
        const keyword = this.value.trim();

        const rows = document.querySelectorAll(".custom-table tbody .barn-row");

        rows.forEach(row => {
            const pigCount = row.querySelector("td:nth-child(3)").textContent.trim();

            // Nếu input rỗng -> Hiện tất cả
            if (keyword === "") {
                row.style.display = "";
                return;
            }

            // Lọc theo số lượng lợn
            if (pigCount.includes(keyword)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    });
}

function initBarnStatusSearch() {
    const select = document.getElementById("searchBarnByStatus");

    if (!select) {
        console.warn("Không tìm thấy select #searchBarnByStatus");
        return;
    }

    select.addEventListener("change", function () {
        const keyword = this.value.trim().toLowerCase();

        const rows = document.querySelectorAll(".custom-table tbody .barn-row");

        rows.forEach(row => {
            const statusText = row.querySelector("td:nth-child(5)").textContent.trim().toLowerCase();

            // Nếu không chọn gì -> hiển thị tất cả
            if (keyword === "") {
                row.style.display = "";
                return;
            }

            // Nếu giống → hiện, không giống → ẩn
            if (statusText === keyword) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    });
}
