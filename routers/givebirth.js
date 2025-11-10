var express = require('express');
var mongoose = require('mongoose');
var router = express.Router();
const PigModel = require('../models/Pig');
const BreedingRecordModel = require('../models/ReproductiveManagement/BreedingRecord');
const GiveBirthModel = require('../models/ReproductiveManagement/GiveBirthRecord');

router.post("/add", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const {
      breedingRecordId,
      dateOfBirth,
      totalBorn,
      numberOfLivePiglets,
      // numberOfDeadPiglets,
      averageWeight,
      note,
    } = req.body;

    if (!breedingRecordId || !mongoose.Types.ObjectId.isValid(breedingRecordId)) {
      return res.status(400).json({ error: "Invalid breedingRecordId" });
    }

    // Transaction start
    session.startTransaction();

    const record = await BreedingRecordModel.findById(breedingRecordId).session(session);
    if (!record) {
      await session.abortTransaction();
      return res.status(404).json({ error: "BreedingRecord not found" });
    }

    // ensure sow & boar exist
    const sowId = record.sow;
    const boarId = record.boar;

    if (!sowId || !boarId) {
      await session.abortTransaction();
      return res.status(400).json({ error: "BreedingRecord missing sow or boar" });
    }

    // Create GiveBirth doc
    const gb = await GiveBirthModel.create([{
      breedingRecord: record._id,
      sow: sowId,
      boar: boarId,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date(),
      totalBorn: totalBorn ?? (numberOfLivePiglets + (numberOfDeadPiglets || 0)),
      numberOfLivePiglets: numberOfLivePiglets ?? 0,
      numberOfDeadPiglets: totalBorn - numberOfLivePiglets ?? 0,
      averageWeight: averageWeight ?? null,
      note: note ?? ""
    }], { session });

    const giveBirth = gb[0];

    // update BreedingRecord: attach giveBirth and status
    // record.giveBirth = giveBirth._id;
    record.status = "Gave birth"; // or "completed" as you prefer
    await record.save({ session });

    await session.commitTransaction();
    session.endSession();

    // populate for response
    const populated = await GiveBirthModel.findById(giveBirth._id)
      .populate("sow", "tag barn")
      .populate("boar", "tag barn")
      .populate({
        path: "breedingRecord",
        select: "fertility_score boar_match_score attempts status"
      });

    return res.status(201).json({ message: "GiveBirth created", giveBirth: populated });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error POST /api/givebirth:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.put("/edit/:id", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const id  = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });

    const {
      dateOfBirth,
      totalBorn,
      numberOfLivePiglets,
      averageWeight,
      note,
    } = req.body;

    session.startTransaction();

    const giveBirth = await GiveBirthModel.findById(id).session(session);
    if (!giveBirth) {
      await session.abortTransaction();
      return res.status(404).json({ error: "GiveBirth not found" });
    }

    // Save old values if needed to update logs differentially
    const oldNumberOfLive = giveBirth.numberOfLivePiglets;

    if (dateOfBirth) giveBirth.dateOfBirth = new Date(dateOfBirth);
    if (typeof totalBorn !== "undefined") giveBirth.totalBorn = totalBorn;
    if (typeof numberOfLivePiglets !== "undefined") giveBirth.numberOfLivePiglets = numberOfLivePiglets;
    if (typeof numberOfDeadPiglets == "undefined") giveBirth.numberOfDeadPiglets = totalBorn - numberOfLivePiglets;
    if (typeof averageWeight !== "undefined") giveBirth.averageWeight = averageWeight;
    if (typeof note !== "undefined") giveBirth.note = note;

    await giveBirth.save({ session });

    await session.commitTransaction();
    session.endSession();

    const populated = await GiveBirthModel.findById(giveBirth._id)
      .populate("sow", "tag barn")
      .populate("boar", "tag barn")
      .populate({
        path: "breedingRecord",
        select: "fertility_score boar_match_score attempts status"
      });

    return res.json({ message: "GiveBirth updated", giveBirth: populated });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error PUT /api/givebirth/:id", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;