const BarnModel = require('../models/Barn.js');
const BarnHerdDetailModel = require('../models/BarnHerdDetail.js');
const HerdModel = require('../models/Herd.js');
const PigModel = require('../models/Pig.js');


async function createPigs(req, res) {
   try {
    const { barnId, quantity } = req.body;

    // 1️⃣ Kiểm tra input
    if (!barnId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: "Thiếu thông tin barnId hoặc quantity hợp lệ" });
    }

    // 2️⃣ Lấy thông tin chuồng
    const barn = await BarnModel.findById(barnId);
    if (!barn) {
      return res.status(404).json({ message: "Không tìm thấy chuồng" });
    }

    // 3️⃣ Kiểm tra xem chuồng này có herd nào chưa (thông qua BarnHerdDetail)
    const barnHerdDetail = await BarnHerdDetailModel.findOne({ barn: barnId }).populate("herd");
    if (!barnHerdDetail) {
      return res.status(400).json({ message: "Chuồng này chưa được gán herd (đàn lợn)" });
    }

    // 4️⃣ Lấy sex từ herd (ưu tiên sex trong herd, nếu không có thì lấy trong BarnHerdDetail)
    const herd = barnHerdDetail.herd;
    const sex = herd?.sex || barnHerdDetail.sex || "mixed";

    // 5️⃣ Lấy số lượng lợn hiện có trong chuồng để đánh số tiếp theo
    const existingCount = await PigModel.countDocuments({ barn: barnId });
    const barnName = barn.name || "UNKNOWN";

    // 6️⃣ Tạo danh sách lợn cần thêm
    const pigsToCreate = [];
    for (let i = 1; i <= quantity; i++) {
      const index = existingCount + i;
      const tag = `PIG-${barnName}-${index.toString().padStart(3, "0")}`;

      pigsToCreate.push({
        barn: barnId,
        herd: herd._id,
        sex,
        tag,
      });
    }

    // 7️⃣ Lưu vào DB
    const newPigs = await PigModel.insertMany(pigsToCreate);

    // 8️⃣ Cập nhật lại tổng số lợn trong chuồng (nếu có field này)
    const newTotal = existingCount + quantity;
    barn.total_pigs = newTotal;
    await barn.save();

    // 9️⃣ Phản hồi kết quả
    return res.status(201).json({
      message: `Đã tạo thành công ${quantity} con lợn trong chuồng ${barnName}`,
      pigs: newPigs,
    });
  } catch (error) {
    console.error(" Lỗi khi tạo lợn:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
}

module.exports = { createPigs }