const PigModel = require('../models/Pig');
const GrowthTrackingModel = require('../models/ReproductiveManagement/GrowthTracking');
const HealthHistoryModel = require('../models/HealthHistory');
const BreedingPerformanceModel = require('../models/ReproductiveManagement/BreedingPerformance');
const GiveBirthRecordModel = require('../models/ReproductiveManagement/GiveBirthRecord');

async function suggestMatingForSow(sowId, options = {}) {
    const limit = options.limit || 10;

    // 1. Load sow
    const sow = await PigModel.findOne({ _id: sowId, isDeleted: false }).populate('herd').lean();
    if (!sow) throw new Error('Sow not found');
    if (sow.sex !== 'sow') throw new Error('Provided pig is not a sow');

    // Check sow age
    const sowAgeDays = (Date.now() - new Date(sow.birthDate).getTime()) / (1000 * 60 * 60 * 24);
    if (sowAgeDays < 180) {  // 6 tháng ~180 ngày
    throw new Error(`Sow is too young for mating (${Math.floor(sowAgeDays)} days old)`);
    }

    console.log("Sow: ", sow);

    // 2. Collect bloodline/potential relatives
    const relatives = new Set();
    if (sow.parents) {
        if (sow.parents.father) relatives.add(String(sow.parents.father));
        if (sow.parents.mother) relatives.add(String(sow.parents.mother));

        const siblings = await Pig.find({
            'parents.father': sow.parents.father,
            'parents.mother': sow.parents.mother,
            _id: { $ne: sow._id },
            isDeleted: false
        }).select('_id').lean();
        siblings.forEach(s => relatives.add(String(s._id)));
    }

    // 3. Candidate boars
    const eightMonthsAgo = new Date();
    eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);

    const candidateBoars = await PigModel.find({
        sex: 'boar',
        isDeleted: false,
        status: 'active',
        birthDate: { $lte: eightMonthsAgo }
    })
    .populate('herd')
    .lean();

    console.log('candidateBoars: ', candidateBoars);

    // 4. Scoring
    const scored = [];
    for (const boar of candidateBoars) {
        if (relatives.has(String(boar._id))) continue;

        let score = 0;
        const reasons = [];

        if (sow.herd.type && boar.herd.type && String(sow.herd.type) === String(boar.herd.type)) {
            score += 2; reasons.push('Same breed');
        }

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const recentHealth = await HealthHistoryModel.findOne({ pig: boar._id, date: { $gte: ninetyDaysAgo } }).lean();
        if (!recentHealth) { score += 2; reasons.push('No recent health issues'); }
        else { reasons.push('Recent health record found'); }
        console.log("recentHealth: ", recentHealth);

        const perfBoar = await BreedingPerformanceModel.findOne({ boar: boar._id, isDeleted: false }).lean();
        const perfPair = await BreedingPerformanceModel.findOne({ boar: boar._id, sow: sow._id, isDeleted: false }).lean();

        console.log("perBoar", perfBoar);
        console.log("perfPair", perfPair);

        if (perfPair) {
            score += (perfPair.avgLitterSize || 0) * 0.5;
            score += (perfPair.avgSurvivalRate || 0) * 5;
            reasons.push('Has pair performance history');
        } else if (perfBoar) {
            score += (perfBoar.avgLitterSize || 0) * 0.3;
            score += (perfBoar.avgSurvivalRate || 0) * 3;
            reasons.push('Has boar performance history');
        }

        if (perfBoar && perfBoar.lastUsed) {
            const daysSinceUsed = (Date.now() - new Date(perfBoar.lastUsed).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceUsed < 7) { score -= 1; reasons.push('Recently used'); }
        }

        if (boar.meta && boar.meta.healthScore) {
            score += boar.meta.healthScore * 0.5; reasons.push('Health score present');
            console.log("boar.meta: " + boar.meta.healthScore);
        }

        //

        // Evaluate growth stability in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const growthData = await GrowthTrackingModel.find({
            pig: boar._id,
            date: { $gte: thirtyDaysAgo },
            isDeleted: false
        }).sort({ date: 1 }).lean();

        if (growthData.length >= 2) {
            const firstEntry = growthData[0];
            const lastEntry = growthData[growthData.length - 1];

            // --- Weight evaluation ---
            const firstWeight = firstEntry.weight || 0;
            const lastWeight = lastEntry.weight || 0;
            const weightGain = lastWeight - firstWeight;

            if (weightGain > 5) { score += 3; reasons.push('Strong weight gain (last 30d)'); }
            else if (weightGain > 0) { score += 1; reasons.push('Mild weight gain'); }
            else { score -= 1; reasons.push('No weight gain or lost weight'); }

            // --- ✅ Length evaluation (B) ---
            const firstLength = firstEntry.length || 0;
            const lastLength = lastEntry.length || 0;
            const lengthGain = lastLength - firstLength;

            if (lengthGain > 3) { score += 2; reasons.push('Significant length growth'); }
            else if (lengthGain > 1) { score += 1; reasons.push('Moderate length growth'); }
            else { score -= 1; reasons.push('Poor length growth'); }

        } else {
            reasons.push('Insufficient growth data');
        }

        scored.push({ boar, score, reasons });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(item => ({
        boarId: item.boar._id,
        tag: item.boar.tag,
        breed: item.boar.breed,
        score: Math.round(item.score * 100) / 100,
        reasons: item.reasons
    }));
};

// Weaning Service (Semi-auto)
const createWeaning = async (birthId, payload) => {
  const birth = await GiveBirthRecordModel.findById(birthId).lean();
  if (!birth) throw new Error('Birth record not found');

  const baseDate = new Date(birth.dateOfBirth || birth.birthDate); // tuỳ schema
  const weaningDay = payload.weaningDay
    ? new Date(payload.weaningDay)
    : new Date(baseDate.setDate(baseDate.getDate() + 21));

  const numberOfLivePiglets = payload.numberOfLivePiglets || birth.numberOfLivePiglets;

  const weaning = new WeaningModel({
    birthRecord: birthId,
    pigMother: birth.sow || birth.pigMother, // tuỳ schema
    weaningDay,
    numberOfLivePiglets,
    sowHealth: payload.sowHealth || null,
    pigletHealth: payload.pigletHealth || null,
    avgWeaningWeightKg: payload.avgWeaningWeightKg || null,
    note: payload.note || null
  });

  const savedWeaning = await weaning.save();

  await updateBreedingPerformance({
    sowId: birth.sow || birth.pigMother,
    boarId: birth.boar,
    weanCount: numberOfLivePiglets,
    avgWeaningWeight: payload.avgWeaningWeightKg
  });

  return savedWeaning;
};

async function updateBreedingPerformance({ sowId, boarId, birthCount = 0, weanCount = 0, avgWeaningWeight = 0 }) {
    // Tìm record theo cặp phối giống
    let record = await BreedingPerformanceModel.findOne({
        sow: sowId,
        boar: boarId,
        isDeleted: false
    });

    if (!record) {
        record = new BreedingPerformance({
        sow: sowId,
        boar: boarId,
        totalLitters: 0,
        avgLitterSize: 0,
        avgSurvivalRate: 0,
        avgWeaningWeight: 0
        });
    }

    // ✅ Cập nhật tổng số lứa sinh
    record.totalLitters += birthCount > 0 ? 1 : 0;

    // ✅ Cập nhật avgLitterSize = tổng số con sinh ra / tổng số lứa
    if (record.totalLitters > 0) {
        record.avgLitterSize =
        ((record.avgLitterSize * (record.totalLitters - 1)) + birthCount) / record.totalLitters;
    }

    // ✅ Cập nhật avgSurvivalRate = tổng số con cai sữa / tổng số con sinh ra
    if (birthCount > 0) {
        const survivalRate = birthCount > 0 ? (weanCount / birthCount) : 0;
        record.avgSurvivalRate =
        ((record.avgSurvivalRate * (record.totalLitters - 1)) + survivalRate) / record.totalLitters;
    }

    // ✅ Cập nhật avgWeaningWeight = trung bình cân cai sữa (nếu có)
    if (avgWeaningWeight > 0) {
        record.avgWeaningWeight =
        ((record.avgWeaningWeight * (record.totalLitters - 1)) + avgWeaningWeight) / record.totalLitters;
    }

    // ✅ Ghi lại lần phối giống gần nhất
    record.lastUsed = new Date();

    await record.save();
    return record;
}

module.exports = { createWeaning, suggestMatingForSow, updateBreedingPerformance };