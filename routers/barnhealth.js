const express = require('express');
const router = express.Router();
const AreaModel = require('../models/Area');
const BarnModel = require('../models/Barn');
const BarnHealthModel = require('../models/BarnHealth');
const PigModel = require('../models/Pig');

router.get("/", async (req, res) => {
    try {
        const areas = await AreaModel.find().lean();

        const selectedAreaId = req.query.area || (areas[0]?._id.toString() || "");

        // Lấy barns theo area
        const barns = await BarnModel.find({
            area: selectedAreaId
        }).lean();

        // Map barns + health records
        const barnsWithHealth = await Promise.all(
            barns.map(async (b) => {
                const health = await BarnHealthModel.find({ barn: b._id })
                    .sort({ dateOfInspection: -1 })
                    .lean();

                return {
                    ...b,
                    healthRecords: health
                };
            })
        );

        const areaData = [
            {
                _id: selectedAreaId,
                name: areas.find(a => a._id.toString() === selectedAreaId)?.name || "",
                barns: barnsWithHealth
            }
        ];

        res.render("barnhealth/index", {
            areas,
            selectedAreaId,
            areaData
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

router.get("/:barnId/pigs", async (req, res) => {
    try {
        const barnId = req.params.barnId;

        const barn = await BarnModel.findById(barnId).lean();
        const pigs = await PigModel.find({ barn: barnId, isDeleted: false }).lean();

        res.render("barnhealth/pig-index", {
            barn,
            pigs
        });

    } catch (error) {
        console.log(error);
        res.status(500).send("Server error");
    }
});

// GET list barns for select
router.get("/list", async (req, res) => {
    try {
        const barns = await BarnModel.find().lean();
        res.json(barns);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// POST create barn health record
router.post("/create", async (req, res) => {
    try {
        const {
            barn,
            averageWeight,
            loss,
            faecesStatus,
            dateOfInspection,
            note
        } = req.body;

        if (!barn) {
            return res.status(400).json({ error: "Missing barn id" });
        }

        const record = new BarnHealthModel({
            barn,
            averageWeight,
            loss,
            faecesStatus,
            dateOfInspection,
            note
        });

        await record.save();

        res.json({ success: true, record });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const record = await BarnHealthModel.findById(req.params.id).lean();

        if (!record)
            return res.status(404).json({ error: "Record not found" });

        res.json(record);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/update/:id", async (req, res) => {
    try {
        const {
            averageWeight,
            loss,
            faecesStatus,
            dateOfInspection,
            note
        } = req.body;

        const updated = await BarnHealthModel.findByIdAndUpdate(
            req.params.id,
            {
                averageWeight,
                loss,
                faecesStatus,
                dateOfInspection,
                note
            },
            { new: true }
        );

        if (!updated)
            return res.status(404).json({ error: "Record not found" });

        res.json({ success: true, updated });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/delete/:id", async (req, res) => {
    try {
        const deleted = await BarnHealthModel.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ error: "Record not found" });
        }

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;