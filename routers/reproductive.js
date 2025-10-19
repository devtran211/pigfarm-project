var express = require('express');
var router = express.Router();
const PigModel = require('../models/Pig');
const BreedingRecordModel = require('../models/ReproductiveManagement/BreedingRecord');
const GiveBirthRecordModel = require('../models/ReproductiveManagement/GiveBirthRecord');
const { createWeaning, suggestMatingForSow, updateBreedingPerformance } = require('../services/reproductiveManagement');

// GET /breeding/suggest/:sowId
router.get('/suggest/:sowId', async (req, res) => {
    try {
        const results = await suggestMatingForSow(req.params.sowId, { limit: parseInt(req.query.limit) || 5 });
        res.json({ success: true, data: results });
    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false, message: err.message });
    }
});

// POST /breeding-record - create a breeding record
router.post('/breeidng-record', async (req, res) => {
    try {
        const payload = req.body;

        // Nếu pregnant = true thì tự tính expectedBirthDate
        if (payload.pregnant === true) {
            let baseDate = null;

            // Ưu tiên tìm lần phối giống thành công
            if (Array.isArray(payload.attempts)) {
                const successAttempt = payload.attempts.find(a => a.success === true);
                //const firstAttempt = payload.attempts[0];

                baseDate = successAttempt?.date; //|| firstAttempt?.date;
            }

            if (baseDate) {
                const expected = new Date(baseDate);
                expected.setDate(expected.getDate() + 114); // 114 ngày mang thai lợn nái

                payload.expectedBirthDate = expected;
            } else {
                console.warn("⚠️ Không tìm được ngày cơ sở để tính expectedBirthDate");
            }
        }

        const br = await BreedingRecordModel.create(payload);
        res.json({ success: true, data: br });

    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false, message: err.message });
    }
});

router.post('/givebirth/:breedingRecordId', async (req, res) => {
    try {
        const breedingRecordId = req.params.breedingRecordId;
        const payload = req.body;  // Chỉ cần birth info & piglets

        // 1) Lấy thông tin breeding record
        const breedingRecord = await BreedingRecordModel.findById(breedingRecordId);
        if (!breedingRecord) throw new Error('Breeding record not found');

        // 2) Tạo give birth record dựa trên breeding record
        const gbr = await GiveBirthRecordModel.create({
            breedingRecord: breedingRecordId,
            sow: breedingRecord.sow,       // auto fill
            boar: breedingRecord.boar,     // auto fill
            dateOfBirth: payload.dateOfBirth,
            piglets: [],
            averageWeight: 0
        });

        // 3) Tạo piglet & update gbr
        const pigletDocs = [];
        if (Array.isArray(payload.piglets)) {
            let counter = 1;
            const dateStr = payload.dateOfBirth 
            ? new Date(payload.dateOfBirth).toISOString().split('T')[0].replace(/-/g, '') 
            : new Date().toISOString().split('T')[0].replace(/-/g, '');
            for (const p of payload.piglets) {
                // Tạo tag tự động
                const tag = `PIG-${dateStr}-${String(counter).padStart(3, '0')}`;
                counter++

                // 1. Tạo con giống trong Herd
                const newHerd = await HerdModel.create({
                    name: p.name || tag, // nếu có tên thì dùng, ko thì để tag
                    origin: "Born in farm",
                    birth_date: payload.dateOfBirth,
                    type: "piglet",
                    sex: p.sex || 'piglet',
                    vaccination: false,
                    inventory: 1
                });

                // 2. Tạo lợn
                const newPig = await PigModel.create({
                    tag: p.tag || undefined,
                    sex: p.sex || 'piglet',
                    herd: newHerd._id || undefined,
                    birthDate: payload.dateOfBirth || new Date(),
                    parents: { father: breedingRecord.boar, mother: breedingRecord.sow }
                });
                pigletDocs.push({ pigId: newPig._id, birthWeight: p.birthWeight });
            }

            gbr.piglets = pigletDocs;
            //gbr.averageWeight = pigletDocs.reduce((s,x) => s + (x.birthWeight || 0), 0);
            const totalWeight = pigletDocs.reduce((s, x) => s + (x.birthWeight || 0), 0);
            const avg = pigletDocs.length > 0 ? totalWeight / pigletDocs.length : 0;
            // Làm tròn 2 chữ số thập phân
            gbr.averageWeight = Math.round(avg * 100) / 100;
            await gbr.save();
        }

        // 4) Update performance
        await updateBreedingPerformance({
            sowId: breedingRecord.sow,
            boarId: breedingRecord.boar,
            birthCount: pigletDocs.length,
            recordId: gbr._id
        });

        res.json({ success: true, data: gbr });

    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false, message: err.message });
    }
});

router.post('/weaning/:birthId', async (req, res) => {
  try {
    const birthId = req.params.birthId;
    const payload = req.body;

    const savedWeaning = await createWeaning(birthId, payload);

    res.json({ success: true, data: savedWeaning });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;