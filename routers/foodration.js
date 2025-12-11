var express = require('express');
var router = express.Router();
const AreaModel = require('../models/Area');
const BarnModel = require('../models/Barn');
const FoodRationModel = require('../models/FoodRation');
const FoodWareHouseModel = require("../models/FoodWareHouse");
const MeditionWareHouseModel = require("../models/MeditionWareHouse");
const RationFoodDetailModel = require('../models/RationFoodDetail');
const RationMeditionDetailModel = require('../models/RationMeditionDetail');
const { createFoodRationService, updateFoodRationService, deleteFoodRationService } = require('../services/foodRationService');

// get all ration
router.get("/", async (req, res) => {
  try {
    // Lấy tất cả khu
    const areas = await AreaModel.find({});

    // selected areaId từ query param (vd: ?areaId=...), nếu không có thì mặc định là area đầu tiên (nếu có)
    const selectedAreaId = req.query.areaId || (areas.length ? areas[0]._id.toString() : "");

    // Lấy tất cả chuồng
    const barns = await BarnModel.find({});

    // Lấy tất cả khẩu phần ăn
    const rations = await FoodRationModel.find({}).populate("barn");

    // Lấy chi tiết bữa ăn
    const details = await RationFoodDetailModel.find({});

    // Tạo cấu trúc Area -> Barn -> Ration
    const areaData = areas.map(area => {
        const barnsInArea = barns.filter(b => b.area?.toString() === area._id.toString());

        const barnsMapped = barnsInArea.map(barn => {
             const barnRations = rations.filter(r =>
                r.barn
                .map(b => (b._id ? b._id.toString() : b.toString()))
                .includes(barn._id.toString())
            );

            const rationsMapped = barnRations.map(r => {
                const rDetail = details.filter(d => d.food_ration.toString() === r._id.toString());

                return {
                    ...r.toObject(),
                    // lấy trực tiếp từ DB (không ghi đè)
                    number_of_feedings_per_day: r.number_of_feedings_per_day,
                    total: rDetail.reduce((sum, d) => sum + (d.weight || 0), 0)
                };
            });

            return {
                ...barn.toObject(),
                rations: rationsMapped
            };
        });

        return {
            ...area.toObject(),
            barns: barnsMapped
        };
    });

    res.render("foodration/index", {
      title: 'Food ration',
      active: 'foodration',
      areaData,
      areas, // gửi areas để build select
      selectedAreaId
    });

  } catch (err) {
    console.log(err);
    res.status(500).send("Error loading Food Ration data");
  }
});

// get a ration detail
router.get("/detail/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const ration = await FoodRationModel.findById(id).populate("barn");
    if (!ration) return res.status(404).json({ error: "Không tìm thấy ration" });

    const foodDetails = await RationFoodDetailModel.find({ food_ration: id })
      .populate("food_warehouse");

    const medDetails = await RationMeditionDetailModel.find({ food_ration: id })
      .populate("medition_warehouse");

    res.json({
      ration,
      foodDetails,
      medDetails
    });

  } catch (err) {
    console.error("Error GET /food-ration/detail:", err);
    res.status(500).json({ error: err.message });
  }
});

// get foods to load to options
router.get("/foods", async (req, res) => {
    const foods = await FoodWareHouseModel.find({}).lean();
    res.json(foods);
});

// get meds to load to options
router.get("/meds", async (req, res) => {
    const meds = await MeditionWareHouseModel.find({}).lean();
    res.json(meds);
});

// create a new ration
router.post("/create", async (req, res) => {
  try {
    const payload = req.body;
    const result = await createFoodRationService(payload);
    res.json({ message: "Tạo khẩu phần thành công!", data: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// get a ration to edit
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const ration = await FoodRationModel.findById(id).populate("barn");

    if (!ration) return res.status(404).json({ error: "Không tìm thấy khẩu phần" });

    const foodDetails = await RationFoodDetailModel.find({ food_ration: id });
    const medDetails = await RationMeditionDetailModel.find({ food_ration: id });

    res.json({
      ...ration.toObject(),
      foodDetails,
      medDetails
    });

  } catch (err) {
    console.error("GET /food-ration/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// edit a ration
router.put("/edit/:id", async (req, res) => {
  try {
    const out = await updateFoodRationService(req.params.id, req.body);
    res.json(out);
  } catch (err) {
    console.error("PUT /food-rations/edit/:id error:", err);
    res.status(400).json({ error: err.message });
  }
});

router.get("/ration-detail/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const ration = await FoodRationModel.findById(id).populate("barn");
    const foodDetails = await RationFoodDetailModel.find({ food_ration: id });
    const medDetails = await RationMeditionDetailModel.find({ food_ration: id });

    res.json({
      ...ration.toObject(),
      foodDetails,
      medDetails
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Delete ration of a barn
router.delete("/delete/:id", async (req, res) => {
  try {
    const result = await deleteFoodRationService({ foodRationId: req.params.id });
    res.json({ message: "Đã xóa 1 chế độ ăn", result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete ration of an area
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