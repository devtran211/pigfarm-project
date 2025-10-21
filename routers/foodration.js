var express = require('express');
var router = express.Router();
const BarnModel = require('../models/Barn');
const FoodRationModel = require('../models/FoodRation');
const RationFoodDetailModel = require('../models/RationFoodDetail');
const RationMeditionDetailModel = require('../models/RationMeditionDetail');
const { createFoodRationService, updateFoodRationService, deleteFoodRationService } = require('../services/foodRationService');

router.get("/", async (req, res) => {
  try {
    // 1) Lấy tất cả chuồng, đảm bảo có trường breedingarea (tên khu)
    // Nếu breedingarea là ref bạn có thể populate; nếu là string thì lấy trực tiếp
    const allBarns = await BarnModel.find().lean();

    // 2) Group barns theo khu (nếu barn.breedingarea là objectId ref, bạn có thể populate trước)
    const barnsByArea = {};
    for (const barn of allBarns) {
      // Nếu breedingarea là ref object, có thể là barn.breedingarea.name nếu populate trước.
      // Ở đây ta dùng fallback: nếu là object có name lấy name, nếu là string dùng trực tiếp
      let areaName = "Không xác định";
      if (barn.breedingarea) {
        if (typeof barn.breedingarea === "string") areaName = barn.breedingarea;
        else if (barn.breedingarea.name) areaName = barn.breedingarea.name;
        else areaName = String(barn.breedingarea);
      }
      if (!barnsByArea[areaName]) barnsByArea[areaName] = [];
      barnsByArea[areaName].push(barn);
    }

    // 3) Duyệt từng khu & từng chuồng, tìm FoodRation cho mỗi chuồng (1 record per barn theo quy tắc)
    const reportByArea = [];

    for (const [areaName, barns] of Object.entries(barnsByArea)) {
      const areaData = {
        area_name: areaName,
        barns: [],
        food_summary: {},
        med_summary: {}
      };

      for (const barn of barns) {
        // Tìm FoodRation liên quan tới chuồng này (1 record per barn)
        const ration = await FoodRationModel.findOne({ barn: barn._id }).lean();

        if (!ration) {
          // Chuồng chưa có chế độ ăn
          areaData.barns.push({
            barn_name: barn.name || String(barn._id),
            meals: [],
            total_feed: "0 Kg"
          });
          continue;
        }

        // Lấy chi tiết thức ăn & thuốc cho ration này
        const foodDetails = await RationFoodDetailModel.find({ food_ration: ration._id })
          .populate("food_warehouse", "name weight unit")
          .lean();

        const medDetails = await RationMeditionDetailModel.find({ food_ration: ration._id })
          .populate("medition_warehouse", "name unit capacity")
          .lean();

        // Gom các bữa ăn theo meal
        const mealMap = {};
        let totalFeedKg = 0;

        for (const fd of foodDetails) {
          const mealName = fd.meal || "Không đặt tên";
          if (!mealMap[mealName]) mealMap[mealName] = { meal: mealName, food: [], med: [] };
          const foodWName = fd.food_warehouse?.name || "Không rõ";
          const weightUnit = fd.weight_unit || "kg";
          const foodText = `${foodWName} ${fd.weight || 0}${weightUnit}`;
          mealMap[mealName].food.push(foodText);

          totalFeedKg += Number(fd.weight || 0);

          // cộng dồn summary cho khu
          const fk = foodWName;
          if (fk) areaData.food_summary[fk] = (areaData.food_summary[fk] || 0) + Number(fd.weight || 0);
        }

        for (const md of medDetails) {
          const mealName = md.meal || "Không đặt tên";
          if (!mealMap[mealName]) mealMap[mealName] = { meal: mealName, food: [], med: [] };
          const mdlName = md.medition_warehouse?.name || "Không rõ";
          const medText = `${mdlName} ${md.dosage || 0}${md.dosage_unit || ""}`;
          mealMap[mealName].med.push(medText);

          // cộng dồn summary thuốc (chỉ cộng dosage raw; có thể cần nhân theo số heo/ngày nếu muốn)
          const mk = mdlName;
          if (mk) areaData.med_summary[mk] = (areaData.med_summary[mk] || 0) + Number(md.dosage || 0);
        }

        areaData.barns.push({
          barn_name: barn.name || String(barn._id),
          meals: Object.values(mealMap),
          total_feed: `${totalFeedKg} Kg`
        });
      }

      // Format summaries thành mảng
      areaData.food_summary = Object.entries(areaData.food_summary).map(([name, total]) => ({
        food_name: name,
        total_weight: total
      }));
      areaData.med_summary = Object.entries(areaData.med_summary).map(([name, total]) => ({
        med_name: name,
        total_amount: total
      }));

      reportByArea.push(areaData);
    }

    return res.status(200).json({
      message: "Báo cáo tổng hợp khu - chuồng - cữ ăn (bao gồm chuồng chưa có ration)",
      data: reportByArea
    });
  } catch (err) {
    console.error("Lỗi khi lấy dữ liệu báo cáo:", err);
    return res.status(500).json({ message: "Lỗi server", error: err.message });
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