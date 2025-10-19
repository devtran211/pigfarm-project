var express = require('express');
var router = express.Router();
const {createFoodRationService, updateFoodRationService, deleteFoodRationService}  = require('../services/foodRationService');

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