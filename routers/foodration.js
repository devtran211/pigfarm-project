var express = require('express');
var router = express.Router();
const FoodRationModel = require('../models/FoodRation');
const RationFoodDetailModel = require('../models/RationFoodDetail');
const RationMeditionDetailModel = require('../models/RationMeditionDetail');

router.get("/", async (req, res) => {
  try {
    // 1. Lấy tất cả FoodRation
    const foodRations = await FoodRationModel.find()
      .populate({
        path: "barn",
        select: "name code total_pigs", // chỉ lấy các trường cần thiết của barn
      })
      .lean(); // lean() để trả về object thuần, dễ xử lý hơn

    // 2. Lấy danh sách chi tiết thức ăn và thuốc tương ứng
    const rationIds = foodRations.map(r => r._id);

    const [foodDetails, medDetails] = await Promise.all([
      RationFoodDetailModel.find({ food_ration: { $in: rationIds } })
        .populate({
          path: "food_warehouse",
          select: "name code stock_unit current_quantity",
        })
        .lean(),
      RationMeditionDetailModel.find({ food_ration: { $in: rationIds } })
        .populate({
          path: "medition_warehouse",
          select: "name code stock_unit current_quantity",
        })
        .lean(),
    ]);

    // 3️⃣ Gom chi tiết vào từng FoodRation
    const response = foodRations.map(r => {
      const foodList = foodDetails.filter(fd => fd.food_ration.toString() === r._id.toString());
      const medList = medDetails.filter(md => md.food_ration.toString() === r._id.toString());
      return {
        ...r,
        food_details: foodList,
        medition_details: medList,
      };
    });

    // 4️⃣ Trả về dữ liệu
    res.status(200).json({
      success: true,
      total: response.length,
      data: response,
    });
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách FoodRation:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách chế độ ăn",
      error: error.message,
    });
  }
});

router.post("/add", async (req, res) => {
  try {
    const payload = req.body;
    const result = await createFoodRationService(payload);
    res.json({ message: "Tạo khẩu phần thành công!", data: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/edit/:id", async (req, res) => {
  try {
    const out = await updateFoodRationService(req.params.id, req.body);
    res.json(out);
  } catch (err) {
    console.error("PUT /food-rations/edit/:id error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Xóa toàn bộ (hoặc theo khu vực)
router.delete("/delete/:id", async (req, res) => {
  try {
    const result = await deleteFoodRationService({ foodRationId: req.params.id });
    res.json({ message: "Đã xóa 1 chế độ ăn", result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/delete/by-area/:areaId", async (req, res) => {
  try {
    await deleteFoodRationService ({ breedingAreaId: req.params.areaId });
    res.json({ message: "Đã xóa toàn bộ chế độ ăn trong khu vực" });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router