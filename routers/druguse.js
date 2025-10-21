var express = require('express');
var router = express.Router();
const BarnModel = require('../models/Barn');
const BreedingAreaModel = require('../models/BreedingArea');
const DrugUseModel = require('../models/DrugUse');
const DrugUseDetailModel = require('../models/DrugUseDetail');
const { createDrugUse, editDrugUse, deleteDrugUse } = require('../services/drugUseService');

router.get("/", async (req, res) => {
  try {
    // Lấy tất cả khu nuôi
    const areas = await BreedingAreaModel.find().lean();
    console.log(areas);

    const result = [];

    for (const area of areas) {
      // Lấy tất cả chuồng thuộc khu
      const barns = await BarnModel.find({ breedingarea: area._id }).lean();

      console.log(barns);

      // Tổng hợp cho toàn khu
      const areaDrugSummary = new Map();

      const barnData = [];

      for (const barn of barns) {
        // Lấy tất cả chế độ sử dụng thuốc của chuồng này
        const drugUses = await DrugUseModel.find({ barn: barn._id }).lean();

        // Gom tất cả detail của những drug_use này
        const drugUseIds = drugUses.map(d => d._id);
        const drugDetails = await DrugUseDetailModel.find({ drug_use: { $in: drugUseIds } })
          .populate("medition_warehouse")
          .lean();

        // Gom theo cữ (time)
        const timeMap = new Map();

        for (const detail of drugDetails) {
          const time = detail.time || "Không rõ cữ";
          const med = detail.medition_warehouse;

          if (!med) continue;

          const drugItem = {
            name: med.name,
            quantity: `${detail.dosage}${detail.dosage_unit || ""}`
          };

          if (!timeMap.has(time)) {
            timeMap.set(time, [drugItem]);
          } else {
            timeMap.get(time).push(drugItem);
          }

          // Tổng hợp thuốc toàn khu
          const key = med.name;
          const existing = areaDrugSummary.get(key) || 0;
          areaDrugSummary.set(key, existing + detail.dosage);
        }

        // Convert Map -> array
        const times = Array.from(timeMap.entries()).map(([time, drugs]) => ({
          time,
          drugs
        }));

        barnData.push({
          barnName: barn.name,
          times
        });
      }

      // Format tổng hợp khu
      const summary = {};
      for (const [drugName, totalDosage] of areaDrugSummary.entries()) {
        summary[drugName] = `${totalDosage} ml`;
      }

      result.push({
        areaName: area.name,
        summary,
        barns: barnData
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi khi lấy dữ liệu sử dụng thuốc", error: error.message });
  }
});

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