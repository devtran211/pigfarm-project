const express = require("express");
const router = express.Router();
const DrugUseLogModel = require("../models/DrugUseLog");
const DrugUseDetailModel = require("../models/DrugUseDetail");


router.post("/add", async (req, res) => {
    try {
    const { barn, drug_use, time, status } = req.body;

    // Kiểm tra đầu vào
    if (!barn || !drug_use || !time ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Lấy danh sách chi tiết thuốc có meal tương ứng
    const medDetails = await DrugUseDetailModel.findOne({
      drug_use,
      time,
    }).select("_id");

    // Tạo log
    const log = await DrugUseLogModel.create({
      barn,
      drug_use,
      time,
      status,
      date: new Date(),
      med_details: medDetails
    });

    res.status(201).json({
      message: "Drug use log created successfully",
      log,
    });
  } catch (err) {
    console.error("Error creating drug use log:", err);
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;