document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".more-options").forEach(btn => {
        btn.addEventListener("click", function () {

            // đóng menu khác
            document.querySelectorAll(".options-menu").forEach(m => {
                if (m !== btn.nextElementSibling) {
                    m.classList.remove("active");
                }
            });

            // mở menu hiện tại
            const menu = btn.nextElementSibling;
            menu.classList.toggle("active");
        });
    });

    // click bên ngoài để đóng menu
    document.addEventListener("click", function (e) {
        if (!e.target.closest(".options-wrapper")) {
            document.querySelectorAll(".options-menu").forEach(m => m.classList.remove("active"));
        }
    });

    handleDeleteInvoice();
});

function handleDeleteInvoice() {
    document.addEventListener("click", async function (e) {
        if (!e.target.classList.contains("delete-btn")) return;

        const menu = e.target.closest(".options-menu");
        if (!menu) return;

        const invoiceId = menu.dataset.id;

        if (!confirm("Are you sure you want to delete this invoice?")) return;

        try {
            const res = await fetch(`/sell-pigs/delete/${invoiceId}`, {
                method: "POST"
            });

            const data = await res.json();

            if (data.success) {
                alert("Invoice deleted successfully.");
                location.reload();
            } else {
                alert("Failed to delete invoice.");
            }

        } catch (err) {
            console.error("Delete failed:", err);
            alert("An error occurred while deleting invoice.");
        }
    });
}