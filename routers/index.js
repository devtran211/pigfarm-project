var express = require('express');
var router = express.Router();
const SellPigModel = require("../models/SellPig");
const MeditionModel = require("../models/MeditionWareHouse");
const FoodModel = require("../models/FoodWareHouse");
const BarnHealthModel = require("../models/BarnHealth");
const HealthHistoryhModel = require("../models/HealthHistory");

router.get('/', (req, res) => {
    res.render('index/home', {
        title: 'Homepage',
        active: 'home'
        
    });
});

router.get("/revenue-by-month", async (req, res) => {
  try {
        const result = await SellPigModel.aggregate([
        {
            $group: {
            _id: {
                year: { $year: "$exportDate" },
                month: { $month: "$exportDate" }
            },
            totalRevenue: { $sum: "$totalPrice" }
            }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        const labels = result.map(r => `${r._id.month}/${r._id.year}`);
        const data = result.map(r => r.totalRevenue);

        res.json({ labels, data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/medition-cost-by-month", async (req, res) => {
  try {
    const result = await MeditionModel.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$importDate" },
            month: { $month: "$importDate" }
          },
          totalCost: { $sum: "$import_price" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const labels = result.map(r => `${r._id.month}/${r._id.year}`);
    const data = result.map(r => r.totalCost);

    res.json({ labels, data });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/food-cost-by-month", async (req, res) => {
  try {
    const result = await FoodModel.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$import_date" },
            month: { $month: "$import_date" }
          },
          totalCost: { $sum: "$import_price" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const labels = result.map(r => `${r._id.month}/${r._id.year}`);
    const data = result.map(r => r.totalCost);

    res.json({ labels, data });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/loss-rate", async (req, res) => {
  try {
    const now = new Date();

    // THÁNG NÀY
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // THÁNG TRƯỚC
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Query tổng loss tháng này
    const thisMonth = await BarnHealthModel.aggregate([
      {
        $match: {
          dateOfInspection: {
            $gte: startThisMonth,
            $lte: endThisMonth
          }
        }
      },
      { $group: { _id: null, totalLoss: { $sum: "$loss" } } }
    ]);

    // Query tổng loss tháng trước
    const lastMonth = await BarnHealthModel.aggregate([
      {
        $match: {
          dateOfInspection: {
            $gte: startLastMonth,
            $lte: endLastMonth
          }
        }
      },
      { $group: { _id: null, totalLoss: { $sum: "$loss" } } }
    ]);

    const thisMonthLoss = thisMonth[0]?.totalLoss || 0;
    const lastMonthLoss = lastMonth[0]?.totalLoss || 0;

    return res.json({
      labels: ["Tháng trước", "Tháng này"],
      data: [lastMonthLoss, thisMonthLoss]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/disease-compare", async (req, res) => {
  try {
    const now = new Date();

    // Tháng này
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Tháng trước
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const diseasedThisMonth = await HealthHistoryhModel.countDocuments({
      dateOfDiscovery: { $gte: startThisMonth, $lte: endThisMonth }
    });

    const diseasedLastMonth = await HealthHistoryhModel.countDocuments({
      dateOfDiscovery: { $gte: startLastMonth, $lte: endLastMonth }
    });

    res.json({
      labels: ["Tháng trước", "Tháng này"],
      data: [diseasedLastMonth, diseasedThisMonth]
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;