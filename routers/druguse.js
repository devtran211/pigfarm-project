var express = require('express');
var router = express.Router();
var BarnModel = require('../models/Barn');
var DrugUseModel = require('../models/DrugUse');
const MeditionWareHouseModel = require('../models/MeditionWareHouse');
const { createDrugUse, editDrugUse, deleteDrugUse } = require('../services/drugUseService');

router.post("/add", async (req, res) => {
  try {
    const drugUse = await createDrugUse(req.body);
    res.status(201).json({
      message: "Thiết lập sử dụng thuốc thành công!",
      data: drugUse
    });
  } catch (error) {
    console.error("Error creating drug use:", error);
    res.status(400).json({
      message: "Thiết lập sử dụng thuốc thất bại!",
      error: error.message
    });
  }
});

router.put("/edit/:id", async (req, res) => {
  try {
    const drugUseId = req.params.id;
    const payload = req.body; // đảm bảo body-parser / express.json() đang bật

    const result = await editDrugUse(drugUseId, payload);

    return res.status(200).json({
      success: true,
      message: "Cập nhật thiết lập thuốc thành công",
      data: result
    });
  } catch (error) {
    console.error("Error in editDrugUseController:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Lỗi không xác định"
    });
  }
});

// Xóa 1 dòng cụ thể
router.delete("/delete/:id", async (req, res) => {
  try{
    await deleteDrugUse({ drugUseId: req.params.id });
    res.json({ message: "Đã xóa 1 drug use" });
  }catch(error){
    res.status(500).json({ error: error.message });
  }
});

// Xóa theo khu vực
router.delete("/delete/by-area/:areaId", async (req, res) => {
  try{
      await deleteDrugUse({ areaId: req.params.areaId });
      res.json({ message: "Đã xóa toàn bộ drug use trong khu vực" });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

module.exports = router;