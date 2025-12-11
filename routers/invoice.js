const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const InvoiceModel = require('../models/Invoice'); 
const HerdModel = require('../models/Herd');
const PigModel = require('../models/Pig'); 
const FoodWareHouseModel = require('../models/FoodWareHouse'); 
const MeditionWareHouseModel = require('../models/MeditionWareHouse'); 
const SupplierModel = require('../models/Supplier'); 

// get all invoice
router.get("/", async (req, res) => {
  try {
    //const invoices = await InvoiceModel.find({isDelete: false})
    const invoices = await InvoiceModel.find({})
      .populate("supplier") // lấy thông tin nhà cung cấp (nếu cần)
      .exec();

    res.render('invoice/index', {
      title: "Invoice",
      active: "invoice",
      items: invoices
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

// get to load to options
router.get("/options", async (req, res) => {
  try {
    const suppliers = await SupplierModel.find().select("_id name");
    const herds = await HerdModel.find().select("_id name");
    const foods = await FoodWareHouseModel.find().select("_id name");
    const meds = await MeditionWareHouseModel.find().select("_id name");

    res.json({ suppliers, herds, foods, meds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load options" });
  }
});

// create an invoice
router.post('/create', async (req, res) => {
  try {
    const { name, items, discount, totalFinal, creation_date, payment_status, supplier } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invoice must have at least one item" });
    }

    // Tính total_price cho từng item
    const updatedItems = items.map(item => ({
      ...item,
      total_price: item.price * item.quantity
    }));

    // // Tính tổng hóa đơn (chưa trừ discount)
    // const totalRaw = updatedItems.reduce((sum, item) => sum + item.total_price, 0);

    // Tổng sau khi trừ discount
    // const totalFinal = totalRaw - (discount || 0);

    // Tạo invoice
    const invoice = await InvoiceModel.create({
      name,
      items: updatedItems,
      discount,
      total: totalFinal,
      creation_date,
      payment_status,
      supplier
    });

    // Xử lý từng item
    for (const item of updatedItems) {
      const { type, refId, quantity, total_price } = item;

      switch (type) {
        case "Herd": {
          const herd = await HerdModel.findByIdAndUpdate(
            refId,
            {
              $set: {
                inventory: quantity,
                originalInventory: quantity,
                importPrice: total_price,
                dateOfEntry: new Date(creation_date),
                invoice: invoice._id
              }
            },
            { new: true }
          );

          if (!herd) throw new Error(`Herd not found: ${refId}`);

          // AUTO GENERATE PIGS
          const pigsToCreate = [];
          const entryDate = new Date(herd.dateOfEntry || Date.now());
          const yyyyMMdd = entryDate.toISOString().slice(0, 10).replace(/-/g, "");

          for (let i = 1; i <= quantity; i++) {
            const seqStr = i.toString().padStart(3, "0");

            pigsToCreate.push({
              tag: `PIG-${yyyyMMdd}-${seqStr}`,
              birthDate: herd.dateOfEntry || Date.now(),
              sex: herd.sex === "mixed" ? "boar" : herd.sex,
              vaccination: herd.vaccination,
              status: "alive",
              herd: refId
            });
          }

          await PigModel.insertMany(pigsToCreate);
          break;
        }

        case "Food":
          await FoodWareHouseModel.findByIdAndUpdate(
            refId,
            {
              $inc: { inventory: quantity },
              original_inventory: quantity,
              import_price: total_price,
              invoice: invoice._id
            }
          );
          break;

        case "Medition":
          await MeditionWareHouseModel.findByIdAndUpdate(
            refId,
            {
              $inc: { inventory: quantity },
              original_inventory: quantity,
              import_price: total_price,
              invoice: invoice._id
            }
          );
          break;

        default:
          throw new Error(`Invalid item type: ${type}`);
      }
    }

    res.status(201).json({
      message: "Invoice created successfully",
      invoice
    });

  } catch (err) {
    console.error("Error creating invoice:", err);
    res.status(500).json({ error: err.message });
  }
});

// delete an invoice
router.put("/delete/:id", async (req, res) => {
  try {
    const invoice = await InvoiceModel.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // 1. Check điều kiện xóa: phải <= 2 ngày
    const now = new Date();
    const created = new Date(invoice.creation_date);
    const diffDays = (now - created) / (1000 * 60 * 60 * 24);

    if (diffDays > 2) {
      return res.status(400).json({
        error: `This invoice can only be deleted after 2 days. (${(2 - diffDays).toFixed(1)} days remaining)`
      });
    }

    // --- 2. Rollback theo từng item trong invoice ---
    for (const item of invoice.items) {
      const { refId, type } = item;

      // Rollback đối với Herd
      if (type === "Herd") {
        // 2.1 Reset lại herd
        await HerdModel.findById(
          refId,
          // {
          //   inventory: 0,
          //   original_inventory: 0,
          //   importPrice: 0,
          //   invoice: null,
          //   dateOfEntry: null
          // }
        );
        // 2.2 Xóa tất cả pigs thuộc herd này
        await PigModel.deleteMany({ herd: refId });
      }

      // Rollback đối với Food
      // if (type === "Food") {
      //   await FoodWareHouseModel.findByIdAndUpdate(
      //     refId,
      //     {
      //       inventory: 0,
      //       original_inventory: 0,
      //       import_price: 0,
      //       invoice: null
      //     }
      //   );
      // }

      // Rollback đối với Medition
      // if (type === "Medition") {
      //   await MeditionWareHouseModel.findByIdAndUpdate(
      //     refId,
      //     {
      //       inventory: 0,
      //       original_inventory: 0,
      //       import_price: 0,
      //       invoice: null
      //     }
      //   );
      // }
    }

    // --- 3. Soft delete invoice ---
    invoice.isDelete = true;
    await invoice.save();

    res.json({
      message: "Invoice deleted successfully (soft delete + rollback applied).",
      invoice
    });

  } catch (err) {
    console.error("Delete invoice error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// get invoice detail 
router.get("/:id", async (req, res) => {
  try {
    const invoice = await InvoiceModel
      .findById(req.params.id)
      .populate("supplier")   // Lấy supplier name
      .lean();

    if (!invoice) {
      return res.status(404).render("404", { message: "Invoice not found" });
    }

    // Tách refId theo từng loại
    const herdIds = invoice.items.filter(i => i.type === "Herd").map(i => i.refId);
    const foodIds = invoice.items.filter(i => i.type === "Food").map(i => i.refId);
    const medIds  = invoice.items.filter(i => i.type === "Medition").map(i => i.refId);

    // Lấy dữ liệu theo loại
    const herds = await HerdModel.find({ _id: { $in: herdIds }}).lean();
    const foods = await FoodWareHouseModel.find({ _id: { $in: foodIds }}).lean();
    const meds  = await MeditionWareHouseModel.find({ _id: { $in: medIds }}).lean();

    // Gắn dữ liệu đầy đủ vào từng item
    invoice.items = invoice.items.map(item => {
      if (item.type === "Herd") {
        item.refData = herds.find(h => h._id.toString() === item.refId.toString()) || null;
      } else if (item.type === "Food") {
        item.refData = foods.find(f => f._id.toString() === item.refId.toString()) || null;
      } else if (item.type === "Medition") {
        item.refData = meds.find(m => m._id.toString() === item.refId.toString()) || null;
      }

      // đảm bảo không bị undefined ở view
      item.discount = item.discount || 0;

      return item;
    });

    res.render("invoice/detail", {
      title: "Invoice Detail",
      invoice
    });

  } catch (err) {
    console.error(err);
    res.status(500).render("500", { message: "Server error" });
  }
});

// router.put('/edit/:id', async (req, res) =>{
// try {
//     const { id } = req.params;
//     const updatedData = req.body;

//     // 1. Lấy invoice cũ
//     const oldInvoice = await InvoiceModel.findById(id);
//     if (!oldInvoice) {
//       return res.status(404).json({ message: "Invoice not found" });
//     }

//     // 2. Xử lý item cũ: nếu không còn trong updatedData => trừ tồn kho
//     for (const oldItem of oldInvoice.items) {
//       const stillExists = updatedData.items.find(
//         (newItem) =>
//           newItem.refId.toString() === oldItem.refId.toString() &&
//           newItem.type === oldItem.type
//       );

//       if (!stillExists) {
//         // Item bị xóa → trừ tồn kho
//         if (oldItem.type === "Con giống") {
//           await OffSpringModel.findByIdAndUpdate(oldItem.refId, {
//             $inc: { inventory: -oldItem.quantity },
//           });
//         } else if (oldItem.type === "Thức ăn") {
//           await FoodWareHouseModel.findByIdAndUpdate(oldItem.refId, {
//             $inc: { inventory: -oldItem.quantity },
//           });
//         } else if (oldItem.type === "Thuốc") {
//           await MeditionWareHouseModel.findByIdAndUpdate(oldItem.refId, {
//             $inc: { inventory: -oldItem.quantity },
//           });
//         }
//       }
//     }

//     // 3. Update invoice trong DB
//     const invoice = await InvoiceModel.findByIdAndUpdate(id, updatedData, {
//       new: true,
//     });

//     // 4. Xử lý item mới hoặc thay đổi số lượng
//     for (const newItem of updatedData.items) {
//       // Tìm item cũ để biết chênh lệch số lượng
//       const oldItem = oldInvoice.items.find(
//         (o) =>
//           o.refId.toString() === newItem.refId.toString() &&
//           o.type === newItem.type
//       );

//       let diff = newItem.quantity;
//       if (oldItem) {
//         diff = newItem.quantity - oldItem.quantity; // chỉ cộng/trừ phần chênh lệch
//       }

//       if (diff !== 0) {
//         if (newItem.type === "Con giống") {
//           await OffSpringModel.findByIdAndUpdate(newItem.refId, {
//             $inc: { inventory: diff },
//           });
//         } else if (newItem.type === "Thức ăn") {
//           await FoodWareHouseModel.findByIdAndUpdate(newItem.refId, {
//             $inc: { inventory: diff },
//           });
//         } else if (newItem.type === "Thuốc") {
//           await MeditionWareHouseModel.findByIdAndUpdate(newItem.refId, {
//             $inc: { inventory: diff },
//           });
//         }
//       }
//     }
//     res.status(200).json({
//       message: "Invoice and inventories updated successfully",
//       invoice,
//     });
//   } catch (error) {
//     console.error("Error updating invoice:", error);
//     res.status(500).json({ error: "Failed to update invoice" });
//   }
// });

module.exports = router;
