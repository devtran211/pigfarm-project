var express = require('express');
var router = express.Router();
const PigModel = require('../models/Pig');

router.get("/:pigId", async (req, res) => {
    try {
        const pig = await PigModel.findById(req.params.pigId).lean();

        if (!pig) return res.status(404).json({ error: "Pig not found" });

        res.json({ success: true, pig });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});



module.exports = router;
