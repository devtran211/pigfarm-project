var express = require('express');
var mongoose = require('mongoose');
var router = express.Router();
const PigModel = require('../models/Pig');
const HerdModel = require('../models/Herd');
const GiveBirthdModel = require('../models/ReproductiveManagement/GiveBirthRecord');
const WeaningModel = require('../models/ReproductiveManagement/Weaning');

router.post("/create", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const {
      birthRecord,
      weaningDay,
      sowHealth,
      pigletHealth,
      avgWeaningWeightKg,
      note,
      name,
      dateOfEntry,
      sex,
      vaccination,
      importPrice
    } = req.body;

    if (!birthRecord || !mongoose.Types.ObjectId.isValid(birthRecord)) {
      await session.abortTransaction();
      return res.status(400).json({ error: "Invalid or missing birthRecord ID" });
    }

    // 1) Lấy GiveBirth, populate sow và boar (và tiếp tục populate herd của mỗi con)
    const birth = await GiveBirthdModel.findById(birthRecord)
      .populate({
        path: "sow",
        populate: { path: "herd", select: "type name" } // lấy herd của sow
      })
      .populate({
        path: "boar",
        populate: { path: "herd", select: "type name" } // lấy herd của boar
      })
      .session(session);

    if (!birth) {
      await session.abortTransaction();
      return res.status(404).json({ error: "GiveBirth record not found" });
    }

    const pigMother = birth.sow?._id;
    const pigFather = birth.boar?._id;
    const livePiglets = birth.numberOfLivePiglets;

    if (!pigMother || !pigFather) {
      await session.abortTransaction();
      return res.status(400).json({ error: "GiveBirth missing sow or boar information" });
    }

    // 2) Xác định herd.type dựa trên sow.herd.type x boar.herd.type
    // fallback nếu không có herd info
    const sowHerdType = birth.sow?.herd?.type || null;
    const boarHerdType = birth.boar?.herd?.type || null;

    let herdType = "";
    if (sowHerdType && boarHerdType) {
      herdType = `${sowHerdType} x ${boarHerdType}`;
    } else if (sowHerdType && !boarHerdType) {
      herdType = `${sowHerdType} x unknown`;
    } else if (!sowHerdType && boarHerdType) {
      herdType = `unknown x ${boarHerdType}`;
    }

    // 3) Build descriptive note using herd names/types
    const sowHerdName = birth.sow?.herd?.name || "unknown";
    const boarHerdName = birth.boar?.herd?.name || "unknown";
    const sowHerdTypeLabel = sowHerdType || "unknown";
    const boarHerdTypeLabel = boarHerdType || "unknown";

    const crossNote = `Crossbred offspring from ${sowHerdTypeLabel} (mother herd: ${sowHerdName}) x ${boarHerdTypeLabel} (father herd: ${boarHerdName})`;

    // Compose final herd note: include any user note too
    const herdNote = [crossNote, note].filter(Boolean).join(" | ");

    // 4) Create Herd
    const herdName = `Herd_${birth._id.toString().slice(-5)}`;
    const herdDocs = await HerdModel.create(
      [{
        name: name,
        origin: "Internal breeding",
        dateOfEntry: dateOfEntry,
        type: herdType,             // <-- dynamic type
        sex: sex,
        weightAtImport: avgWeaningWeightKg ?? null,
        health: pigletHealth ?? "unknown",
        vaccination: vaccination,
        inventory: livePiglets ?? 0,
        original_inventory: livePiglets,
        importPrice: importPrice,
        note: herdNote,
      }],
      { session }
    );

    const herdId = herdDocs[0]._id;

    // 5) Generate piglet tags and create Pig docs
    // Tag format: PIG-YYYYMMDD-### (3-digit sequence)
    const dateStr = (weaningDay ? new Date(weaningDay) : new Date())
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, ""); // e.g. 20251009

    // Optional: ensure unique daily sequence by counting existing pigs with same date prefix
    // (Simple approach: count existing tags starting with PIG-dateStr)
    const existingCount = await PigModel.countDocuments({ tag: new RegExp(`^PIG-${dateStr}-`) }).session(session);
    const startIndex = existingCount + 1;

    const pigletDocs = [];
    for (let i = 0; i < (livePiglets || 0); i++) {
      const seq = (startIndex + i).toString().padStart(3, "0");
      const tag = `PIG-${dateStr}-${seq}`;

      // alternate sex to balance (or you can change logic)
      // const sex = (i % 2 === 0) ? "boar" : "sow";

      pigletDocs.push({
        tag,
        birthDate: birth.dateOfBirth || (weaningDay ? new Date(weaningDay) : new Date()),
        sex: sex,
        herd: herdId,
        parents: { father: pigFather, mother: pigMother },
        status: "active",
        note: `Auto-generated piglet from giveBirth ${birth._id}`
      });
    }

    if (pigletDocs.length) {
      await PigModel.insertMany(pigletDocs, { session });
    }

    // 6) Create Weaning record and link to herd
    const weaningDocs = await WeaningModel.create(
      [{
        pigMother,
        birthRecord,
        weaningDay,
        numberOfLivePiglets: livePiglets,
        sowHealth,
        pigletHealth,
        avgWeaningWeightKg,
        note,
        herd: herdId
      }],
      { session }
    );

    // 7) (Optional) update BreedingRecord.status or GiveBirth if you want — not changed here

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Weaning, Herd and Piglets created successfully",
      weaning: weaningDocs[0],
      herd: herdDocs[0],
      pigletsCreated: pigletDocs.length
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error in POST /api/weaning:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;