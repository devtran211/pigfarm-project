var express = require('express');
var mongoose = require('mongoose');
var router = express.Router();
const PigModel = require('../models/Pig');
const BreedingRecordModel = require('../models/ReproductiveManagement/BreedingRecord');
const { suggestBoarsForSow } = require('../services/breeding');

router.get("/:sowId/suggestions", async (req, res) => {
  try {
    const { sowId } = req.params;
    const { barnId } = req.query;

    // Validate sowId
    if (!sowId || !mongoose.Types.ObjectId.isValid(sowId)) {
      return res.status(400).json({ error: "Invalid sowId" });
    }

    // Validate barnId if provided
    if (barnId && !mongoose.Types.ObjectId.isValid(barnId)) {
      return res.status(400).json({ error: "Invalid barnId" });
    }

    // Optional: ensure the sow exists and is of sex 'sow'
    const sow = await PigModel.findById(sowId).select("_id tag sex status");
    if (!sow) return res.status(404).json({ error: "Sow not found" });
    if (sow.sex !== "sow") return res.status(400).json({ error: "Given pig is not a sow" });

    // Call service (will restrict boars by barnId if provided)
    const suggestionsPayload = await suggestBoarsForSow(sowId, barnId);

    // Standardize response
    return res.json(suggestionsPayload);
  } catch (err) {
    console.error("Error in /api/breeding/:sowId/suggestions:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

router.post("/add", async (req, res) => {
  try {
    const {
      sowId,
      boarId,
      fertility_score,
      boar_match_score,
      attempts,
      expectedBirthDate,
      note
    } = req.body;

    // Nếu người dùng không nhập expectedBirthDate → auto +115 ngày
    let finalExpectedDate = expectedBirthDate ? new Date(expectedBirthDate) : new Date();
    if (!expectedBirthDate) finalExpectedDate.setDate(finalExpectedDate.getDate() + 115);

    const record = await BreedingRecordModel.create({
      sow: sowId,
      boar: boarId,
      fertility_score,
      boar_match_score,
      attempts, // array gồm nhiều lần phối
      expectedBirthDate: finalExpectedDate,
      note,
    });

    res.status(201).json({
      message: "Breeding record created successfully",
      record,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/add-attemp/:id/", async (req, res) => {
  try {
    const { id } = req.params;
    const { date, method, note, isSuccessful } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid record ID" });
    }

    const record = await BreedingRecordModel.findById(id);
    if (!record) return res.status(404).json({ error: "Breeding record not found" });

    // Thêm lần phối mới
    record.attempts.push({ date, method, note, isSuccessful });

    // Nếu attempt này thành công → update status = "pregnant"
    if (isSuccessful) {
      record.status = "pregnant";
    }

    // Nếu có ít nhất 3 lần phối mà tất cả đều thất bại → set status = "failed"
    const failedAttempts = record.attempts.filter(a => a.isSuccessful === false).length;
    if (failedAttempts >= 3 && !record.attempts.some(a => a.isSuccessful === true)) {
      record.status = "failed";
    }

    await record.save();

    res.json({
      message: "Attempt added successfully",
      record
    });
  } catch (err) {
    console.error("Error updating breeding record:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;