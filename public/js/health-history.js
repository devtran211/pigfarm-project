console.log("CHECK JS LOADED");

document.addEventListener("DOMContentLoaded", () => {
    initHealthHistoryEdit();
    initHealthHistoryDelete();
});

function initHealthHistoryEdit() {

    console.log('log');

    const modal = document.getElementById('editHealthHistoryModal');
    const form = document.getElementById('editHealthHistoryForm');

    // -----------------------------
    // 1. GẮN SỰ KIỆN CHO NÚT UPDATE
    // -----------------------------
    document.querySelectorAll('.action-button.update').forEach(btn => {
        btn.addEventListener('click', async function (e) {
            e.stopPropagation(); // tránh click row

            const id = this.dataset.id;

            // Fetch dữ liệu health history
            const res = await fetch(`/health-history/update/${id}`);
            const data = await res.json();

            // Đổ data vào form
            form.dateOfDiscovery.value = data.dateOfDiscovery?.split("T")[0] || "";
            form.dateOfRecovery.value = data.dateOfRecovery?.split("T")[0] || "";
            form.result.value = data.result || "";
            form.symptom.value = data.symptom || "";
            form.movementStatus.value = data.movementStatus || "";
            form.eatingBehavior.value = data.eatingBehavior || "";
            form.waterIntake.value = data.waterIntake || "";
            form.feverStatus.value = data.feverStatus || "";
            form.humidity.value = data.humidity || "";
            form.vaccinationHistory.value = data.vaccinationHistory || "";
            form.note.value = data.note || "";

            // Lưu lại ID để Update
            form.dataset.id = id;

            // Hiện popup
            modal.style.display = 'flex';
        });
    });

    // -----------------------------
    // 2. SUBMIT FORM (PUT UPDATE)
    // -----------------------------
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const id = form.dataset.id;

        const formData = new FormData(form);
        const jsonData = Object.fromEntries(formData.entries());

        const res = await fetch(`/health-history/update/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonData)
        });

        const data = await res.json();

        if (data.message === "Updated successfully") {
            alert("Record updated successfully!");
            location.reload();
        } else {
            alert("Failed to update record!");
        }
    });

    // -----------------------------
    // 3. NÚT ĐÓNG POPUP
    // -----------------------------
    modal.querySelector('.close-btn').addEventListener('click', function () {
        modal.style.display = 'none';
    });

    // Click ngoài để đóng modal
    modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.style.display = 'none';
    });
}

function initHealthHistoryDelete() {
    document.querySelectorAll('.action-button.delete').forEach(btn => {
        btn.addEventListener('click', async function (e) {
            e.stopPropagation(); // tránh click vào row

            const id = this.dataset.id;

            // Hiện alert xác nhận
            const confirmDelete = confirm("Are you sure you want to delete this record?");
            if (!confirmDelete) return;

            // Gửi request DELETE
            const res = await fetch(`/health-history/${id}`, {
                method: "DELETE"
            });

            const data = await res.json();

            if (data.message === "Deleted successfully") {
                alert("Record deleted successfully!");
                location.reload();
            } else {
                alert("Failed to delete record!");
            }
        });
    });
}

document.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', function(){
        const pigId = this.dataset.pigId;
        window.location.href = `/health-history/${pigId}/`;
    });
});

