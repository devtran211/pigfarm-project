var express = require('express');
var router = express.Router();
const BarnModel = require('../models/Barn');
const AreaModel = require('../models/Area');
const DrugUseModel = require('../models/DrugUse');
const DrugUseDetailModel = require('../models/DrugUseDetail');
const { createDrugUse, editDrugUse, deleteDrugUse } = require('../services/drugUseService');

router.get("/", async (req, res) => {
    try {
        const selectedAreaId = req.query.area || "";

        // 1. Lấy tất cả khu
        const areas = await AreaModel.find().lean();

        // 2. Query barn & drug use theo từng area → y hệt food ration
        const areaData = [];

        for (const area of areas) {
            // Nếu có filter → chỉ lấy area được chọn
            if (selectedAreaId && selectedAreaId !== area._id.toString()) continue;

            const barns = await BarnModel.find({ area: area._id }).lean();

            // Gắn drug use vào từng barn
            for (let barn of barns) {
                const drugUses = await DrugUseModel.find({ barn: barn._id })
                    .lean();

                barn.rations = drugUses; // giống với FoodRation: this.rations
            }

            areaData.push({
                ...area,
                barns: barns
            });
        }

        return res.render("druguse/index", {
            title: "Medication regimen",
            active: "druguse",
            areas,
            selectedAreaId,
            areaData
        });
    } catch (err) {
        console.error("Drug Use Load Error:", err);
        res.status(500).send("Server error");
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

router.get("/detail/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const drugUse = await DrugUseModel.findById(id)
      .populate("barn") // populate nếu cần
      .lean();

    if (!drugUse) {
      return res.status(404).json({ success: false, message: "Không tìm thấy drug use" });
    }

    // Lấy thêm chi tiết
    const details = await DrugUseDetailModel.find({ drug_use: id })
    .populate("medition_warehouse")
    .lean();

    details.forEach(d => {
        d.medition_warehouse_name = d.medition_warehouse?.name || "";
    });

    return res.status(200).json({
      success: true,
      data: {
        ...drugUse,
        details
      }
    });

  } catch (err) {
    console.error("GET EDIT ERROR:", err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
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

// Delete specify drug use
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