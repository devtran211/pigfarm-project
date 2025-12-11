const express = require('express');
const router = express.Router();
const AreaModel = require('../models/Area');
const BarnModel = require('../models/Barn');
const BarnHerdDetailModel = require('../models/BarnHerdDetail'); 
const BarnHealthModel = require('../models/BarnHealth');
const HerdModel = require('../models/Herd');
const PigModel = require('../models/Pig');
const InvestmentCostModel = require('../models/InvestmentCost');
const {calculateAndSavePigImportCost, calculateAndSavePigUpdateCost, calculateAndSavePigSplitCost } = require('../services/calculatePricePerBarn');

// get all barns
router.get("/all", async (req,res) => {
  try{
    const barns = await BarnModel.find({});
    res.json(barns);
  }catch(err){
    console.error("Error loading barns:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// count barns in area 
router.get("/count/:areaId", async (req, res) => {
    const count = await BarnModel.countDocuments({ area: req.params.areaId });
    res.json(count);
});

// create a new barn
router.post('/create/:areaId', async (req, res) => {
    try {
        const areaId = req.params.areaId;

        await BarnModel.create({
            name: req.body.name,
            acreage: req.body.acreage,
            maximumCapacity: Number(req.body.maximumCapacity),
            status: req.body.status,
            creationDate: new Date(req.body.creationDate),
            note: req.body.note,
            area: areaId
        });

        res.json({ success: true });

    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, error: err });
    }
});

// load data to edit
router.get("/detail/:id", async (req, res) => {
    const barn = await BarnModel.findById(req.params.id);
    res.json(barn);
});

// edit a barn
router.put("/update/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            acreage,
            maximumCapacity,
            status,
            creationDate,
            note
        } = req.body;

        const updatedData = {
            name,
            acreage,
            maximumCapacity: Number(maximumCapacity),
            status,
            creationDate: new Date(creationDate),
            note
        };

        // Lấy barn cũ để biết areaId
        const oldBarn = await BarnModel.findById(id);

        await BarnModel.findByIdAndUpdate(id, updatedData);

        res.json({ success: true, areaId: oldBarn.area });

    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, error: err });
    }
});

// delete a barn
router.delete('/delete/:id', async (req, res) => {
    try {
        const barn = await BarnModel.findById(req.params.id);

        if (!barn) {
            return res.status(404).json({ success: false, message: "Barn not found" });
        }

        await BarnModel.findByIdAndDelete(req.params.id);

        res.json({ 
            success: true,
            areaId: barn.area   // để frontend biết reload đúng khu
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "Delete failed" });
    }
});

// get barn detail
router.get('/info/:barnId', async (req, res) => {
    try {
        const barnId = req.params.barnId;

        // lấy thông tin barn
        const barn = await BarnModel.findById(barnId).lean();

        if (!barn) {
            return res.status(404).send("Barn not found");
        }

        // nếu bạn có đàn (herd) trong chuồng thì lấy luôn:
        const herds = await HerdModel.find({ barn: barnId }).lean();

        res.render("barn/detail", { barn, herds });

    } catch (err) {
        console.log(err);
        res.status(500).send("Error loading barn info");
    }
});

// get investment cost of a barn
router.get("/:barnId/investment", async (req, res) => {
    try {
        const barnId = req.params.barnId;

        const investment = await InvestmentCostModel.findOne({ barn: barnId }).lean();

        if (!investment) {
            return res.json({
                breeding_cost: 0,
                food_cost: 0,
                medition_cost: 0,
                total: 0
            });
        }

        res.json(investment);

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Cannot load investment data" });
    }
});

// GET: lấy BarnHealth newest cho 1 barn
router.get('/:barnId/health', async (req, res) => {
  try {
    const barnId = req.params.barnId;

    // get the lastest record
    const health = await BarnHealthModel.findOne({ barn: barnId })
      .sort({ dateOfInspection: -1 })
      .lean();

    if (!health) {
      return res.json({
        dateOfInspection: null,
        averageWeight: null,
        loss: null,
        faecesStatus: null,
        note: null
      });
    }

    res.json(health);
  } catch (err) {
    console.error('Error loading barn health:', err);
    res.status(500).json({ error: 'Cannot load barn health data' });
  }
});

/* -------- Xử lý lợn -------- */

// get all herd to select
router.get('/:barnId/herd-list', async (req, res) => {
  const list = await BarnHerdDetailModel.find({ barn: req.params.barnId })
    .populate("herd")
    .lean();

  res.json(list);
});

// get herd list to select
router.get("/herd-list", async (req, res) => {
  try {
    const herds = await HerdModel.find({}).lean();
    res.json(herds);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy danh sách herd", error: err });
  }
});

// Thêm đàn lợn vào chuồng
router.post('/import-herd', async (req, res) => {
  try {
    const { herdId, barnId, importQuantity, herdCode, avgWeight, importDate, note } = req.body;

    console.log(herdId, barnId, importQuantity + req.body);

    if (!herdId || !barnId || !importQuantity || importQuantity <= 0) {
      return res.status(400).json({ message: "Thiếu thông tin hoặc số lượng không hợp lệ" });
    }

    // Tìm herd và barn
    const herd = await HerdModel.findById(herdId);
    const barn = await BarnModel.findById(barnId);

    if (!herd || !barn) {
      return res.status(404).json({ message: "Không tìm thấy herd hoặc barn" });
    }

    // Kiểm tra tồn kho herd
    if (herd.inventory < importQuantity) {
      return res.status(400).json({ message: "Số lượng nhập vượt quá tồn kho hiện có" });
    }

    // Kiểm tra sức chứa chuồng
    const currentTotal = barn.total_pigs || 0;
    const newTotal = Number(currentTotal) + Number(importQuantity);

    console.log('total_pigs: ' + barn.total_pigs);
    console.log('importQuantity: ' + importQuantity);
    console.log('newTotal: ' + newTotal);

    if (newTotal > barn.maximumCapacity) {
      return res.status(400).json({ message: "Chuồng đã đạt hoặc vượt sức chứa tối đa" });
    }

    // TÌM xem herd này đã tồn tại trong chuồng hay chưa
    let barnHerdDetail = await BarnHerdDetailModel.findOne({
      barn: barnId,
      herd: herdId,
    });

    if (barnHerdDetail) {
      // Herd đã tồn tại -> không tạo herdCode mới!
      barnHerdDetail.importQuantity += Number(importQuantity);
      
    } else {
      // Herd chưa tồn tại -> phải tạo herdCode mới
      let finalHerdCode = herdCode;

      // Nếu người dùng KHÔNG nhập -> tự động sinh H000, H001,...
      if (!finalHerdCode || finalHerdCode.trim() === "") {
        const countExisting = await BarnHerdDetailModel.countDocuments({ barn: barnId });
        finalHerdCode = "H" + String(countExisting).padStart(3, "0");
      }

      // Tạo record mới
      barnHerdDetail = new BarnHerdDetailModel({
        barn: barnId,
        herd: herdId,
        herdCode: finalHerdCode,
        sex: herd.sex,
        importQuantity: importQuantity,
        avgWeight: avgWeight,
        importDate: importDate ? new Date(importDate) : new Date(),
        note: note || "",
      });
    }

    // Cập nhật tồn kho herd
    herd.inventory -= importQuantity;

    // Cập nhật tổng số heo trong chuồng
    barn.total_pigs = newTotal;

    calculateAndSavePigImportCost(barn, herd, importQuantity);

    // Gán chuồng cho các con heo thuộc herd theo số lượng nhập
    const pigsToAssign = await PigModel.find({
      herd: herdId,
      $or: [{ barn: null }, { barn: { $exists: false } }],
      isDeleted: false,
    })
      .sort({ tag: 1 }) // ưu tiên tag nhỏ trước
      .limit(importQuantity);

    if (pigsToAssign.length < importQuantity) {
      return res.status(400).json({
        message: `Không đủ lợn thuộc herd này để gán chuồng (chỉ còn ${pigsToAssign.length} con).`,
      });
    }

    // Gán barnId cho các con heo lấy được
    const pigIds = pigsToAssign.map(p => p._id);
    await PigModel.updateMany(
      { _id: { $in: pigIds } },
      { $set: { barn: barnId } }
    );

    await Promise.all([
      barnHerdDetail.save(),
      herd.save(),
      barn.save(),
    ]);

    return res.status(200).json({
      message: "Nhập đàn vào chuồng thành công",
      data: barnHerdDetail,
    });

  } catch (error) {
    console.error("Lỗi khi nhập herd vào barn:", error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
});

// Load barnHerdDetail data to show in popup edit
router.get("/herd-detail/:id", async (req, res) => {
    try {
        const detail = await BarnHerdDetailModel.findById(req.params.id)
            .populate("herd")
            .populate("barn")
            .lean();

        if (!detail) {
            return res.status(404).json({ message: "Không tìm thấy bản ghi nhập đàn" });
        }

        res.json(detail);
    } catch (err) {
        console.error("Error get herd detail:", err);
        res.status(500).json({ message: "Lỗi server", error: err.message });
    }
});

// Update herd in a barn
router.put("/update-herd/:barnHerdDetailId", async (req, res) => {
    try {
        const { barnHerdDetailId } = req.params;
        const { newQuantity, avgWeight, note, date } = req.body;

        console.log('newQuantity:', newQuantity);

        if (newQuantity == null || newQuantity < 0) {
            return res.status(400).json({ message: "Số lượng mới không hợp lệ" });
        }

        // Lấy bản ghi + herd + barn
        const barnHerdDetail = await BarnHerdDetailModel.findById(barnHerdDetailId)
            .populate("barn")
            .populate("herd");

        if (!barnHerdDetail) {
            return res.status(404).json({ message: "Không tìm thấy bản ghi nhập đàn" });
        }

        const oldQuantity = barnHerdDetail.importQuantity;
        const herd = barnHerdDetail.herd;
        const barn = barnHerdDetail.barn;

        const diff = newQuantity - oldQuantity; // chênh lệch số lượng

        // tính giá tiền ở đây
        calculateAndSavePigUpdateCost(barn, herd, diff);

        //  TĂNG SỐ LƯỢNG – diff > 0
        if (diff > 0) {

            if (herd.inventory < diff) {
                return res.status(400).json({
                    message: "Không đủ tồn kho để tăng số lượng"
                });
            }

            const totalAfter = (barn.total_pigs || 0) + diff;
            if (barn.maximumCapacity && totalAfter > barn.maximumCapacity) {
                return res.status(400).json({
                    message: "Chuồng không đủ chỗ cho số lượng tăng thêm"
                });
            }

            // Lấy lợn chưa thuộc chuồng theo tag tăng dần
            const pigsToAssign = await PigModel.find({
                herd: herd._id,
                $or: [{ barn: null }, { barn: { $exists: false } }],
                isDeleted: false
            })
                .sort({ tag: 1 })
                .limit(diff);

            if (pigsToAssign.length < diff) {
                return res.status(400).json({
                    message: `Không đủ lợn để gán (còn ${pigsToAssign.length})`
                });
            }

            // Gán chuồng
            await PigModel.updateMany(
                { _id: { $in: pigsToAssign.map(p => p._id) } },
                { $set: { barn: barn._id } }
            );

            // Update herd & barn & record
            herd.inventory -= diff;
            barn.total_pigs += diff;
        }

        //  GIẢM SỐ LƯỢNG – diff < 0
        else if (diff < 0) {
            const absDiff = Math.abs(diff);

            // Lấy lợn đang trong chuồng, ưu tiên tag cao nhất
            const pigsToRemove = await PigModel.find({
                herd: herd._id,
                barn: barn._id,
                isDeleted: false
            })
                .sort({ tag: -1 })
                .limit(absDiff);

            pigsToRemove.forEach(pig => {
              console.log(JSON.stringify(pig, null, 2));
            });

            // Gỡ chuồng
            await PigModel.updateMany(
                { _id: { $in: pigsToRemove.map(p => p._id) } },
                { $set: { barn: null } }
            );

            herd.inventory += absDiff;
            barn.total_pigs -= absDiff;
        }

        //  CẬP NHẬT THÔNG TIN KHÁC
        barnHerdDetail.importQuantity = newQuantity;
        barnHerdDetail.avgWeight = avgWeight ?? barnHerdDetail.avgWeight;
        barnHerdDetail.note = note ?? barnHerdDetail.note;
        barnHerdDetail.importDate = date ? new Date(date) : barnHerdDetail.importDate;

        await Promise.all([herd.save(), barn.save(), barnHerdDetail.save()]);

        res.status(200).json({
            message: "Cập nhật đàn thành công",
            data: barnHerdDetail,
        });

    } catch (error) {
        console.error("Lỗi khi cập nhật đàn:", error);
        res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
});

// Tách đàn
router.post('/split', async (req, res) => {
  try {
    const { fromBarnHerdDetailId, toBarnId, quantity, tags, avgWeight } = req.body;

    if (!fromBarnHerdDetailId || !toBarnId) {
      return res.status(400).json({ message: "Thiếu thông tin yêu cầu" });
    }

    // Lấy dữ liệu bản ghi nguồn
    const fromDetail = await BarnHerdDetailModel.findById(fromBarnHerdDetailId)
      .populate("barn")
      .populate("herd");

    if (!fromDetail) {
      return res.status(404).json({ message: "Không tìm thấy đàn nguồn" });
    }

    const fromBarn = fromDetail.barn;
    const herd = fromDetail.herd;
    const toBarn = await BarnModel.findById(toBarnId);

    if (!toBarn) {
      return res.status(404).json({ message: "Không tìm thấy chuồng đích" });
    }

    calculateAndSavePigUpdateCost(fromBarn, herd, quantity);
    calculateAndSavePigSplitCost(toBarn, herd, quantity);

    let pigsToMove = [];

    // ==============================
    //  TÁCH THEO TAG
    // ==============================
    if (tags && tags.length > 0) {
      pigsToMove = await PigModel.find({
        tag: { $in: tags },
        herd: herd._id,
        barn: fromBarn._id,
        isDeleted: false,
      });

      if (pigsToMove.length !== tags.length) {
        return res.status(400).json({
          message: "Một vài tag không tồn tại trong đàn hoặc không ở đúng chuồng"
        });
      }
    }

    // ==============================
    //  TÁCH THEO SỐ LƯỢNG
    // ==============================
    else if (quantity > 0) {
      if (fromDetail.importQuantity < quantity) {
        return res.status(400).json({
          message: "Số lượng tách vượt quá số lượng trong đàn"
        });
      }

      pigsToMove = await PigModel.find({
        herd: herd._id,
        barn: fromBarn._id,
        isDeleted: false
      })
        .sort({ tag: 1 })
        .limit(quantity);
    }

    else {
      return res.status(400).json({
        message: "Cần nhập danh sách tags hoặc quantity"
      });
    }

    const moveCount = pigsToMove.length;

    // ==============================
    // KIỂM TRA SỨC CHỨA ĐÍCH
    // ==============================
    const totalAfter = (toBarn.total_pigs || 0) + moveCount;
    if (toBarn.maximumCapacity && totalAfter > toBarn.maximumCapacity) {
      return res.status(400).json({
        message: "Chuồng đích không đủ chỗ"
      });
    }

    // ==============================
    //  CẬP NHẬT PIGS
    // ==============================
    await PigModel.updateMany(
      { _id: { $in: pigsToMove.map(p => p._id) } },
      { $set: { barn: toBarn._id } }
    );

    // ==============================
    //  CẬP NHẬT ĐÀN NGUỒN
    // ==============================
    fromDetail.importQuantity -= moveCount;

    // ==============================
    //  CẬP NHẬT ĐÀN ĐÍCH
    // ==============================
    let toDetail = await BarnHerdDetailModel.findOne({
      barn: toBarn._id,
      herd: herd._id
    });

    const avgNew = Number(avgWeight) > 0 ? Number(avgWeight) : fromDetail.avgWeight;

    if (toDetail) {
      // Công thức tính avgWeight mới
      const newAvgWeight =
        (toDetail.importQuantity * toDetail.avgWeight +
         moveCount * avgNew) /
        (toDetail.importQuantity + moveCount);

      toDetail.avgWeight = newAvgWeight;
      toDetail.importQuantity += moveCount;

    } else {
      let count = await BarnHerdDetailModel.countDocuments();
      count = count - 1;
      const newHerdCode = "H" + String(count).padStart(3, "0");

      // Nếu chưa có record thì tạo mới
      toDetail = new BarnHerdDetailModel({
        herdCode: newHerdCode,
        barn: toBarn._id,
        herd: herd._id,
        herdName: fromDetail.herdName,
        sex: fromDetail.sex,
        importQuantity: moveCount,
        avgWeight: avgNew,
        date: new Date()
      });
    }

    // ==============================
    //  CẬP NHẬT total pigs
    // ==============================
    fromBarn.total_pigs -= moveCount;
    toBarn.total_pigs += moveCount;

    // Lưu tất cả thay đổi
    await Promise.all([
      fromDetail.save(),
      toDetail.save(),
      fromBarn.save(),
      toBarn.save()
    ]);

    // Xóa record nguồn nếu hết đàn
    if (fromDetail.importQuantity <= 0) {
      await BarnHerdDetailModel.findByIdAndDelete(fromDetail._id);
    }

    return res.status(200).json({
      message: "Tách đàn thành công",
      movedCount: moveCount,
      movedTags: pigsToMove.map(p => p.tag),
      avgWeightUsed: avgNew,
      fromBarn: fromBarn.name,
      toBarn: toBarn.name
    });

  } catch (error) {
    console.error("Lỗi khi tách đàn:", error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
});

// router.post('/split', async (req,res) => {
//   try {
//     const { fromBarnHerdDetailId, toBarnId, quantity, tags } = req.body;

//     if (!fromBarnHerdDetailId || !toBarnId) {
//       return res.status(400).json({ message: "Thiếu thông tin yêu cầu" });
//     }

//     // Lấy dữ liệu bản ghi nguồn
//     const fromDetail = await BarnHerdDetailModel.findById(fromBarnHerdDetailId)
//       .populate("barn")
//       .populate("herd");

//     if (!fromDetail) {
//       return res.status(404).json({ message: "Không tìm thấy đàn nguồn" });
//     }

//     const fromBarn = fromDetail.barn;
//     const herd = fromDetail.herd;
//     const toBarn = await BarnModel.findById(toBarnId);

//     if (!toBarn) {
//       return res.status(404).json({ message: "Không tìm thấy chuồng đích" });
//     }

//     // XỬ LÝ TÁCH THEO TAG (ĐÍCH DANH)
//     let pigsToMove = [];

//     if (tags && tags.length > 0) {
//       // Lấy pigs theo danh sách tag
//       pigsToMove = await PigModel.find({
//         tag: { $in: tags },
//         herd: herd._id,
//         barn: fromBarn._id,
//         isDeleted: false,
//       });

//       if (pigsToMove.length !== tags.length) {
//         return res.status(400).json({ 
//           message: "Một vài tag không tồn tại trong đàn hoặc không ở đúng chuồng" 
//         });
//       }
//     }
//     // TÁCH TỰ ĐỘNG THEO SỐ LƯỢNG
//     else if (quantity > 0) {
//       if (fromDetail.importQuantity < quantity) {
//         return res.status(400).json({
//           message: "Số lượng tách vượt quá số lượng trong đàn"
//         });
//       }
//       pigsToMove = await PigModel.find({
//         herd: herd._id,
//         barn: fromBarn._id,
//         isDeleted: false
//       })
//         .sort({ tag: 1 })      // lấy tag bé nhất
//         .limit(quantity);
//     } 
//     else {
//       return res.status(400).json({
//         message: "Cần nhập danh sách tags hoặc quantity"
//       });
//     }

//     const moveCount = pigsToMove.length;

//     // KIỂM TRA SỨC CHỨA CHUỒNG ĐÍCH
//     const totalAfter = (toBarn.total_pigs || 0) + moveCount;
//     if (toBarn.maximumCapacity && totalAfter > toBarn.maximumCapacity) {
//       return res.status(400).json({
//         message: "Chuồng đích không đủ chỗ"
//       });
//     }

//     // CẬP NHẬT PIGS
//     await PigModel.updateMany(
//       { _id: { $in: pigsToMove.map(p => p._id) } },
//       { $set: { barn: toBarn._id } }
//     );

//     // CẬP NHẬT BarnHerdDetail và giảm ở chuồng nguồn
//     fromDetail.importQuantity -= moveCount;

//     // Tạo hoặc cập nhật ở chuồng đích
//     let toDetail = await BarnHerdDetailModel.findOne({
//       barn: toBarn._id,
//       herd: herd._id
//     });

//     if (toDetail) {
//       toDetail.importQuantity += moveCount;
//     } else {
//       toDetail = new BarnHerdDetailModel({
//         barn: toBarn._id,
//         herd: herd._id,
//         herdName: fromDetail.herdName,
//         sex: fromDetail.sex,
//         importQuantity: moveCount,
//         date: new Date()
//       });
//     }

//     // CẬP NHẬT TOTAL PIGS
//     fromBarn.total_pigs -= moveCount;
//     toBarn.total_pigs += moveCount;

//     // Lưu dữ liệu
//     await Promise.all([
//       fromDetail.save(),
//       toDetail.save(),
//       fromBarn.save(),
//       toBarn.save()
//     ]);

//     // Nếu chuồng nguồn hết đàn → xóa record
//     if (fromDetail.importQuantity <= 0) {
//       await BarnHerdDetailModel.findByIdAndDelete(fromDetail._id);
//     }

//     return res.status(200).json({
//       message: "Tách đàn thành công",
//       mode: tags ? "Theo danh sách tags" : "Tự động theo số lượng",
//       movedCount: moveCount,
//       movedTags: pigsToMove.map(p => p.tag),
//       fromBarn: fromBarn.name,
//       toBarn: toBarn.name
//     });

//   } catch (error) {
//     console.error("Lỗi khi tách đàn:", error);
//     res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
//   }
// });

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

    // tính tiền
    calculateAndSavePigUpdateCost(barn, herd, barnHerdDetail.importQuantity);

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
    herd.inventory += barnHerdDetail.importQuantity;

    // Giảm tổng số heo trong chuồng
    barn.total_pigs = Math.max((barn.total_pigs || 0) - barnHerdDetail.importQuantity, 0);

    // GỠ barn của tất cả pigs thuộc herd trong chuồng này
    await PigModel.updateMany(
      {
        herd: herd._id,
        barn: barn._id,
        isDeleted: false
      },
      { $set: { barn: null } }
    );

    // tính giá tiền ở đây

    // Lưu herd + barn
    await Promise.all([herd.save(), barn.save()]);

    // Xóa record trong BarnHerdDetail
    await BarnHerdDetailModel.findByIdAndDelete(barnHerdDetailId);

    return res.status(200).json({
      message: "Thu hồi đàn + gỡ pigs + xóa bản ghi thành công",
      data: {
        herdName: barnHerdDetail.herdName,
        importQuantity: barnHerdDetail.importQuantity,
        barn: barn.name,
        status: "Đã thu hồi và xóa",
      },
    });

  } catch (error) {
    console.error("Lỗi khi thu hồi đàn:", error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
});

// Lấy danh sách pigs theo HerdDetail (herd + barn)
router.get("/pigs/:barnHerdDetailId", async (req, res) => {
  try {
    const { barnHerdDetailId } = req.params;

    const detail = await BarnHerdDetailModel.findById(barnHerdDetailId)
      .populate("herd")
      .populate("barn");

    if (!detail) {
      return res.status(404).json({ message: "Không tìm thấy thông tin herd trong chuồng" });
    }

    // Lấy pig theo herd + barn
    const pigs = await PigModel.find({
      herd: detail.herd._id,
      barn: detail.barn._id,
      isDeleted: false
    }).lean();

    return res.json({
      herdName: detail.herdName,
      total: pigs.length,
      pigs
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});




module.exports = router;