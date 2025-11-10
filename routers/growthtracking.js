const express = require('express');
const router = express.Router();
const PigModel = require('../models/Pig');
const GrowthTrackingModel = require('../models/GrowthTracking');
const RationFoodDetailModel = require('../models/RationFoodDetail');
const FoodRationModel = require('../models/FoodRation');
const { createPigs } = require('../services/pig');

router.post('/create-pigs', createPigs);

router.post('/create', async(req,res) => {
try {
    const { pig, dateOfImplementation, age, weight, length, note } = req.body;

    // 🐷 Lấy thông tin lợn (để biết nó đang ở chuồng nào)
    const pigData = await PigModel.findById(pig).populate("barn");
    if (!pigData) return res.status(404).json({ message: "Pig not found" });

    // 📈 Lấy bản ghi tăng trưởng gần nhất
    const lastGrowth = await GrowthTrackingModel.findOne({ pig }).sort({
      dateOfImplementation: -1,
    });

    // 🍽️ Lấy chế độ ăn gần nhất của chuồng (lưu ý: barn là mảng, và dùng start_time)
    const latestRation = await FoodRationModel.findOne({
      barn: { $in: [pigData.barn._id] },
      start_time: { $lte: new Date(dateOfImplementation) },
      $or: [
        { end_time: null },
        { end_time: { $gte: new Date(dateOfImplementation) } },
      ],
    })
      .sort({ start_time: -1 })
      .lean();

    if (!latestRation) {
      return res.status(400).json({
        message: `No FoodRation found for barn ${pigData.barn.name} at this time.`,
      });
    }

    // 🧾 Lấy chi tiết thức ăn thuộc khẩu phần này
    const rationDetails = await RationFoodDetailModel.find({
      food_ration: latestRation._id,
    });

    // 🧮 Tính tổng lượng ăn/ngày
    const totalPerDay = rationDetails.reduce(
      (sum, item) =>
        sum + (item.weight || 0) * (latestRation.number_of_feedings_per_day || 0),
      0
    );

    // Tính số ngày giữa hai lần ghi nhận (hoặc mặc định 1)
    let dayDiff = 1;
    if (lastGrowth) {
      dayDiff =
        (new Date(dateOfImplementation) -
          new Date(lastGrowth.dateOfImplementation)) /
        (1000 * 60 * 60 * 24);
      dayDiff = Math.max(1, Math.round(dayDiff));
    }

    const feedIntake = totalPerDay * dayDiff;

    // 🧠 Tính FCR nếu có dữ liệu trước
    let fcr = null;
    if (lastGrowth && feedIntake > 0) {
      const weightGain = weight - lastGrowth.weight;
      fcr = weightGain > 0 ? feedIntake / weightGain : null;
    }

    // 💾 Lưu bản ghi tăng trưởng mới
    const growth = new GrowthTrackingModel({
      pig,
      dateOfImplementation,
      age,
      weight,
      length,
      fcr,
      note,
    });
    await growth.save();

    res.status(201).json({
      message: "Growth tracking created successfully",
      barn: pigData.barn.name,
      rationUsed: latestRation.name,
      growth,
      feedIntake,
      dayDiff,
      fcr,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/edit/:id', async(req,res) => {
try {
    const { id } = req.params;
    const {
    pig,
    dateOfImplementation,
    age,
    weight,
    length,
    note
    } = req.body;

    // 1️⃣ Kiểm tra bản ghi có tồn tại không
    const growth = await GrowthTrackingModel.findById(id);
    if (!growth) {
    return res.status(404).json({ message: "GrowthTracking record not found" });
    }

    // 2️⃣ Nếu có thay đổi cân nặng hoặc ngày thực hiện → tính lại FCR
    let fcr = growth.fcr; // giữ nguyên nếu không cần tính lại
    if (weight || dateOfImplementation) {
    const pigData = await PigModel.findById(pig || growth.pig).populate("barn");

    if (!pigData) {
        return res.status(404).json({ message: "Pig not found" });
    }

    const lastGrowth = await GrowthTrackingModel.findOne({
        pig: pig || growth.pig,
        _id: { $ne: id },
        dateOfImplementation: { $lt: new Date(dateOfImplementation || growth.dateOfImplementation) }
    }).sort({ dateOfImplementation: -1 });

    if (lastGrowth) {
        const latestRation = await FoodRationModel.findOne({
        barn: { $in: [pigData.barn._id] },
        start_time: { $lte: new Date(dateOfImplementation || growth.dateOfImplementation) },
        $or: [
            { end_time: null },
            { end_time: { $gte: new Date(dateOfImplementation || growth.dateOfImplementation) } },
        ],
        }).sort({ start_time: -1 }).lean();

        if (latestRation) {
        const rationDetails = await RationFoodDetailModel.find({
            food_ration: latestRation._id,
        });

        const totalPerDay = rationDetails.reduce(
            (sum, item) =>
            sum + (item.weight || 0) * (latestRation.number_of_feedings_per_day || 0),
            0
        );

        const dayDiff =
            (new Date(dateOfImplementation || growth.dateOfImplementation) -
            new Date(lastGrowth.dateOfImplementation)) /
            (1000 * 60 * 60 * 24);

        const feedIntake = totalPerDay * Math.max(1, Math.round(dayDiff));
        const weightGain = (weight || growth.weight) - lastGrowth.weight;
        fcr = weightGain > 0 ? feedIntake / weightGain : null;
        }
    }
    }

    // 3️⃣ Cập nhật dữ liệu
    const updated = await GrowthTrackingModel.findByIdAndUpdate(
    id,
    {
        pig: pig || growth.pig,
        dateOfImplementation: dateOfImplementation || growth.dateOfImplementation,
        age: age ?? growth.age,
        weight: weight ?? growth.weight,
        length: length ?? growth.length,
        note: note ?? growth.note,
        fcr,
    },
    { new: true }
    );

    res.status(200).json({
    message: "Growth tracking updated successfully",
    updated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/delete/:id', async (req, res) => {
try {
    const { id } = req.params;

    // 1️⃣ Kiểm tra xem bản ghi có tồn tại không
    const growth = await GrowthTrackingModel.findById(id);
    if (!growth) {
      return res.status(404).json({
        message: "GrowthTracking record not found",
      });
    }

    // 2️⃣ Tiến hành xóa
    await GrowthTrackingModel.findByIdAndDelete(id);

    res.status(200).json({
      message: "Growth tracking deleted successfully",
      deletedRecord: growth,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;