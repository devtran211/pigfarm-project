const express = require('express');
const router = express.Router();
const HealthHistoryModel = require('../models/HealthHistory');
const PigModel = require('../models/Pig');

router.get('/with-health-history', async (req, res) => {
    try {
        // lấy danh sách id lợn có health history
        const healthRecords = await HealthHistoryModel.find().select('pig');

        const pigIds = healthRecords.map(h => h.pig);

        // lấy danh sách pigs tương ứng
        const pigs = await PigModel.find({
            _id: { $in: pigIds },
            //isDeleted: false
        });

        res.render('healthhistory/index', { 
          title: "Health history",
          active: "healthHistory",
          pigs 
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// display all a pig's health history
router.get('/:pigId', async (req, res) => {
    try {
        const pigId = req.params.pigId;

        // Lấy thông tin con lợn
        const pig = await PigModel.findById(pigId);
        if (!pig) return res.status(404).send("Pig not found");

        // Lấy toàn bộ health history của con lợn
        const histories = await HealthHistoryModel.find({ pig: pigId })
            .sort({ dateOfDiscovery: -1 }); // sort mới nhất trước

        res.render('healthhistory/detail', {
            pig,
            histories
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// Load all health history record
router.post("/create", async (req, res) => {
    try {
        const {
            pig,
            dateOfDiscovery,
            symptom,
            movementStatus,
            eatingBehavior,
            waterIntake,
            feverStatus,
            humidity,
            vaccinationHistory,
            note
        } = req.body;

        if (!pig) {
            return res.status(400).json({ error: "Missing pig id" });
        }

        const newHistory = new HealthHistoryModel({
            pig,
            dateOfDiscovery,
            symptom,
            movementStatus,
            eatingBehavior,
            waterIntake,
            feverStatus,
            humidity,
            vaccinationHistory,
            note
        });

        await newHistory.save();

        res.json({ success: true, history: newHistory });

    } catch (err) {
        console.error("Error creating health history:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// GET one health history (load data to popup)
router.get('/update/:id', async (req, res) => {
    try {
        const record = await HealthHistoryModel.findById(req.params.id);

        if (!record) return res.status(404).json({ message: "Record not found" });

        res.json(record);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// update Health History
router.put('/update/:id', async (req, res) => {
    try {
        const updatedData = {
            dateOfDiscovery: req.body.dateOfDiscovery,
            dateOfRecovery: req.body.dateOfRecovery,
            result: req.body.result,
            symptom: req.body.symptom,
            movementStatus: req.body.movementStatus,
            eatingBehavior: req.body.eatingBehavior,
            waterIntake: req.body.waterIntake,
            feverStatus: req.body.feverStatus,
            humidity: req.body.humidity,
            vaccinationHistory: req.body.vaccinationHistory,
            note: req.body.note,
            updated_at: Date.now()
        };

        // Update bản ghi health history
        const record = await HealthHistoryModel.findByIdAndUpdate(
            req.params.id,
            updatedData,
            { new: true }
        );

        if (!record) {
            return res.status(404).json({ message: "Record not found" });
        }

        if (req.body.result && req.body.result.toLowerCase() === "true") {
            await PigModel.findByIdAndUpdate(record.pig, {
                status: "dead",
                isDeleted: true
            });
        }

        res.json({
            message: "Updated successfully",
            data: record
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const record = await HealthHistoryModel.findByIdAndDelete(req.params.id);

        if (!record) {
            return res.status(404).json({ message: "Record not found" });
        }

        res.json({ message: "Deleted successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
