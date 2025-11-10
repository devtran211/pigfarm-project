const mongoose = require('mongoose');
const PigModel = require("../models/Pig");
const GrowthTrackingModel = require("../models/GrowthTracking.js");
const BreedingRecordModel = require("../models/ReproductiveManagement/BreedingRecord");
const HealthHistoryModel = require("../models/HealthHistory");
const GiveBirthModel = require("../models/ReproductiveManagement/GiveBirthRecord");
const WeaningModel = require("../models/ReproductiveManagement/Weaning.js");
const FertilityMetricsLogModel = require("../models/ReproductiveManagement/FertilityMetricsLog");

// === Scoring Weights (dễ tinh chỉnh / A/B test) ===
const WEIGHTS = {
  readiness: {
    weightOK: 25,           // cân nặng đạt ngưỡng
    bodyConditionOK: 15,          
    lastLitterGood: 25,     // lứa trước >= 10 con sống
    intervalOK: 20,         // khoảng cách lứa ≥ 21 ngày
    healthy: 15,            // không bệnh 30 ngày
    inEstrus: 15,           // đang động dục
  },
  boar: {
    breedMatch: 30,
    strongFertilityHistory: 25,
    noInbreeding: 25,
    workloadOK: 10,         // không khai thác quá tải
    healthy: 10,
  },
};

const THRESHOLDS = {
  sowWeightKg: 120,
  lastLitterMinLivePiglets: 10,
  minDaysSinceLastBirth: 21,
  sowHealthyDays: 30,
  boarHealthyDays: 60,
  boarMaxMatingsPer7d: 2,
  topK: 3,
};

// === Helpers ===
const daysBetween = (a, b) => Math.floor((a - b) / (1000 * 60 * 60 * 24));

const pickLatest = (arr, dateField = "date") =>
  arr?.length ? arr.sort((a, b) => new Date(b[dateField]) - new Date(a[dateField]))[0] : null;

const safeNum = (x, d = 0) => (Number.isFinite(+x) ? +x : d);

const unique = (arr) => [...new Set(arr.filter(Boolean))];

// Kiểm tra quan hệ cận huyết cơ bản (cha/mẹ/ông/bà) dựa vào mảng parents[] (nếu có)
function hasInbreedingRisk(sow, boar) {
  const sowParentArr = Array.isArray(sow?.parents) ? sow.parents : [];
  const boarParentArr = Array.isArray(boar?.parents) ? boar.parents : [];
  // chuẩn hoá mảng tổ tiên
  const sowParents = unique([...sowParentArr, sow?.sire, sow?.dam].filter(Boolean));
  const boarParents = unique([...boarParentArr, boar?.sire, boar?.dam].filter(Boolean));
  if (!sowParents.length && !boarParents.length) return false;
  const intersect = sowParents.filter((id) => boarParents.includes(String(id)));
  // cận huyết nếu chia sẻ cha/mẹ/ông/bà
  return intersect.length > 0 || sowParents.includes(String(boar?._id)) || boarParents.includes(String(sow?._id));
}

// Đếm số lần phối giống của boar trong 7 ngày gần nhất
async function countBoarMatingsLast7d(boarId) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const cnt = await BreedingRecordModel.countDocuments({
    boar: boarId,
    date: { $gte: since },
  });
  return cnt;
}

// Trung bình con sống/lứa của 1 con heo (sow hoặc boar)
async function avgLivePigletsForPig(pigId) {
  const gb = await GiveBirthModel.aggregate([
    { $match: { sow: new mongoose.Types.ObjectId(pigId) } },
    { $group: { _id: "$sow", avgLive: { $avg: "$numberOfLivePiglets" } } },
    { $project: { _id: 0, avgLive: 1 } },
  ]);
  return safeNum(gb?.[0]?.avgLive, 0);
}

// === Readiness Score cho nái ===
async function computeSowReadinessScore(sow) {
  // Growth
  const latestGrowth = pickLatest(await GrowthTrackingModel.find({ pig: sow._id }), "date");
  const weight = safeNum(latestGrowth?.weight);
  const length = safeNum(latestGrowth?.length);
  const fcr = safeNum(latestGrowth?.fcr);
  const weightOK = weight >= THRESHOLDS.sowWeightKg;
  console.log("Sow weight: " + weightOK);

  // === TÍNH BODY CONDITION SCORE (BCS) ===
  let bodyConditionOK = false;
  if (weight && length) {
    const lengthM = length / 100;
    const bcs = weight / (lengthM * lengthM);
    bodyConditionOK = bcs >= 100 && bcs <= 190;
  }
  console.log("Sow bodyConditionOK: " + bodyConditionOK);

  // --- Tiêu chí FCR (Feed Conversion Ratio) ---
  let fcrOK = false;
  if (fcr && fcr >= 2.5 && fcr <= 3.0) {
    fcrOK = true;
  }
  console.log("Sow fcrOK: " + fcrOK);

  // Lứa trước
  const lastBirth = pickLatest(await GiveBirthModel.find({ sow: sow._id }), "dateOfBirth");
  const lastLitterOK = safeNum(lastBirth?.numberOfLivePiglets) >= THRESHOLDS.lastLitterMinLivePiglets;
  console.log("Sow lastLitterOK: " + lastLitterOK)
    // --- Dữ liệu cai sữa gần nhất ---
  const latestWeaning = pickLatest(await WeaningModel.find({ pigMother: sow._id }), "weaningDay");

  let weaningOK = false;
  let sowHealthOK = false;
  let pigletHealthOK = false;
  let weaningWeightOK = false;
  let survivalRateOK = false;

  if (latestWeaning) {
    sowHealthOK = ["good", "normal"].includes(latestWeaning.sowHealth?.toLowerCase());
    pigletHealthOK = latestWeaning.pigletHealth?.toLowerCase() === "good";
    weaningWeightOK = safeNum(latestWeaning.avgWeaningWeightKg) >= 6;

    // Tỷ lệ sống sót = số con cai sữa / số con sinh
    if (lastBirth?.numberOfLivePiglets && latestWeaning?.numberOfLivePiglets) {
      const survivalRate = (latestWeaning.numberOfLivePiglets / lastBirth.numberOfLivePiglets) * 100;
      survivalRateOK = survivalRate >= 80;
    }

    // Nếu ít nhất 3 tiêu chí tốt → coi như cai sữa đạt
    weaningOK = [sowHealthOK, pigletHealthOK, weaningWeightOK, survivalRateOK].filter(Boolean).length >= 3;
  }

  // Khoảng cách lứa
  let intervalOK = false;
  if (lastBirth?.dateOfBirth) {
    const days = daysBetween(new Date(), new Date(lastBirth.dateOfBirth));
    intervalOK = days >= THRESHOLDS.minDaysSinceLastBirth;
  } else {
    // chưa từng sinh → không ràng buộc khoảng cách
    intervalOK = true;
  }
  console.log("Sow intervalOK: " + intervalOK);

  // Sức khoẻ: không bệnh 30 ngày
  const since = new Date(Date.now() - THRESHOLDS.sowHealthyDays * 24 * 60 * 60 * 1000);
  const recentIssues = await HealthHistoryModel.countDocuments({
    pig: sow._id,
    date: { $gte: since },
    result: { $ne: "recovered" }, // tuỳ schema của bạn
  });
  const healthy = recentIssues === 0;
  console.log("Sow healthy: " + healthy);

  // Động dục (nếu bạn có bảng estrus/heat). Nếu chưa có, suy luận thô từ chu kỳ 21 ngày.
  let inEstrus = false;
  if (sow?.lastEstrusDate) {
    const d = daysBetween(new Date(), new Date(sow.lastEstrusDate));
    inEstrus = d >= 20 && d <= 23;
  } else if (lastBirth?.dateOfBirth) {
    // fallback: giả định cai sữa 21d sau sinh + 5–7d có thể động dục
    const d = daysBetween(new Date(), new Date(lastBirth.dateOfBirth));
    inEstrus = d >= 26 && d <= 40;
  } else {
    // heo tơ: không phạt điểm
    inEstrus = true;
  }
  console.log("Sow inEstrus: " + inEstrus);

  let score = 0;
  if (weightOK) score += WEIGHTS.readiness.weightOK;
  if (bodyConditionOK) score += WEIGHTS.readiness.bodyConditionOK; 
  if (fcrOK) score += 15;
  if (lastLitterOK) score += WEIGHTS.readiness.lastLitterGood;
  if (intervalOK) score += WEIGHTS.readiness.intervalOK;
  if (healthy) score += WEIGHTS.readiness.healthy;
  if (inEstrus) score += WEIGHTS.readiness.inEstrus;
  // --- Điểm cho giai đoạn cai sữa ---
  if (weaningOK) score += 20;
  if (sowHealthOK) score += 10;
  if (pigletHealthOK) score += 5;
  if (weaningWeightOK) score += 5;

  console.log("Score: " + score);

  return { score, detail: { 
    weightOK, 
    bodyConditionOK, 
    fcrOK, 
    lastLitterOK, 
    intervalOK, 
    healthy, 
    inEstrus, 
    weaningOK,
    sowHealthOK,
    pigletHealthOK,
    weaningWeightOK,
    survivalRateOK
   }};
}

// === Compatibility Score cho đực ===
async function computeBoarMatchScore(sow, boar) {
  // 1) Breed match (tuỳ schema bạn: sow.breed / boar.breed)
  const breedMatch = sow?.herd?.type && boar?.herd?.type &&
                   String(sow.herd.type) === String(boar.herd.type);
  console.log("Boar breedMatch: " +  breedMatch);

  // 2) Lịch sử con sống trung bình của boar (dựa trên các lứa với các nái khác)
  const boarAvg = await avgLivePigletsForPig(sow._id) // <- đây là avg của SOW
    .catch(() => 0);
  const boarAvgFromBoar = await GiveBirthModel.aggregate([
    { $match: { boar: new mongoose.Types.ObjectId(boar._id) } },
    { $group: { _id: "$boar", avgLive: { $avg: "$numberOfLivePiglets" } } },
    { $project: { _id: 0, avgLive: 1 } },
  ]);
  const boarStrong = safeNum(boarAvgFromBoar?.[0]?.avgLive, 0) >= THRESHOLDS.lastLitterMinLivePiglets;
  console.log("Boar boarStrong:" + boarStrong);

  // 3) Cận huyết
  const noInbreeding = !hasInbreedingRisk(sow, boar);
  console.log("Boar noInbreeding: " + noInbreeding);

  // 4) Workload
  const uses = await countBoarMatingsLast7d(boar._id);
  const workloadOK = uses <= THRESHOLDS.boarMaxMatingsPer7d;
  console.log("Boar workloadOK: " + workloadOK);

  // 5) Sức khoẻ boar
  const since = new Date(Date.now() - THRESHOLDS.boarHealthyDays * 24 * 60 * 60 * 1000);
  const recentIssues = await HealthHistoryModel.countDocuments({
    pig: boar._id,
    date: { $gte: since },
    result: { $ne: "recovered" },
  });
  const healthy = recentIssues === 0;
  console.log("Boar healthy: " + healthy);

   // 6) Growth Tracking Evaluation ===
  const latestGrowth = pickLatest(await GrowthTrackingModel.find({ pig: boar._id }), "date");
  const weightKg = safeNum(latestGrowth?.weight);
  const length = safeNum(latestGrowth?.length);
  const fcr = safeNum(latestGrowth?.fcr);

  // --- Thể trạng ---
  const weightOK = weightKg >= THRESHOLDS.sowWeightKg; // ngưỡng phối giống heo đực
  console.log("Boar weightOK: " + weightOK);
  let bcsOK = false;
  if (weightKg && length) {
    const lengthM = length / 100;
    const BCS = weightKg / (lengthM * lengthM);
    bcsOK = BCS >= 100 && BCS <= 160;
  }
  console.log("Boar bcsOK: " + bcsOK);
  const fcrOK = fcr && fcr >= 2.0 && fcr <= 3.0;
  console.log("Boar fcrOK: " + fcrOK);

  let score = 0;
  if (breedMatch) score += WEIGHTS.boar.breedMatch;
  if (boarStrong) score += WEIGHTS.boar.strongFertilityHistory;
  if (noInbreeding) score += WEIGHTS.boar.noInbreeding;
  if (workloadOK) score += WEIGHTS.boar.workloadOK;
  if (healthy) score += WEIGHTS.boar.healthy;
  if (weightOK) score += WEIGHTS.readiness.weightOK;   
  if (bcsOK) score += WEIGHTS.readiness.bodyConditionOK;      
  if (fcrOK) score += 10; 

  console.log("Boar score: " + score);
  console.log("--------------------------");

  // lý do gợi ý (để hiển thị UI)
  const reasons = [];
  if (breedMatch) reasons.push("Breed phù hợp");
  if (boarStrong) reasons.push("Lịch sử lứa con sống tốt");
  if (noInbreeding) reasons.push("Không rủi ro cận huyết");
  if (workloadOK) reasons.push("Tải khai thác tinh hợp lý");
  if (healthy) reasons.push("Đực khoẻ mạnh gần đây");
  if (weightOK) reasons.push("Thể trọng đạt chuẩn phối giống");
  if (bcsOK) reasons.push("Tỷ lệ cơ thể cân đối (BCS)");
  if (fcrOK) reasons.push("Hiệu suất FCR tốt");

  return { score, reasons, boarAvgSow: boarAvg };
}

// === Ghi log ML-ready ===
async function logFertilityMetrics({
  sow,
  boar,
  readinessScore,
  boarMatchScore
}) {
  try {
    // --- Growth Tracking (sow) ---
    const latestGrowth = pickLatest(await GrowthTrackingModel.find({ pig: sow._id }), "date");
    const weightAtMating = safeNum(latestGrowth?.weightKg, null);
    const length = safeNum(latestGrowth?.length, null);
    const fcr = safeNum(latestGrowth?.fcr, null);

    // --- Tính tuổi nái (theo ngày) ---
    const ageAtMatingDays = sow?.birthDate ? daysBetween(new Date(), new Date(sow.birthDate)) : null;

    // --- Lấy thông tin cai sữa gần nhất ---
    const latestWeaning = pickLatest(await WeaningModel.find({ pigMother: sow._id }), "weaningDay");
    const weaningOK =
      latestWeaning &&
      ["good", "normal"].includes(latestWeaning.sowHealth?.toLowerCase()) &&
      latestWeaning.avgWeaningWeightKg >= 6 &&
      latestWeaning.numberOfLivePiglets >= 5; // tạm thời điều kiện mềm
    const sowHealthOK = latestWeaning ? ["good", "normal"].includes(latestWeaning.sowHealth?.toLowerCase()) : null;
    const pigletHealthOK = latestWeaning ? latestWeaning.pigletHealth?.toLowerCase() === "good" : null;
    const weaningWeightOK = latestWeaning ? latestWeaning.avgWeaningWeightKg >= 6 : null;

    // --- Tính trung bình lứa con sống trước đó ---
    const avgLitterSizeAgg = await GiveBirthModel.aggregate([
      { $match: { sow: new mongoose.Types.ObjectId(sow._id) } },
      { $group: { _id: "$sow", avgLive: { $avg: "$numberOfLivePiglets" } } },
    ]);
    const avgLitterSize = safeNum(avgLitterSizeAgg?.[0]?.avgLive, null);

    // --- Ghi log ML-ready ---
    await FertilityMetricsLogModel.create({
      pig: sow._id,
      boar: boar?._id,
      ageAtMating: ageAtMatingDays,
      weightAtMating,
      length,
      fcr,
      avgLitterSize,
      readinessScore,
      boarMatchScore,
      weaningOK,
      sowHealthOK,
      pigletHealthOK,
      weaningWeightOK,
      healthRiskScore: null,
      resultSuccess: null,
      resultLitterSize: null,
      timestamp: new Date()
    });

  } catch (e) {
    console.error("FertilityMetricsLog error:", e?.message);
  }
}

async function suggestBoarsForSow(sowId, barnId) {
    const sow = await PigModel.findOne({
      _id: sowId,
      sex: "sow",
      status: { $ne: "pregnant" },
      isDeleted: false
    });
    if (!sow) throw new Error("Sow not found or not eligible.");

    const { score: readinessScore } = await computeSowReadinessScore(sow);

    // 🔥 Filter boar theo chuồng nếu có barnId
    const boarQuery = { sex: "boar", status: { $in: ["active", "ready"] }, isDeleted: false };
    if (barnId) {
      boarQuery.barn = barnId;  // chỉ lấy trong đúng chuồng đã chọn
    }

    const boars = await PigModel.find(boarQuery);

    // Nếu không có con đực trong chuồng này
    if (!boars.length) {
      return {
        sow: { id: String(sow._id), readinessScore: Math.round(readinessScore) },
        suggestions: []
      };
    }

    const ranked = [];
    for (const boar of boars) {
      const { score, reasons } = await computeBoarMatchScore(sow, boar);
      ranked.push({
        boar,
        score,
        reason: reasons.join("; ")
      });
    }

    ranked.sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, 3).map((r) => ({
      boarId: r.boar._id,
      boarName: r.boar.tag || r.boar.name || String(r.boar._id),
      matchScore: Math.round(r.score),
      reason: r.reason || "Phù hợp tổng thể"
    }));

    // Log cho ML-ready (optional)
    for (const item of top) {
      const boar = boars.find((b) => String(b._id) === String(item.boarId));
      await logFertilityMetrics({ sow, boar, readinessScore, boarMatchScore: item.matchScore });
    }

    return {
      sow: { id: String(sow._id), readinessScore: Math.round(readinessScore) },
      suggestions: top
    };
}

module.exports = { suggestBoarsForSow };