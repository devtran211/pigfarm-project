const express = require('express');
const router = express.Router();
const BarnModel = require('../models/Barn');
const BarnHealthModel = require('../models/BarnHealth');
// const req = require('express/lib/request');

router.get("/", async (req, res) => {
  try {
    // Lấy danh sách tất cả các chuồng, kèm tên khu
    const barns = await BarnModel.find()
      .populate("breedingarea", "name")
      .lean(); // lean() giúp tăng tốc, trả về plain object

    // Với mỗi chuồng, tìm bản ghi Barn_health mới nhất
    const results = await Promise.all(
      barns.map(async (barn) => {
        const latestHealth = await BarnHealthModel.findOne({ barn: barn._id })
          .sort({ dateOfInspection: -1 }) // mới nhất
          .lean();

        return {
          barnId: barn._id,
          barnName: barn.name,
          breedingAreaName: barn.breedingarea?.name || null,
          latestHealth: latestHealth
            ? {
                dateOfInspection: latestHealth.dateOfInspection,
                averageWeight: latestHealth.averageWeight,
                loss: latestHealth.loss,
                faecesStatus: latestHealth.faecesStatus,
                note: latestHealth.note,
              }
            : null,
        };
      })
    );

    // Trả kết quả
    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching barn health list:", error);
    res.status(500).json({ message: "Error fetching barn health list" });
  }
});

router.get("/history/:barnId", async (req, res) => {
  try {
    const { barnId } = req.params;

    // Tìm thông tin chuồng
    const barn = await BarnModel.findById(barnId)
      .populate("breedingarea", "name")
      .lean();
    if (!barn) {
      return res.status(404).json({ message: "Không tìm thấy chuồng" });
    }

    // Lấy danh sách bản ghi sức khỏe theo chuồng
    const healthRecords = await BarnHealthModel.find({ barn: barnId })
      .sort({ dateOfInspection: -1 }) // sắp xếp mới nhất lên đầu
      .lean();

    // Nếu chưa có bản ghi nào
    if (healthRecords.length === 0) {
      return res.status(200).json({
        barn: {
          barnId: barn._id,
          barnName: barn.name,
          breedingAreaName: barn.breedingarea?.name || null,
        },
        message: "Chuồng này chưa có dữ liệu sức khỏe nào",
        healthRecords: [],
      });
    }

    // Trả về kết quả
    res.status(200).json({
      barn: {
        barnId: barn._id,
        barnName: barn.name,
        breedingAreaName: barn.breedingarea?.name || null,
        currentTotalPigs: barn.total_pigs,
      },
      totalRecords: healthRecords.length,
      healthRecords: healthRecords.map((r) => ({
        id: r._id,
        dateOfInspection: r.dateOfInspection,
        totalPigs: r.totalPigs,
        averageWeight: r.averageWeight,
        loss: r.loss,
        faecesStatus: r.faecesStatus,
        note: r.note,
      })),
    });
  } catch (error) {
    console.error("Error fetching barn health history:", error);
    res.status(500).json({ message: "Lỗi khi lấy lịch sử sức khỏe chuồng" });
  }
});

router.post("/create/:barnId", async (req, res) => {
  try {
    const { barnId } = req.params;
    const {
      dateOfInspection,
      averageWeight,
      loss,
      faecesStatus,
      note,
    } = req.body;

    // Kiểm tra chuồng có tồn tại không
    const barn = await BarnModel.findById(barnId);
    if (!barn) {
      return res.status(404).json({ message: "Không tìm thấy chuồng" });
    }

    // Tạo bản ghi Barn_health mới
    const newHealthRecord = new BarnHealthModel({
      barn: barnId,
      dateOfInspection,
      averageWeight,
      loss,
      faecesStatus,
      note,
    });

    await newHealthRecord.save();

    // Cập nhật lại total_pigs trong Barn
    // Nếu có loss => trừ loss, nếu không => có thể cập nhật totalPigs nếu có truyền vào
    if (typeof loss === "number" && loss > 0) {
      barn.total_pigs = Math.max(0, barn.total_pigs - loss); // tránh âm
    }

    await barn.save();

    res.status(201).json({
      message: "Thêm dữ liệu sức khỏe chuồng thành công",
      barnHealth: newHealthRecord,
      updatedBarnTotalPigs: barn.total_pigs,
    });
  } catch (error) {
    console.error("Error creating barn health record:", error);
    res.status(500).json({ message: "Lỗi khi thêm dữ liệu sức khỏe chuồng" });
  }
});

router.put("/edit/:barnHealthId", async (req, res) => {
  try {
    const { barnHealthId } = req.params;
    const {
      dateOfInspection,
      averageWeight,
      loss,
      faecesStatus,
      note,
    } = req.body;

    // Tìm bản ghi Barn_health cần chỉnh sửa
    const healthRecord = await BarnHealthModel.findById(barnHealthId);
    if (!healthRecord) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi sức khỏe" });
    }

    // Lấy thông tin chuồng liên quan
    const barn = await BarnModel.findById(healthRecord.barn);
    if (!barn) {
      return res.status(404).json({ message: "Không tìm thấy chuồng liên quan" });
    }

    // Nếu có loss mới, tính toán chênh lệch để cập nhật total_pigs
    if (typeof loss === "number" && loss !== healthRecord.loss) {
      const diff = loss - (healthRecord.loss || 0); // chênh lệch giữa loss mới và cũ
      const newTotal = barn.total_pigs - diff;

      // kiểm tra nếu âm => báo lỗi, không cập nhật
      if (newTotal < 0) {
        return res.status(400).json({
          message: `Số lợn sau khi trừ (${barn.total_pigs} - ${diff}) bị âm. Vui lòng kiểm tra lại dữ liệu.`,
        });
      }

      barn.total_pigs = newTotal;
    }

    // Cập nhật lại các trường khác trong bản ghi Barn_health
    healthRecord.dateOfInspection = dateOfInspection || healthRecord.dateOfInspection;
    healthRecord.averageWeight = averageWeight ?? healthRecord.averageWeight;
    healthRecord.loss = loss ?? healthRecord.loss;
    healthRecord.faecesStatus = faecesStatus ?? healthRecord.faecesStatus;
    healthRecord.note = note ?? healthRecord.note;

    await healthRecord.save();
    await barn.save();

    res.status(200).json({
      message: "Cập nhật dữ liệu sức khỏe chuồng thành công",
      barnHealth: healthRecord,
      updatedBarnTotalPigs: barn.total_pigs,
    });
  } catch (error) {
    console.error("Error updating barn health record:", error);
    res.status(500).json({ message: "Lỗi khi cập nhật dữ liệu sức khỏe chuồng" });
  }
});

router.delete("/delete/:barnHealthId", async (req,res) => {
  try {
    const { barnHealthId } = req.params;

    // Tìm bản ghi cần xóa
    const healthRecord = await BarnHealthModel.findById(barnHealthId);
    if (!healthRecord) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi sức khỏe" });
    }

    // Tìm chuồng liên quan
    const barn = await BarnModel.findById(healthRecord.barn);
    if (!barn) {
      return res.status(404).json({ message: "Không tìm thấy chuồng liên quan" });
    }

    // Nếu bản ghi có loss, hoàn lại số lợn đó
    if (typeof healthRecord.loss === "number" && healthRecord.loss > 0) {
      barn.total_pigs += healthRecord.loss;
    }

    // Xóa bản ghi Barn_health
    await healthRecord.deleteOne();
    await barn.save();

    res.status(200).json({
      message: "Xóa bản ghi sức khỏe chuồng thành công",
      restoredLoss: healthRecord.loss || 0,
      updatedBarnTotalPigs: barn.total_pigs,
    });
  } catch (error) {
    console.error("Error deleting barn health record:", error);
    res.status(500).json({ message: "Lỗi khi xóa bản ghi sức khỏe chuồng" });
  }
});

module.exports = router;