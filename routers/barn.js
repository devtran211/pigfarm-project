const express = require('express');
const router = express.Router();
const BarnModel = require('../models/Barn');
const BarnHerdDetailModel = require('../models/BarnHerdDetail'); 
const HerdModel = require('../models/Herd');

router.get('/', async (req, res) => {
   // Lấy danh sách con giống trong một chuồng

   // Lấy lịch sử chuồng của một con giống

   var barns = await BarnModel.find({}).populate('breedingarea');
   res.json(barns);
});

router.post('/add', async (req, res) => {
   var barns = await BarnModel.create(req.body);
   res.json(barns);
});

router.put('/edit/:id', async (req, res) => {
   var id = req.params.id;
   var barns = req.body;
   try {
      await BarnModel.findByIdAndUpdate(id, barns);
      res.json('update succeed !');
   } catch (err) {
      res.json('update failed. Error: ' + err);
   }
});

router.delete('/delete/:id', async (req, res) => {
   var id = req.params.id;
   try {
      await BarnModel.findByIdAndDelete(id);
      res.json('Delete barn succeed !');
   } catch (err) {
      res.json('Delete barn fail. Error: ' + err);
   };
});

// Thêm đàn lợn vào chuồng
router.post('/import-herd', async (req,res) => {
  try {
    const { herdId, barnId, quantity } = req.body;

    if (!herdId || !barnId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: "Thiếu thông tin hoặc số lượng không hợp lệ" });
    }

    // Tìm herd và barn
    const herd = await HerdModel.findById(herdId);
    const barn = await BarnModel.findById(barnId);

    if (!herd || !barn) {
      return res.status(404).json({ message: "Không tìm thấy herd hoặc barn" });
    }

    // Kiểm tra tồn kho herd
    if (herd.inventory < quantity) {
      return res.status(400).json({ message: "Số lượng nhập vượt quá tồn kho hiện có" });
    }

    // Kiểm tra sức chứa chuồng
    const currentTotal = barn.total_pigs || 0;
    const newTotal = currentTotal + quantity;
    if (barn.maximum_capacity && newTotal > barn.maximum_capacity) {
      return res.status(400).json({ message: "Chuồng đã đạt hoặc vượt sức chứa tối đa" });
    }

    // Tạo hoặc cập nhật BarnHerdDetail
    let barnHerdDetail = await BarnHerdDetailModel.findOne({
      barn: barnId,
      herd: herdId,
    });

    if (barnHerdDetail) {
      // Nếu đã có herd trong chuồng → cộng dồn thêm số lượng
      barnHerdDetail.herdQuantity += quantity;
    } else {
      // Nếu chưa có → tạo mới record
      barnHerdDetail = new BarnHerdDetailModel({
        barn: barnId,
        herd: herdId,
        herdName: herd.name,
        sex: herd.sex,
        herdQuantity: quantity,
        importDate: new Date(),
      });
    }

    // Cập nhật tồn kho herd
    herd.inventory -= quantity;

    // Cập nhật tổng số heo trong chuồng
    barn.total_pigs = newTotal;

    await Promise.all([barnHerdDetail.save(), herd.save(), barn.save()]);

    return res.status(200).json({
      message: "Nhập đàn vào chuồng thành công",
      data: barnHerdDetail,
    });
  } catch (error) {
    console.error("Lỗi khi nhập herd vào barn:", error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
});

// Chỉnh sửa số lượng trong đàn
router.put("/update/:barnHerdDetailId", async (req,res) => {
  try {
    const { barnHerdDetailId } = req.params;
    const { newQuantity } = req.body;
    const { date } = req.body;

    if (!newQuantity || newQuantity < 0) {
      return res.status(400).json({ message: "Số lượng mới không hợp lệ" });
    }

    const barnHerdDetail = await BarnHerdDetailModel.findById(barnHerdDetailId)
      .populate("barn")
      .populate("herd");

    if (!barnHerdDetail) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi nhập đàn" });
    }

    const oldQuantity = barnHerdDetail.herdQuantity;
    const herd = barnHerdDetail.herd;
    const barn = barnHerdDetail.barn;

    const diff = newQuantity - oldQuantity;

    // Nếu tăng số lượng (diff > 0)
    if (diff > 0) {
      if (herd.inventory < diff) {
        return res.status(400).json({ message: "Không đủ tồn kho để tăng số lượng" });
      }

      const totalAfter = (barn.total_pigs || 0) + diff;
      if (barn.maximum_capacity && totalAfter > barn.maximum_capacity) {
        return res.status(400).json({ message: "Chuồng không đủ chỗ cho số lượng tăng thêm" });
      }

      herd.inventory -= diff;
      barn.total_pigs += diff;
    }

    // Nếu giảm số lượng (diff < 0)
    else if (diff < 0) {
      const absDiff = Math.abs(diff);
      herd.inventory += absDiff;
      barn.total_pigs -= absDiff;
    }

    // Cập nhật BarnHerdDetail
    barnHerdDetail.herdQuantity = newQuantity;
    // barnHerdDetail.date = new Date(); // cập nhật ngày chỉnh sửa

    await Promise.all([herd.save(), barn.save(), barnHerdDetail.save()]);

    return res.status(200).json({
      message: "Cập nhật số lượng đàn thành công",
      data: barnHerdDetail,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật đàn:", error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
});

// Tách đàn
router.post('/split', async (req,res) => {
  try {
    const { fromBarnHerdDetailId, toBarnId, quantity } = req.body;

    // Kiểm tra đầu vào
    if (!fromBarnHerdDetailId || !toBarnId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: "Thiếu thông tin hoặc số lượng không hợp lệ" });
    }

    // Lấy dữ liệu bản ghi nguồn
    const fromDetail = await BarnHerdDetailModel.findById(fromBarnHerdDetailId)
      .populate("barn")
      .populate("herd");

    if (!fromDetail) {
      return res.status(404).json({ message: "Không tìm thấy đàn nguồn để tách" });
    }

    // Chuồng gốc và chuồng đích
    const fromBarn = fromDetail.barn;
    const toBarn = await BarnModel.findById(toBarnId);

    if (!toBarn) {
      return res.status(404).json({ message: "Không tìm thấy chuồng đích" });
    }

    // Kiểm tra số lượng hợp lệ
    if (fromDetail.herdQuantity < quantity) {
      return res.status(400).json({ message: "Số lượng tách vượt quá số lượng hiện có trong chuồng" });
    }

    // Kiểm tra sức chứa chuồng đích
    const totalAfter = (toBarn.total_pigs || 0) + quantity;
    if (toBarn.maximum_capacity && totalAfter > toBarn.maximum_capacity) {
      return res.status(400).json({ message: "Chuồng đích đã đạt hoặc vượt sức chứa tối đa" });
    }

    // Tìm xem chuồng đích có cùng herd chưa
    let toDetail = await BarnHerdDetailModel.findOne({
      barn: toBarnId,
      herd: fromDetail.herd._id,
    });

    if (toDetail) {
      // Cộng dồn
      toDetail.herdQuantity += quantity;
    } else {
      // Tạo mới record cho chuồng đích
      toDetail = new BarnHerdDetailModel({
        barn: toBarnId,
        herd: fromDetail.herd._id,
        herdName: fromDetail.herdName,
        sex: fromDetail.sex,
        herdQuantity: quantity,
        date: new Date(),
      });
    }

    // Cập nhật chuồng gốc
    fromDetail.herdQuantity -= quantity;
    fromBarn.total_pigs = Math.max((fromBarn.total_pigs || 0) - quantity, 0);

    // Cập nhật chuồng đích
    toBarn.total_pigs = (toBarn.total_pigs || 0) + quantity;

    // Lưu thay đổi
    await Promise.all([
      fromDetail.save(),
      toDetail.save(),
      fromBarn.save(),
      toBarn.save(),
    ]);

    // Nếu chuồng nguồn hết đàn thì xóa record
    if (fromDetail.herdQuantity <= 0) {
      await BarnHerdDetailModel.findByIdAndDelete(fromDetail._id);
    }

    return res.status(200).json({
      message: "Tách đàn thành công",
      data: {
        fromBarn: fromBarn.name,
        toBarn: toBarn.name,
        herdName: fromDetail.herdName,
        quantityMoved: quantity,
      },
    });
  } catch (error) {
    console.error("Lỗi khi tách đàn:", error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
});

// Thu hồi về kho
router.delete("/recall/:barnHerdDetailId", async (req, res) => {
    try {
    const { barnHerdDetailId } = req.params;

    // Lấy thông tin chi tiết, bao gồm barn và herd
    const barnHerdDetail = await BarnHerdDetailModel.findById(barnHerdDetailId)
      .populate("barn")
      .populate("herd");

    if (!barnHerdDetail) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi đàn trong chuồng" });
    }

    const herd = barnHerdDetail.herd;
    const barn = barnHerdDetail.barn;

    // Tính thời gian đã ở chuồng
    const now = new Date();
    const importedDate = new Date(barnHerdDetail.importDate);
    const diffInDays = Math.floor((now - importedDate) / (1000 * 60 * 60 * 24));

    // Nếu quá 7 ngày => không cho thu hồi
    if (diffInDays >= 7) {
      return res.status(400).json({
        message: `Đàn đã được nhập vào chuồng hơn ${diffInDays} ngày, không thể thu hồi nữa.`,
      });
    }

    // Hoàn trả tồn kho
    herd.inventory += barnHerdDetail.herdQuantity;

    // Giảm tổng số heo trong chuồng
    barn.total_pigs = Math.max((barn.total_pigs || 0) - barnHerdDetail.herdQuantity, 0);

    // Lưu thay đổi herd và barn
    await Promise.all([herd.save(), barn.save()]);

    // Xóa record trong BarnHerdDetail
    await BarnHerdDetailModel.findByIdAndDelete(barnHerdDetailId);

    return res.status(200).json({
      message: "Thu hồi và xóa đàn khỏi chuồng thành công",
      data: {
        herdName: barnHerdDetail.herdName,
        herdQuantity: barnHerdDetail.herdQuantity,
        barn: barn.name,
        status: "Đã thu hồi và xóa",
      },
    });
  } catch (error) {
    console.error("Lỗi khi thu hồi đàn:", error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
});

module.exports = router;