var express = require('express');
var router = express.Router();
const HerdModel = require('../models/Herd');
const PigModel = require('../models/Pig');
const InvoiceModel = require('../models/Invoice');

// get all herd
router.get('/', async (req, res) => {
   var herds = await HerdModel.find({}).populate('invoice');
   res.render('herd/index', {
      title: "Herd management",
      active: "herdWarehouse",
      herds
   })
})

// get a herd detail
router.get('/detail/:id', async (req, res) => {
   try {
      const id = req.params.id;
      const herd = await HerdModel.findById(id).populate("invoice");
      res.json({ success: true, herd });
   } catch (err) {
      res.json({ success: false, message: err });
   }
});

// create a new herd
router.post('/add', async (req, res) => {
   var herds = await HerdModel.create(req.body);
   return res.json({ success: true, message: "Created successfully!" });
})

// load data of a herd
router.get('/edit/:id', async (req, res) => {
   var id = req.params.id;
   var herds = await HerdModel.findById(id);
   res.json(herds);
})

// edit data of a herd
router.put('/edit/:id', async (req, res) => {
   var id = req.params.id;
   var herds = req.body;
   try {
      await HerdModel.findByIdAndUpdate(id, herds);
      res.json('update succeed !');
   } catch (err) {
      res.json('update failed. Error: ' + err);
   }
})

// get pigs by herdId
router.get('/pigs/:herdId', async (req, res) => {
    try {
        const herdId = req.params.herdId;

        const pigs = await PigModel.find({
            herd: herdId,
            isDeleted: false
        })
        .populate("barn")
        .populate("parents.father")
        .populate("parents.mother");

        res.json({ success: true, pigs });
    } catch (err) {
        res.json({ success: false, message: err });
    }
});

// delete a herd (may delete pigs belong to herd)
router.delete('/delete/:id', async (req, res) => {
    const herdId = req.params.id;

    try {
        // Kiểm tra xem có pigs nào trong herd không
        const pigCount = await PigModel.countDocuments({ herd: herdId });

        // Nếu có pigs, xóa pigs trước
        if (pigCount > 0) {
            await PigModel.deleteMany({ herd: herdId });
        }

        // Xóa herd
        await HerdModel.findByIdAndDelete(herdId);

        res.json({
            success: true,
            message:
                pigCount > 0
                    ? `Deleted herd (and ${pigCount} pigs).`
                    : `Deleted herd (no pigs in herd).`
        });

    } catch (err) {
        res.json({
            success: false,
            message: "Delete failed.",
            error: err
        });
    }
});


module.exports = router;