var express = require('express');
var router = express.Router();
const PigModel = require('../models/Pig');
const HerdModel = require('../models/Herd');
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

/* ------------------------------------------------------------------------------------ */
// Create a breeding record
router.post('/breeding-record/add', async (req, res) => {
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

// Edit a record
router.put('/breeding-record/:id', async (req, res) => {
  try {
    const recordId = req.params.id;
    const payload = req.body;

    console.log(payload);

    // Lấy record cần update
    let record = await BreedingRecordModel.findById(recordId);
    if (!record) throw new Error('Breeding record not found');

    // Update các field khác nếu có
    if (payload.note !== undefined) record.note = payload.note;
    if (payload.boar !== undefined) record.boar = payload.boar;
    if (payload.sow !== undefined) record.sow = payload.sow;
    if (payload.expectedBirthDate !== undefined) record.expectedBirthDate = payload.expectedBirthDate;

    // Save lại
    const updated = await record.save();

    res.json({ success: true, data: updated });

  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Thêm attempt mới + auto xử lý pregnant / expectedBirthDate
router.put('/breeding-record/attempt/:id', async (req, res) => {
    try {
        const recordId = req.params.id;
        const { date, method, success } = req.body;

        const record = await BreedingRecordModel.findById(recordId);
        if (!record) throw new Error('Breeding record not found');

        // Thêm attempt mới
        record.attempts.push({ date, method, success });

        if (success === true) {
            record.pregnant = true;
            const baseDate = new Date(date);
            baseDate.setDate(baseDate.getDate() + 114);
            record.expectedBirthDate = baseDate;
        } else {
            record.pregnant = false;
            record.expectedBirthDate = null;
        }

        await record.save();
        res.json({ success: true, data: record });

    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false, message: err.message });
    }
});

// Update attempt cũ theo index ,ví dụ frontend sẽ gửi attemptIndex để biết sửa cái nào:
router.put('/breeding-record/:id/attempt/:index', async (req, res) => {
    try {
        const recordId = req.params.id;
        const index = parseInt(req.params.index);
        const { date, method, success } = req.body;

        console.log("REQ BODY:", req.body);  // 👈 THÊM DÒNG NÀY
        console.log("METHOD:", method, "SUCCESS:", success);

        const record = await BreedingRecordModel.findById(recordId);
        if (!record) throw new Error('Breeding record not found');

        if (!record.attempts[index]) throw new Error('Attempt index not found');

        //Update dữ liệu
        record.attempts[index].date = date || record.attempts[index].date;
        record.attempts[index].method = method || record.attempts[index].method;
        record.attempts[index].success = success;

        // Kiểm tra logic pregnant lại theo *attempt cuối cùng thành công*
        const lastSuccess = record.attempts.filter(a => a.success === true).pop();

        if (lastSuccess) {
            record.pregnant = true;
            const baseDate = new Date(lastSuccess.date);
            baseDate.setDate(baseDate.getDate() + 114);
            record.expectedBirthDate = baseDate;
        } else {
            record.pregnant = false;
            record.expectedBirthDate = null;
        }

        console.log("👉 Trước khi save:", JSON.stringify(record.attempts[index], null, 2));

        await record.save();
        res.json({ success: true, data: record });

    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false, message: err.message });
    }
});

// Route DELETE — Xóa attempt trong BreedingRecord
router.delete('/breeding-record/:recordId/attempt/:index', async (req, res) => {
  try {
    const { recordId, index } = req.params;
    const attemptIndex = parseInt(index);  // vì index là string khi nhận từ URL

    const record = await BreedingRecordModel.findById(recordId);
    if (!record) throw new Error('Breeding record not found');

    if (attemptIndex < 0 || attemptIndex >= record.attempts.length) {
      throw new Error('Invalid attempt index');
    }

    // Lấy attempt trước khi xóa (để kiểm tra nếu cần)
    const removedAttempt = record.attempts[attemptIndex];

    // Xóa attempt theo index
    record.attempts.splice(attemptIndex, 1);

    // Nếu attempt bị xoá là attempt thành công duy nhất → reset pregnant & expectedBirthDate
    const hasSuccessAttempt = record.attempts.some(at => at.success === true);
    if (!hasSuccessAttempt) {
      record.pregnant = false;
      record.expectedBirthDate = null;
    }

    await record.save();

    res.json({ 
      success: true, 
      message: 'Attempt deleted by index', 
      deleted: removedAttempt, 
      data: record 
    });

  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
});

/* ------------------------------------------------------------------------------------- */
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
            numberOfLivePiglets: payload.piglets.length,
            numberOfDeadPiglets: payload.numberOfDeadPiglets,
            averageWeight: 0
        });

        let type;
        if (breedingRecord?.sow?.herd?.type && breedingRecord?.boar?.herd?.type) {
            type = breedingRecord.sow.herd.type + " and " + breedingRecord.boar.herd.type;
        }

        // Tạo con giống trong Herd
        const newHerd = await HerdModel.create({
            name: payload.herdName || null, // nếu có tên thì dùng, ko thì để tag
            origin: "Internal sources",
            birth_date: payload.dateOfBirth,
            type, //breedingRecord.sow.herd.type + " and " + breedingRecord.boar.herd.type,
            sex: payload.herdSex || 'piglet',
            vaccination: false,
            inventory: payload.piglets.length
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

                // Tạo lợn
                const newPig = await PigModel.create({
                    tag: tag || undefined,
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
            //recordId: gbr._id
        });

        res.json({ success: true, data: gbr });

    } catch (err) {
        console.error(err);
        res.status(400).json({ success: false, message: err.message });
    }
});


/* -------------------------------------------------------------------------- */

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