const express = require('express');
const router = express.Router();
const InvoiceModel = require('../models/Invoice'); 
const OffSpringModel = require('../models/OffSpring'); 
const FoodWareHouseModel = require('../models/FoodWareHouse'); 
const MeditionWareHouseModel = require('../models/MeditionWareHouse'); 

router.get("/", async (req, res) => {
  try {
    const invoices = await InvoiceModel.find()
      .populate("supplier") // lấy thông tin nhà cung cấp (nếu cần)
      .exec();

    res.status(200).json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.post('/add', async (req, res) => {
  try {
    const { items, discount, creation_date, payment_status, supplier } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invoice must have at least one item" });
    }

    // Tạo invoice
    const invoice = await InvoiceModel.create({
      items,
      discount,
      creation_date,
      payment_status,
      supplier
    });

    // Cập nhật tồn kho cho từng item
    for (const item of items) {
      const { type, refId, quantity } = item;

      switch (type) {
        case "Con giống":
          await OffSpringModel.findByIdAndUpdate(
            refId,
            { $inc: { inventory: quantity }, invoice: invoice._id },
            { new: true }
          );
          break;

        case "Thức ăn":
          await FoodWareHouseModel.findByIdAndUpdate(
            refId,
            { $inc: { inventory: quantity }, invoice: invoice._id },
            { new: true }
          );
          break;

        case "Thuốc":
          await MeditionWareHouseModel.findByIdAndUpdate(
            refId,
            { $inc: { inventory: quantity }, invoice: invoice._id },
            { new: true }
          );
          break;

        default:
          throw new Error(`Invalid item type: ${type}`);
      }
    }

    res.status(201).json({
      message: "Invoice created and inventories updated successfully",
      invoice
    });
  } catch (err) {
    console.error("Error creating invoice:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/edit/:id', async (req, res) =>{
try {
    const { id } = req.params;
    const updatedData = req.body;

    // 1. Lấy invoice cũ
    const oldInvoice = await InvoiceModel.findById(id);
    if (!oldInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // 2. Xử lý item cũ: nếu không còn trong updatedData => trừ tồn kho
    for (const oldItem of oldInvoice.items) {
      const stillExists = updatedData.items.find(
        (newItem) =>
          newItem.refId.toString() === oldItem.refId.toString() &&
          newItem.type === oldItem.type
      );

      if (!stillExists) {
        // Item bị xóa → trừ tồn kho
        if (oldItem.type === "Con giống") {
          await OffSpringModel.findByIdAndUpdate(oldItem.refId, {
            $inc: { inventory: -oldItem.quantity },
          });
        } else if (oldItem.type === "Thức ăn") {
          await FoodWareHouseModel.findByIdAndUpdate(oldItem.refId, {
            $inc: { inventory: -oldItem.quantity },
          });
        } else if (oldItem.type === "Thuốc") {
          await MeditionWareHouseModel.findByIdAndUpdate(oldItem.refId, {
            $inc: { inventory: -oldItem.quantity },
          });
        }
      }
    }

    // 3. Update invoice trong DB
    const invoice = await InvoiceModel.findByIdAndUpdate(id, updatedData, {
      new: true,
    });

    // 4. Xử lý item mới hoặc thay đổi số lượng
    for (const newItem of updatedData.items) {
      // Tìm item cũ để biết chênh lệch số lượng
      const oldItem = oldInvoice.items.find(
        (o) =>
          o.refId.toString() === newItem.refId.toString() &&
          o.type === newItem.type
      );

      let diff = newItem.quantity;
      if (oldItem) {
        diff = newItem.quantity - oldItem.quantity; // chỉ cộng/trừ phần chênh lệch
      }

      if (diff !== 0) {
        if (newItem.type === "Con giống") {
          await OffSpringModel.findByIdAndUpdate(newItem.refId, {
            $inc: { inventory: diff },
          });
        } else if (newItem.type === "Thức ăn") {
          await FoodWareHouseModel.findByIdAndUpdate(newItem.refId, {
            $inc: { inventory: diff },
          });
        } else if (newItem.type === "Thuốc") {
          await MeditionWareHouseModel.findByIdAndUpdate(newItem.refId, {
            $inc: { inventory: diff },
          });
        }
      }
    }
    res.status(200).json({
      message: "Invoice and inventories updated successfully",
      invoice,
    });
  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({ error: "Failed to update invoice" });
  }
});



module.exports = router;
