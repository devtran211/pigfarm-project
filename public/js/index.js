document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch("/home/revenue-by-month");
        const { labels, data } = await res.json();

        const ctx = document.getElementById("chartRevenueByMonth");
        if (!ctx) return;

        new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Total revenue (VNĐ)",
                    data,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: v => v.toLocaleString("vi-VN")
                        }
                    }
                }
            }
        });
    } catch (err) {
        console.error("Lỗi tải biểu đồ:", err);
    }

    getMedCostChart();
    getFoodCostChart();
    getLossRatePieChart();
    getDiseasePieChart();
});

async function getMedCostChart(canvasId = "chartMedCostByMonth") {
    try {
        const res = await fetch("/home/medition-cost-by-month");
        const { labels, data } = await res.json();

        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.warn(`Không tìm thấy canvas #${canvasId}`);
            return;
        }

        // Nếu đã có chart cũ → destroy để tránh lỗi overlay
        if (ctx._chartInstance) {
            ctx._chartInstance.destroy();
        }

        const chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Chi phí thuốc (VNĐ)",
                    data,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: v => v.toLocaleString("vi-VN")
                        }
                    }
                }
            }
        });

        // Lưu instance để có thể destroy khi cần
        ctx._chartInstance = chart;

        return chart;

    } catch (err) {
        console.error("Lỗi tải biểu đồ chi phí thuốc:", err);
    }
}

// Hàm riêng để vẽ biểu đồ chi phí thức ăn theo tháng
async function getFoodCostChart(canvasId = "chartFoodCostByMonth") {
    try {
        const res = await fetch("/home/food-cost-by-month");
        const { labels, data } = await res.json();

        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.warn(`Không tìm thấy canvas #${canvasId}`);
            return;
        }

        // Xóa biểu đồ cũ nếu có
        if (ctx._chartInstance) {
            ctx._chartInstance.destroy();
        }

        const chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Chi phí thức ăn (VNĐ)",
                    data,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: v => v.toLocaleString("vi-VN")
                        }
                    }
                }
            }
        });

        ctx._chartInstance = chart;
        return chart;

    } catch (err) {
        console.error("Lỗi tải biểu đồ thức ăn:", err);
    }
}

async function getLossRatePieChart(canvasId = "chartLossRate") {
    try {
        const res = await fetch("/home/loss-rate");
        const { labels, data } = await res.json();

        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.warn(`Không tìm thấy canvas #${canvasId}`);
            return;
        }

        // Clear old chart
        if (ctx._chartInstance) {
            ctx._chartInstance.destroy();
        }

        const chart = new Chart(ctx, {
            type: "pie",
            data: {
                labels,
                datasets: [
                    {
                        data,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: "bottom"
                    }
                }
            }
        });

        ctx._chartInstance = chart;
        return chart;

    } catch (err) {
        console.error("Lỗi tải biểu đồ loss rate:", err);
    }
}

async function getDiseasePieChart(canvasId = "chartDiseasePie") {
    try {
        const res = await fetch("/home/disease-compare");
        const { labels, data } = await res.json();

        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.warn(`Không tìm thấy canvas #${canvasId}`);
            return;
        }

        // Xóa chart cũ nếu có
        if (ctx._chartInstance) {
            ctx._chartInstance.destroy();
        }

        const chart = new Chart(ctx, {
            type: "pie",
            data: {
                labels,
                datasets: [
                    {
                        data,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: "bottom"
                    }
                }
            }
        });

        ctx._chartInstance = chart;
        return chart;

    } catch (err) {
        console.error("Lỗi tải biểu đồ bệnh:", err);
    }
}

