var express = require('express');
var router = express.Router();
const multer = require("multer");
const AreaModel = require('../models/Area');
const BarnModel = require('../models/Barn');
const PigModel = require('../models/Pig');
const InvestmentCost = require('../models/InvestmentCost');
const CustomerModel = require('../models/Customer');
const SellPigModel = require('../models/SellPig');
const SellPigDetailModel = require('../models/SellPigDetail');
const BarnHerdDetailModel = require('../models/BarnHerdDetail');

// route render UI
router.get('/', async (req,res) => {
    try {
        const invoices = await SellPigModel
            .find()
            .populate("customer")     // lấy tên khách hàng
            .sort({ exportDate: -1 }) // mới nhất trước
            .lean();

        res.render('sellpigs/index', {
            title: "Sale invoice management",
            active: "saleInvoiceManagement",
            invoices
        })
        
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Cannot load invoices" });
    }
});

// get invoice detail
router.get('/detail/:id', async(req,res) => {
    try {
        // Lấy thông tin SellPig (thông tin hóa đơn)
        const invoice = await SellPigModel.findById(req.params.id)
            .populate("customer")
            .lean();

        if (!invoice) {
            return res.render("sellpigs/detail-invoice", {
                error: "Invoice not found",
                details: []
            });
        }

        // Lấy các dòng SellPigDetail của invoice này
        const details = await SellPigDetailModel.find({ invoice: req.params.id })
            .populate("barn")
            .lean();

        // Render template
        res.render("sellpigs/detail-invoice", {
            title: "Invoice detail",
            invoice,
            details
        });

    } catch (error) {
        console.error(error);
        res.render("sell-pigs/detail", {
            error: "An error occurred",
            details: []
        });
    }
});

// get all barns belong to area type Fattening
router.get("/list-barn", async (req, res) => {
    try {
        // Lấy tất cả khu Fattening
        const fatteningAreas = await AreaModel.find({ type: "Fattening" }).select("_id");

        if (fatteningAreas.length === 0) {
            return res.json([]);
        }

        // Lấy chuồng thuộc các khu đó
        const barns = await BarnModel.find({
            area: { $in: fatteningAreas }
        }).populate("area");
            
        res.json(barns);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// get price per pig in a barn
router.get("/:barnId/price-per-pig", async (req, res) => {
    try {
        const { barnId } = req.params;

        // Lấy thông tin chuồng
        const barn = await BarnModel.findById(barnId);
        if (!barn) return res.status(404).json({ message: "Barn not found" });

        // Lấy InvestmentCost theo chuồng
        const cost = await InvestmentCost.findOne({ barn: barnId });
        if (!cost) return res.status(404).json({ message: "No investment cost found for this barn" });

        const pigs = await PigModel.find({ barn: barnId, isDeleted: false }).populate("herd");

        let herdName = pigs[0]?.herd?.name || "";
        let herdId = pigs[0]?.herd?._id || "";

        if (barn.total_pigs === 0)
            return res.status(400).json({ message: "No pigs in barn" });

        const price =
            (cost.breeding_cost + cost.food_cost + cost.medition_cost) /
            barn.total_pigs;

        return res.json({
            price: Math.round(price),
            barnName: barn.name,
            herdName: herdName,
            herdId: herdId,
            totalPigs: barn.total_pigs
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/customers/list", async (req, res) => {
    try {
        const customers = await CustomerModel.find().lean();
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: "Failed to load customers" });
    }
});

// router render UI to create invoice
router.get('/create-invoice', async(req,res) => {
    res.render('sellpigs/create-invoice', {
        title: "Create invoice",
        active: "sellPigs"
    })
});

// create a new invoice
router.post("/create-invoice", async (req, res) => {
    try {
        const { 
            customer, 
            invoiceCode, 
            note, 
            paymentStatus, 
            paymentDate, 
            totalAmount, 
            details,
            discount
        } = req.body;

        // Lưu SellPig
        const sellPig = await SellPigModel.create({
            customer,
            invoiceCode,
            note,
            paymentStatus,
            paymentDate,
            totalPrice: totalAmount,
            discount
        });

        console.log('sellpig:' + sellPig)

        // Lưu SellPigDetail
        for (const item of details) {
            await SellPigDetailModel.create({
                invoice: sellPig._id,
                warehouse: item.warehouse,
                barn: item.barn, // barnId
                productName: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
                discount: item.discount,
                totalPrice: item.totalPrice
            });
        }

        // UPDATE PIGS THEO BARN
        const barnIds = details.map(i => i.barn);

        await PigModel.updateMany(
            { barn: { $in: barnIds } },
            { $set: { 
                status: "Released from the barn",
                isDeleted: true
            }}
        );

        for (const item of details) {
            // XÓA herd vừa xuất khỏi BarnHerdDetail
            await BarnHerdDetailModel.deleteMany({
                barn: item.barn,
                herd: item.herd
            });

            // LẤY TẤT CẢ HERD CÒN LẠI TRONG CHUỒNG
            const remainingDetails = await BarnHerdDetailModel.find({
                barn: item.barn,
                herd: item.barn
            });

            // TÍNH TỔNG SỐ LỢN CÒN LẠI
            let newTotal = 0;
            remainingDetails.forEach(d => {
                newTotal += d.importQuantity;
                console.log(newTotal);
            });
            

            // CẬP NHẬT LẠI TOTAL_PIGS CỦA CHUỒNG
            await BarnModel.findByIdAndUpdate(item.barn, {
                total_pigs: newTotal
            });
        }


        res.json({
            success: true,
            message: "Invoice created and pigs released",
            invoiceId: sellPig._id
        });

    } catch (err) {
        console.error("ERROR FROM SERVER:", err);
        res.status(500).json({
            success: false,
            error: "Failed to save invoice"
        });
    }
});

// delete an invoice
router.post("/delete/:id", async (req, res) => {
    try {
        await SellPigDetailModel.deleteMany({ sellPig: req.params.id });
        await SellPigModel.findByIdAndDelete(req.params.id);

        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
    }
});

module.exports = router;