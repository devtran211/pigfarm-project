const express = require("express");
const router = express.Router();
const FeedingLogModel = require("../models/FeedingLog");
const RationFoodDetailModel = require("../models/RationFoodDetail");
const RationMeditionDetailModel = require("../models/RationMeditionDetail");


router.post("/add", async (req, res) => {
    try {
    const { barn, food_ration, meal, status } = req.body;

    // Kiểm tra đầu vào
    if (!barn || !food_ration || !meal ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Lấy danh sách chi tiết khẩu phần ăn có meal tương ứng
    const foodDetails = await RationFoodDetailModel.find({
      food_ration,
      meal,
    }).select("_id");

    // Lấy danh sách chi tiết thuốc có meal tương ứng
    const medDetails = await RationMeditionDetailModel.find({
      food_ration,
      meal,
    }).select("_id");

    // Tạo log
    const log = await FeedingLogModel.create({
      barn,
      food_ration,
      meal,
      status,
      date: new Date(),
      meal_details: {
        foodDetailIds: foodDetails.map((f) => f._id),
        medDetailIds: medDetails.map((m) => m._id),
      },
    });

    res.status(201).json({
      message: "Feeding log created successfully",
      log,
    });
  } catch (err) {
    console.error("Error creating feeding log:", err);
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
