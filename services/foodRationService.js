const mongoose = require('mongoose');
const BarnModel = require('../models/Barn');
const FoodRationModel = require('../models/FoodRation');
const FeedingLogModel = require('../models/FeedingLog');
const FoodWarehouseModel = require('../models/FoodWarehouse');
const MeditionWarehouseModel = require('../models/MeditionWareHouse');
const RationFoodDetailModel = require('../models/RationFoodDetail');
const RationMeditionDetailModel = require('../models/RationMeditionDetail');
const { parseCapacity, toBaseUnit, normalizeWeightToKg } = require("./cvs");
const { calculateAndSaveInvestmentCost } = require("../services/calculatePricePerBarn");

async function computeFoodKgMapFromDetails(details, barns, feeds, days) {
  const map = {};
  for (const d of details) {
    console.log('Running for detail', d.meal);
    if (!d.food_warehouse) continue;
    const mealWeightKg = normalizeWeightToKg(d.weight || 0, d.weight_unit || 'kg');
    if (isNaN(mealWeightKg) || mealWeightKg <= 0) continue;  
    let totalKg = 0;
    for (const b of barns) {
      const pigs = Number(b.total_pigs || 0);
      if (isNaN(pigs) || pigs <= 0) continue;
      totalKg += mealWeightKg * Number(feeds || 1) * pigs * Number(days || 1);
      console.log(totalKg);
    }
    map[String(d.food_warehouse)] = (map[String(d.food_warehouse)] || 0) + totalKg;
  }
  return map;
}

function computeMedBaseMapFromDetails(medDetails, foodDetailsUsed, barns, feeds, days) {
  const map = {};
  for (const md of medDetails) {
    if (!md.warehouse && !md.food_warehouse) continue;
    const medWare = md.warehouse || md.food_warehouse;
    const matchedFood = foodDetailsUsed.find(f => String(f.meal) === String(md.meal));
    if (!matchedFood) continue;
    const mealWeightKg = normalizeWeightToKg(matchedFood.weight || 0, matchedFood.weight_unit || 'kg');
    if (!md.dosage_unit) throw new Error(`dosage_unit thiếu cho meal ${md.meal}`);
    const dosageUnitRaw = String(md.dosage_unit).toLowerCase().replace(/\s+/g, '');
    const m = dosageUnitRaw.match(/^([a-z]+)\/kg$/);
    if (!m) throw new Error(`dosage_unit không hợp lệ: ${md.dosage_unit}`);
    const dosageUnit = m[1]; 
    let totalBaseForMed = 0;
    for (const b of barns) {
      const pigs = Number(b.total_pigs || 0);
      if (isNaN(pigs) || pigs <= 0) continue;
      const feedKgForBarn = mealWeightKg * Number(feeds || 1) * pigs * Number(days || 1);
      const dosageValue = Number(md.dosage || 0);
      let baseMultiplier = 1;
      if (dosageUnit === 'kg') baseMultiplier = 1000;
      if (dosageUnit === 'l') baseMultiplier = 1000;
      totalBaseForMed += dosageValue * baseMultiplier * feedKgForBarn;
    }
    map[String(medWare)] = (map[String(medWare)] || 0) + totalBaseForMed;
  }
  const final = {};
  for (const k of Object.keys(map)) final[k] = { totalBase: map[k] };
  return final;
}

async function resolveBarnsFromPayload(payload, session) {
  if (Array.isArray(payload.barn) && payload.barn.length) {
    return await BarnModel.find({ _id: { $in: payload.barn } }).session(session);
  }
  const area = payload.area ?? payload.breedingArea;
  if (area) {
    return await BarnModel.find({ breedingarea: area }).session(session);
  }
  return null;
}

async function createFoodRationService(payload) {
  const session = await mongoose.startSession();
  try {
    const summary = { usedFood: [], usedMedition: [] };

    await session.withTransaction(async () => {
      const {
        barn, breedingArea,
        foodDetails = [], medDetails = [],
        number_of_feedings_per_day = 1,
        start_time, end_time, name
      } = payload;

      // --- Resolve barns ---
      let barnIds = Array.isArray(barn) && barn.length ? barn : [];
      if ((!barnIds || barnIds.length === 0) && breedingArea) {
        const allBarns = await BarnModel.find({ breedingarea: breedingArea }).select('_id').session(session);
        barnIds = allBarns.map(b => b._id);
      }
      if (!barnIds || barnIds.length === 0) throw new Error("Phải cung cấp barn (hoặc breedingArea) hợp lệ.");

      const barns = await BarnModel.find({ _id: { $in: barnIds } }).session(session);
      if (!barns || barns.length === 0) throw new Error("Không tìm thấy chuồng hợp lệ.");

      // --- Compute days (min 1) ---
      const days = Math.max(1, Math.ceil((new Date(end_time) - new Date(start_time)) / (1000 * 60 * 60 * 24)));

      // --- FOOD: total kg required per food warehouse ---
      const requiredKgPerFoodWh = {}; // whId -> kg
      for (const meal of foodDetails) {
        if (!meal.warehouse) throw new Error(`Meal ${meal.meal} thiếu field warehouse.`);
        // validate warehouse exists
        const fw = await FoodWarehouseModel.findById(meal.warehouse).session(session);
        if (!fw) throw new Error(`Không tìm thấy FoodWarehouse id=${meal.warehouse}`);
        const mealWeightKg = normalizeWeightToKg(meal.weight || 0, meal.weight_unit || fw.unit || 'kg');
        if (isNaN(mealWeightKg) || mealWeightKg <= 0) continue;

        let totalKgThisMeal = 0;
        for (const b of barns) {
          const pigs = Number(b.total_pigs || 0);
          if (isNaN(pigs) || pigs <= 0) continue;
          const kgForThisBarn = mealWeightKg * Number(number_of_feedings_per_day || 1) * pigs * days;
          totalKgThisMeal += kgForThisBarn;
        }
        requiredKgPerFoodWh[meal.warehouse] = (requiredKgPerFoodWh[meal.warehouse] || 0) + totalKgThisMeal;
      }

      // --- CHECK food inventory (kg -> bags) ---
      const toDeductFood = []; // { fw, requiredBags, requiredKg }
      for (const whId of Object.keys(requiredKgPerFoodWh)) {
        const totalKg = requiredKgPerFoodWh[whId];
        const fw = await FoodWarehouseModel.findById(whId).session(session);
        if (!fw) throw new Error(`FoodWarehouse id=${whId} mất khi re-read.`);
        let bagWeightKg = Number(fw.weight || 0);
        const fwUnit = (fw.unit || 'kg').toLowerCase();
        if (fwUnit === 'g') bagWeightKg = bagWeightKg / 1000;
        if (!bagWeightKg || isNaN(bagWeightKg) || bagWeightKg <= 0) {
          throw new Error(`FoodWarehouse ${fw.name} có weight không hợp lệ: ${fw.weight} ${fw.unit}`);
        }
        const requiredBags = Math.ceil(totalKg / bagWeightKg);
        const originalInventory = Number(fw.inventory || 0);
        const import_price = Number(fw.import_price || 0);
        if (fw.inventory < requiredBags) throw new Error(`Không đủ thức ăn "${fw.name}". Cần ${requiredBags} bao, còn ${fw.inventory} bao.`);
        toDeductFood.push({ fw, requiredBags, requiredKg: totalKg, bagWeightKg, originalInventory, import_price});
      }

      // --- MEDICATION: compute required base units (g or ml) per med warehouse ---
      const requiredBasePerMedWh = {}; // whId -> { totalBase, baseType, medName }
      for (const med of medDetails) {
        if (!med.warehouse) continue;
        const mw = await MeditionWarehouseModel.findById(med.warehouse).session(session);
        if (!mw) throw new Error(`Không tìm thấy MeditionWarehouse id=${med.warehouse}`);

        // parse capacity
        const capParsed = parseCapacity(mw.capacity);
        const capBase = toBaseUnit(capParsed.amount, capParsed.unit); // { base in g or ml, type }

        // parse dosage_unit like 'g/kg', 'ml/kg', 'kg/kg', 'l/kg'
        if (!med.dosage_unit) throw new Error(`Meal ${med.meal} thiếu dosage_unit`);
        const dosageUnitRaw = String(med.dosage_unit).toLowerCase().replace(/\s+/g, '');
        const m = dosageUnitRaw.match(/^([a-z]+)\/kg$/);
        if (!m) throw new Error(`dosage_unit không hợp lệ: ${med.dosage_unit}`);
        const dosageUnit = m[1];

        // find matching food meal to get meal weight per pig
        const matchedFood = foodDetails.find(f => f.meal === med.meal);
        if (!matchedFood) continue; // nếu không có food match thì không tính med cho bữa đó

        const mealWeightKg = normalizeWeightToKg(matchedFood.weight || 0, matchedFood.weight_unit || 'kg');

        let totalBaseRequired = 0;
        for (const b of barns) {
          const pigs = Number(b.total_pigs || 0);
          if (isNaN(pigs) || pigs <= 0) continue;
          const feedKgForBarn = mealWeightKg * Number(number_of_feedings_per_day || 1) * pigs * days;
          console.log(mealWeightKg + " " + number_of_feedings_per_day + " " + pigs + " " + days);
          const dosageValue = Number(med.dosage || 0);
          let baseMultiplier = 1;
          if (dosageUnit === 'kg') baseMultiplier = 1000; // kg -> g
          if (dosageUnit === 'l') baseMultiplier = 1000; // l -> ml
          // dosageUnit 'g' or 'ml' => multiplier 1
          const baseAmountForThisBarn = dosageValue * baseMultiplier * feedKgForBarn; // grams or ml
          totalBaseRequired += baseAmountForThisBarn;
        }

        if (!requiredBasePerMedWh[med.warehouse]) requiredBasePerMedWh[med.warehouse] = { totalBase: 0, baseType: capBase.type, medName: mw.name };
        requiredBasePerMedWh[med.warehouse].totalBase += totalBaseRequired;
      }

      // --- CHECK med inventory (base -> units) ---
      const toDeductMed = []; // { mw, requiredUnits, requiredBase }
      for (const whId of Object.keys(requiredBasePerMedWh)) {
        const info = requiredBasePerMedWh[whId];
        const mw = await MeditionWarehouseModel.findById(whId).session(session);
        if (!mw) throw new Error(`MeditionWarehouse id=${whId} mất khi re-read.`);
        const capParsed = parseCapacity(mw.capacity);
        const capBase = toBaseUnit(capParsed.amount, capParsed.unit);
        if (capBase.type !== info.baseType) {
          throw new Error(`Loại đơn vị giữa dosage (${info.baseType}) và capacity (${capBase.type}) không khớp cho ${mw.name}`);
        }
        let requiredUnits = info.totalBase / capBase.base;
        if(requiredUnits < 1) requiredUnits += 1;
        requiredUnits = Math.ceil(requiredUnits);
        const originalInventory = Number(mw.inventory || 0);
        const import_price = Number(mw.import_price || 0);
        if (mw.inventory < requiredUnits) throw new Error(`Không đủ thuốc "${mw.name}". Cần ${requiredUnits}, còn ${mw.inventory}`);
        toDeductMed.push({ mw, requiredUnits, requiredBase: info.totalBase, baseType: info.baseType, originalInventory, import_price });
      }

      await calculateAndSaveInvestmentCost({ barns, toDeductFood, toDeductMed, session });

      // --- Perform deductions (within transaction) ---
      for (const item of toDeductFood) {
        item.fw.inventory -= item.requiredBags;
        await item.fw.save({ session });
        summary.usedFood.push({
          warehouseId: item.fw._id,
          warehouseName: item.fw.name,
          usedBags: item.requiredBags,
          usedKg: item.requiredKg
        });
      }
      for (const item of toDeductMed) {
        item.mw.inventory -= item.requiredUnits;
        await item.mw.save({ session });
        summary.usedMedition.push({
          warehouseId: item.mw._id,
          warehouseName: item.mw.name,
          usedUnits: item.requiredUnits,
          usedBaseAmount: item.requiredBase,
          baseType: item.baseType
        });
      }

      // --- Create FoodRation per barn and create separate detail docs (no arrays in FoodRation) ---
      for (const b of barns) {
        const pigs = Number(b.total_pigs || 0);
        if (isNaN(pigs) || pigs <= 0) continue;

        // compute total_food_intake_per_day (kg/day) for this barn
        let totalWeightPerConPerDay = 0;
        for (const meal of foodDetails) {
          const mealWeightKg = normalizeWeightToKg(meal.weight || 0, meal.weight_unit || 'kg');
          totalWeightPerConPerDay += mealWeightKg * Number(number_of_feedings_per_day || 1);
        }
        const total_food_intake_per_day = totalWeightPerConPerDay * pigs;

        const rationRecord = {
          name: name || `Chế độ ăn ${b.name} - ${new Date().toISOString()}`,
          start_time, end_time, number_of_feedings_per_day,
          total_food_intake_per_day,
          barn: [b._id]
        };

        const created = await FoodRationModel.create([rationRecord], { session });
        const rationDoc = created[0];

        // create RationFoodDetail docs (one doc per meal)
        for (const fd of foodDetails) {
          await RationFoodDetailModel.create([{
            meal: fd.meal,
            weight: fd.weight,
            weight_unit: fd.weight_unit || 'kg',
            food_ration: rationDoc._id,
            food_warehouse: fd.warehouse
          }], { session });
        }

        // create RationMeditionDetail docs (one doc per med entry)
        for (const md of medDetails) {
          await RationMeditionDetailModel.create([{
            meal: md.meal,
            dosage: md.dosage,
            dosage_unit: md.dosage_unit,
            food_ration: rationDoc._id,
            medition_warehouse: md.warehouse
          }], { session });
        }
      }

    }); // end transaction

    session.endSession();
    return { message: 'Thiết lập chế độ ăn thành công (transaction committed).', summary };

  } catch (err) {
    try { await session.abortTransaction(); } catch (e) {}
    session.endSession();
    throw err;
  }
}

async function updateFoodRationService(id, payload) {
  const session = await mongoose.startSession();
  try {
    const resultSummary = { returnedFood: [], deductedFood: [], returnedMed: [], deductedMed: [], removedMeals: [] };

    await session.withTransaction(async () => {
      // 1) load old ration
      const old = await FoodRationModel.findById(id).session(session);
      if (!old) throw new Error('FoodRation không tồn tại.');

      const toDeductFood = [];
      const toDeductMed = [];

      const now = new Date();
      if (new Date(old.end_time) < now) {
        throw new Error('Không thể chỉnh sửa khẩu phần vì đã quá thời gian kết thúc (end_time).');
      }

      // 2) resolve barnsOld and barnsNew
      const barnsOld = await BarnModel.find({ _id: { $in: old.barn } }).session(session);
      let barnsNew = await resolveBarnsFromPayload(payload, session);
      if (!barnsNew || barnsNew.length === 0) barnsNew = barnsOld;

      if (!barnsOld || barnsOld.length === 0) throw new Error('Không tìm thấy chuồng (old).');
      if (!barnsNew || barnsNew.length === 0) throw new Error('Không tìm thấy chuồng (new).');

      // 2.a) BUILD newBarnIds (array of ObjectId strings) for uniqueness checks and update
      const newBarnIds = barnsNew.map(b => String(b._id));

      // uniqueness check (Kiểu A: không cho phép barn có ration active khác)
      for (const barnId of newBarnIds) {
        const conflict = await FoodRationModel.findOne({
          barn: barnId,
          _id: { $ne: id },
          end_time: { $gte: now } // considered active
        }).session(session).lean();
        if (conflict) {
          throw new Error(`Chuồng (id=${barnId}) đã có FoodRation active khác (id=${conflict._id}). Không thể gán.`);
        }
      }

      // compute days old / new
      const daysOld = Math.max(1, Math.ceil((new Date(old.end_time) - new Date(old.start_time)) / (1000*60*60*24)));
      const startNew = payload.start_time ?? old.start_time;
      const endNew = payload.end_time ?? old.end_time;
      const daysNew = Math.max(1, Math.ceil((new Date(endNew) - new Date(startNew)) / (1000*60*60*24)));

      const feedsOld = old.number_of_feedings_per_day || 1;
      const feedsNew = payload.number_of_feedings_per_day ?? old.number_of_feedings_per_day;

      // load old details
      const oldFoodDetails = await RationFoodDetailModel.find({ food_ration: id }).session(session);
      const oldMedDetails = await RationMeditionDetailModel.find({ food_ration: id }).session(session);

      const rmMeals = Array.isArray(payload.removeMeals) ? payload.removeMeals.map(m => String(m)) : [];
      // Lọc bỏ các meal bị xóa ra khỏi dữ liệu gốc
      const filteredOldFoodDetails = oldFoodDetails.filter(f => !rmMeals.includes(String(f.meal)));
      const filteredOldMedDetails = oldMedDetails.filter(m => !rmMeals.includes(String(m.meal)));

      // payload arrays
      const payloadFood = Array.isArray(payload.foodDetails) ? payload.foodDetails : [];
      const payloadMed = Array.isArray(payload.medDetails) ? payload.medDetails : [];
      const removeMeals = Array.isArray(payload.removeMeals) ? payload.removeMeals.map(m => String(m)) : [];

      // prepare merged arrays (old baseline, override with payload for meals provided)
      const mergedFoodNew = [];
      const mergedFoodOld = [];
      
      for (const f of filteredOldFoodDetails) {
      mergedFoodOld.push({
        meal: f.meal,
        weight: f.weight,
        weight_unit: f.weight_unit,
        food_warehouse: String(f.food_warehouse),
      });

      const mealName = String(f.meal);
      const isRemoved = removeMeals.includes(mealName);
      const isUpdated = payloadFood.some(pf => String(pf.meal) === mealName);
      if (!isRemoved && !isUpdated) {
        mergedFoodNew.push({
          meal: f.meal,
          weight: f.weight,
          weight_unit: f.weight_unit,
          food_warehouse: String(f.food_warehouse),
        });
      }
    }

    // Sau đó thêm các bữa mới / cập nhật
    for (const pf of payloadFood) {
      const ware = pf.warehouse || pf.food_warehouse || pf.foodWarehouse;
      mergedFoodNew.push({
        meal: pf.meal,
        weight: pf.weight,
        weight_unit: pf.weight_unit || 'kg',
        food_warehouse: ware,
      });
    }

      const mergedMedNew = [];
      const mergedMedOld = [];
      for (const m of filteredOldMedDetails) {
        mergedMedOld.push({
          meal: m.meal,
          dosage: m.dosage,
          dosage_unit: m.dosage_unit,
          warehouse: String(m.medition_warehouse || m.warehouse),
        });

        const mealName = String(m.meal);
        const isRemoved = removeMeals.includes(mealName);
        const isUpdated = payloadMed.some(pm => String(pm.meal) === mealName);
        if (!isRemoved && !isUpdated) {
          mergedMedNew.push({
            meal: m.meal,
            dosage: m.dosage,
            dosage_unit: m.dosage_unit,
            warehouse: String(m.medition_warehouse || m.warehouse),
          });
        }
      }

      for (const pm of payloadMed) {
        const ware = pm.warehouse || pm.medition_warehouse || pm.food_warehouse;
        mergedMedNew.push({
          meal: pm.meal,
          dosage: pm.dosage,
          dosage_unit: pm.dosage_unit,
          warehouse: ware,
        });
      }

      // compute old/new consumption maps (for availability checks)
      const oldFoodMap = computeFoodKgMapFromDetails(mergedFoodOld, barnsOld, feedsOld, daysOld);
      const newFoodMap = computeFoodKgMapFromDetails(mergedFoodNew, barnsOld, feedsNew, daysNew);

      const oldMedMapSimple = computeMedBaseMapFromDetails(mergedMedOld, mergedFoodOld, barnsOld, feedsOld, daysOld);
      const newMedMapSimple = computeMedBaseMapFromDetails(mergedMedNew, mergedFoodNew, barnsOld, feedsNew, daysNew);

      // enrich med maps with base types
      const oldMedMap = {};
      for (const whId of Object.keys(oldMedMapSimple)) {
        const mw = await MeditionWarehouseModel.findById(whId).session(session);
        if (!mw) throw new Error(`MeditionWarehouse ${whId} không tồn tại`);
        const cap = parseCapacity(mw.capacity);
        const capBase = toBaseUnit(cap.amount, cap.unit);
        oldMedMap[whId] = { totalBase: oldMedMapSimple[whId].totalBase || 0, baseType: capBase.type, medName: mw.name };
      }
      const newMedMap = {};
      for (const whId of Object.keys(newMedMapSimple)) {
        const mw = await MeditionWarehouseModel.findById(whId).session(session);
        if (!mw) throw new Error(`MeditionWarehouse ${whId} không tồn tại`);
        const cap = parseCapacity(mw.capacity);
        const capBase = toBaseUnit(cap.amount, cap.unit);
        newMedMap[whId] = { totalBase: newMedMapSimple[whId].totalBase || 0, baseType: capBase.type, medName: mw.name, capBase };
      }

      // prepare foodAdjusts & medAdjusts for overall update (before removals applied)
      const foodAdjusts = [];
      const allFoodWh = Array.from(new Set([...Object.keys(oldFoodMap), ...Object.keys(newFoodMap)]));
      for (const whId of allFoodWh) {
        const oldKg = oldFoodMap[whId] || 0;
        const newKg = newFoodMap[whId] || 0;
        const fw = await FoodWarehouseModel.findById(whId).session(session);
        if (!fw) throw new Error(`FoodWarehouse ${whId} không tồn tại`);
        let bagKg = Number(fw.weight || 0);
        const unit = (fw.unit || 'kg').toLowerCase();
        if (unit === 'g') bagKg = bagKg / 1000;
        if (!bagKg || bagKg <= 0) throw new Error(`Bag weight không hợp lệ cho ${fw.name}`);
        const oldBags = Math.ceil(oldKg / bagKg);
        const newBags = Math.ceil(newKg / bagKg);
        foodAdjusts.push({ fw, oldBags, newBags, delta: newBags - oldBags, oldKg, newKg });
      }

      const medAdjusts = [];
      const allMedWh = Array.from(new Set([...Object.keys(oldMedMap), ...Object.keys(newMedMap)]));
      for (const whId of allMedWh) {
        const oldBase = oldMedMap[whId]?.totalBase || 0;
        const newBase = newMedMap[whId]?.totalBase || 0;
        const mw = await MeditionWarehouseModel.findById(whId).session(session);
        if (!mw) throw new Error(`MeditionWarehouse ${whId} không tồn tại`);
        const cap = parseCapacity(mw.capacity);
        const capBase = toBaseUnit(cap.amount, cap.unit);
        const oldUnits = Math.ceil(oldBase / capBase.base);
        const newUnits = Math.ceil(newBase / capBase.base);
        medAdjusts.push({ mw, oldUnits, newUnits, delta: newUnits - oldUnits, oldBase, newBase, baseType: capBase.type, capBase });
      }

      // pre-check availability after returning old amounts (for overall update)
      for (const it of foodAdjusts) {
        if (it.delta > 0) {
          const avail = it.fw.inventory + it.oldBags;
          if (avail < it.newBags) throw new Error(`Không đủ thức ăn ${it.fw.name}. Cần ${it.newBags}, khả dụng ${avail}`);
        }
      }
      for (const it of medAdjusts) {
        if (it.delta > 0) {
          const avail = it.mw.inventory + it.oldUnits;
          if (avail < it.newUnits) throw new Error(`Không đủ thuốc ${it.mw.name}. Cần ${it.newUnits}, khả dụng ${avail}`);
        }
      }

      // BEFORE applying global return/deduct, handle explicit removeMeals (do returns for removed meals based on FeedingLog)
      // For each meal in removeMeals: compute remainingDays = totalDays - executedLogCount and return accordingly, then delete details (food+med)
      for (const mealName of removeMeals) {
        // find existing details
        const fDetail = await RationFoodDetailModel.findOne({ food_ration: id, meal: mealName }).session(session);
        if (!fDetail) {
          // nothing to remove (skip)
          continue;
        }
        // compute totalDays based on current ration (we'll use old.start/end)
        const totalDaysForMeal = Math.max(1, Math.ceil((new Date(old.end_time) - new Date(old.start_time)) / (1000*60*60*24)));
        // count executed feed logs for this ration & meal (type 'food'); logs are per execution
        const executedFeedCount = await FeedingLogModel.countDocuments({
          food_ration: id,
          meal: mealName,
          status: "Hoàn thành"
        }).session(session);
        const remainFeedCount = Math.max(0, totalDaysForMeal - executedFeedCount);

        // FOOD: compute return kg and convert to bags
        if (fDetail.food_warehouse) {
          const fw = await FoodWarehouseModel.findById(fDetail.food_warehouse).session(session);
          if (!fw) throw new Error(`FoodWarehouse ${fDetail.food_warehouse} không tồn tại khi remove meal ${mealName}`);
          const mealWeightKg = normalizeWeightToKg(fDetail.weight || 0, fDetail.weight_unit || 'kg'); // kg per pig per meal
          // When computing return quantity: multiply by feeds per day? Our design: fDetail.weight is per meal; feeds per day is already accounted earlier in global calculations.
          // Based on prior logic, each meal weight multiplied by number_of_feedings_per_day. But since meal is specific, we assume weight is per meal instance; remainingCount already accounts days * feeds? To follow previous approach: return = weight * feedsNew * pigs * remainFeedCount
          // However simpler and consistent with create logic earlier: total feed kg for meal across barns over period = weight * number_of_feedings_per_day * pigs * days.
          // We'll compute per warehouse: sum over barnsOld pigs
          let totalReturnKg = 0;
          let pigs = 0;
          for (const b of barnsOld) {
            pigs = Number(b.total_pigs || 0);
            if (isNaN(pigs) || pigs <= 0) continue;
            totalReturnKg += mealWeightKg * Number(feedsOld || 1) * pigs * remainFeedCount;
          }
          // convert to bags
          let bagWeightKg = Number(fw.weight || 0);
          const fwUnit = (fw.unit || 'kg').toLowerCase();
          if (fwUnit === 'g') bagWeightKg = bagWeightKg / 1000;
          if (!bagWeightKg || bagWeightKg <= 0) throw new Error(`Bag weight không hợp lệ cho ${fw.name}`);
          const returnBags = Math.ceil(totalReturnKg / bagWeightKg);
          fw.inventory += returnBags;
          console.log("fw.inventory " + fw.inventory);
          await fw.save({ session });

          const useKg = mealWeightKg * Number(feedsOld || 1) * pigs * totalDaysForMeal;
          const oldRequiredBags = Math.ceil(useKg / bagWeightKg);
          const usedBags = oldRequiredBags - returnBags;

          // cập nhật inventory vào các foodAdjust có cùng warehouse
          for (const it of foodAdjusts) {
            if (String(it.fw._id) === String(fw._id)) {
              it.fw.inventory = fw.inventory; // đồng bộ giá trị mới nhất
            }
          }
          
          toDeductFood.push({
            import_price: Number(fw.import_price || 0),
            originalInventory: Number(fw.original_inventory),
            requiredBags: Number(usedBags)
          });     
          resultSummary.returnedFood.push({ warehouseId: fw._id, warehouseName: fw.name, meal: mealName, returnedBags: returnBags, returnedKg: totalReturnKg });
        }
        

        // MED: find med detail for meal and return units based on dosage
        const mDetail = await RationMeditionDetailModel.findOne({ food_ration: id, meal: mealName }).session(session);
        if (mDetail && (mDetail.medition_warehouse || mDetail.warehouse)) {
          const medWareId = mDetail.medition_warehouse || mDetail.warehouse;
          const mw = await MeditionWarehouseModel.findById(medWareId).session(session);
          if (!mw) throw new Error(`MeditionWarehouse ${medWareId} không tồn tại khi remove meal ${mealName}`);
          // compute total base needed for remainingCount (grams or ml)
          // find matching food detail weight
          const mealWeightKg = normalizeWeightToKg(fDetail.weight || 0, fDetail.weight_unit || 'kg');
          // dosage unit parse
          const dosageUnitRaw = String(mDetail.dosage_unit || '').toLowerCase().replace(/\s+/g, '');
          const matchDos = dosageUnitRaw.match(/^([a-z]+)\/kg$/);
          if (!matchDos) throw new Error(`dosage_unit không hợp lệ cho med của meal ${mealName}`);
          const dosageUnit = matchDos[1];
          const dosageValue = Number(mDetail.dosage || 0);
          let baseMultiplier = 1;
          if (dosageUnit === 'kg') baseMultiplier = 1000;
          if (dosageUnit === 'l') baseMultiplier = 1000;
          let totalReturnBase = 0; // grams or ml
          let pigs ;
          for (const b of barnsOld) {
            pigs = Number(b.total_pigs || 0);
            if (isNaN(pigs) || pigs <= 0) continue;
            const feedKgForBarn = mealWeightKg * Number(feedsOld || 1) * pigs * remainFeedCount;
            totalReturnBase += dosageValue * baseMultiplier * feedKgForBarn;
            console.log("totalReturnBase: " + totalReturnBase);
          }
          // determine capacity base
          const cap = parseCapacity(mw.capacity);
          const capBase = toBaseUnit(cap.amount, cap.unit); // base in g or ml
          if (capBase.type !== (dosageUnit === 'g' || dosageUnit === 'kg' ? 'mass' : 'volume')) {
            // types mismatch maybe; still proceed but warn
            // (we won't throw here, but you can adjust policy)
          }
          const returnUnits = Math.ceil(totalReturnBase / capBase.base);
          mw.inventory += returnUnits;
          console.log("mw.inventory " + mw.inventory)
          await mw.save({ session });

          const oldFeedKgForBarn = mealWeightKg * Number(feedsOld || 1) * pigs * Number(totalDaysForMeal || 1);
          const totalBaseForMed = dosageValue * baseMultiplier * oldFeedKgForBarn;
          const usedUnits = Math.ceil(totalBaseForMed / capBase.base);
          const totalUnitsUsed = usedUnits - returnUnits;

          for (const it of medAdjusts) {
            if (String(it.mw._id) === String(mw._id)) {
              it.mw.inventory = mw.inventory; // đồng bộ giá trị mới nhất
            }
          }
          toDeductMed.push({
            import_price: Number(mw.import_price || 0),
            originalInventory: Number(mw.original_inventory),
            requiredUnits: Number(totalUnitsUsed)
          });     
          resultSummary.returnedMed.push({ warehouseId: mw._id, warehouseName: mw.name, meal: mealName, returnedUnits: returnUnits, returnedBase: totalReturnBase });
        }

        // finally delete the meal and its med detail
        await RationFoodDetailModel.deleteOne({ _id: fDetail._id }).session(session);
        if (mDetail) await RationMeditionDetailModel.deleteOne({ _id: mDetail._id }).session(session);
        resultSummary.removedMeals.push({ meal: mealName });
      } // end loop removeMeals

      // After removeMeals handled (returns already applied), apply the global return/deduct for the overall update (for meals that are updated/kept)
      // (This is the same logic as in create/update earlier)

      // pre-check availability after returning old amounts (for overall update)
      for (const it of foodAdjusts) {
        if (it.delta > 0) {
          const avail = it.fw.inventory + it.oldBags;
          if (avail < it.newBags) throw new Error(`Không đủ thức ăn ${it.fw.name}. Cần ${it.newBags}, khả dụng ${avail}`);
        }
      }
      for (const it of medAdjusts) {
        if (it.delta > 0) {
          const avail = it.mw.inventory + it.oldUnits;
          if (avail < it.newUnits) throw new Error(`Không đủ thuốc ${it.mw.name}. Cần ${it.newUnits}, khả dụng ${avail}`);
        }
      }

      // apply overall: return old -> deduct new (food)
      for (const it of foodAdjusts) {
        if (it.oldBags > 0) {
          console.log("Cộng kho ăn: " + it.fw.inventory + " + " + it.oldBags);
          it.fw.inventory += it.oldBags;
          console.log("Kết quả: " + it.fw.inventory);
          await it.fw.save({ session });
          // we might have already returned some bags via removeMeals; still safe because these are overall adjustments
        }
      }
      for (const it of foodAdjusts) {
        console.log("Trừ kho ăn: " + it.fw.inventory + " - " + it.newBags);
        it.fw.inventory -= it.newBags;
        console.log("Kết quả: " + it.fw.inventory);
        if (it.fw.inventory < 0) throw new Error(`Kho ${it.fw.name} âm sau trừ.`);
        await it.fw.save({ session });
        if (it.delta !== 0) resultSummary.deductedFood.push({ warehouseId: it.fw._id, warehouseName: it.fw.name, deltaBags: it.delta });
      }

      // meds overall
      for (const it of medAdjusts) {
        if (it.oldUnits > 0) {
          console.log("Cộng kho thuốc " + it.mw.inventory + " + " + it.oldUnits);
          it.mw.inventory += it.oldUnits;
          console.log("Kết quả: " + it.mw.inventory);
          await it.mw.save({ session });
        }
      }
      for (const it of medAdjusts) {
        console.log("Trừ kho thuốc: " + it.mw.inventory + " - " + it.newUnits);
        it.mw.inventory -= it.newUnits;
        console.log("Kết quả: " + it.mw.inventory);
        if (it.mw.inventory < 0) throw new Error(`Kho thuốc ${it.mw.name} âm sau trừ.`);
        await it.mw.save({ session });
        if (it.delta !== 0) resultSummary.deductedMed.push({ warehouseId: it.mw._id, warehouseName: it.mw.name, deltaUnits: it.delta });
      }

      for (const it of foodAdjusts) {
          if (it.delta > 0) {
          toDeductFood.push({
            import_price: Number(it.fw.import_price || 0),
            // Nếu có dữ liệu gốc thì dùng, nếu không fallback về kho hiện tại
            originalInventory: Number(it.fw.original_inventory),
            requiredBags: Number(it.delta)
          });
        }
      }
    
      for (const it of medAdjusts) {
          toDeductMed.push({
            import_price: Number(it.mw.import_price || 0),
            originalInventory: Number(it.mw.original_inventory), // tồn kho trước khi trừ
            requiredUnits: Number(it.delta)
          });
      }
      toDeductMed.forEach((item, index) => {
        console.log(`Item ${index + 1}:`, item);
      });

      // Gọi hàm tính chi phí
      await calculateAndSaveInvestmentCost({
        barns: barnsOld,       
        toDeductFood,
        toDeductMed,
        session
      });

      // 12) Persist changes for meals provided in payload (update/create)
      for (const pf of payloadFood) {
        const mealName = pf.meal;
        // if this meal was included in removeMeals, skip (can't both remove and update)
        if (removeMeals.includes(String(mealName))) continue;
        const ware = pf.warehouse || pf.food_warehouse || pf.foodWarehouse;
        const update = { meal: mealName, weight: pf.weight, weight_unit: pf.weight_unit || 'kg', food_ration: id, food_warehouse: ware };
        const existing = await RationFoodDetailModel.findOne({ food_ration: id, meal: mealName }).session(session);
        if (existing) {
          await RationFoodDetailModel.updateOne({ _id: existing._id }, { $set: update }, { session });
        } else {
          await RationFoodDetailModel.create([update], { session });
        }
      }

      for (const pm of payloadMed) {
        const mealName = pm.meal;
        if (removeMeals.includes(String(mealName))) continue;
        const ware = pm.warehouse || pm.medition_warehouse || pm.food_warehouse;
        const update = { meal: mealName, dosage: pm.dosage, dosage_unit: pm.dosage_unit, food_ration: id, medition_warehouse: ware };
        const existing = await RationMeditionDetailModel.findOne({ food_ration: id, meal: mealName }).session(session);
        if (existing) {
          await RationMeditionDetailModel.updateOne({ _id: existing._id }, { $set: update }, { session });
        } else {
          await RationMeditionDetailModel.create([update], { session });
        }
      }

      // 13) update FoodRation top-level: barn, times, name, feeds
      const finalBarnIds = Array.isArray(payload.barn) && payload.barn.length
        ? payload.barn
        : (payload.area || payload.breedingArea)
          ? (await BarnModel.find({ breedingarea: payload.area ?? payload.breedingArea }).session(session)).map(b => b._id)
          : old.barn;

      const updateDoc = {
        name: payload.name ?? old.name,
        start_time: payload.start_time ?? old.start_time,
        end_time: payload.end_time ?? old.end_time,
        number_of_feedings_per_day: payload.number_of_feedings_per_day ?? old.number_of_feedings_per_day,
        barn: finalBarnIds
      };
      await FoodRationModel.updateOne({ _id: id }, { $set: updateDoc }, { session });


    }); // end transaction

    session.endSession();
    return { message: 'Cập nhật thành công', resultSummary };

  } catch (err) {
    try { await session.abortTransaction(); } catch (e) {}
    session.endSession();
    throw err;
  }
}

async function deleteFoodRationService({ foodRationId, breedingAreaId }) {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Lấy danh sách FoodRation cần xóa
      let rations;
      let barns;
      if (foodRationId) {
        rations = await FoodRationModel.find({ _id: foodRationId }).session(session);
      } else {
        const barns = await BarnModel.find({ breedingarea: breedingAreaId }).session(session);
        const barnIds = barns.map(b => b._id);
        rations = await FoodRationModel.find({ barn: { $in: barnIds } }).session(session);
      }

      if (!rations || rations.length === 0) {
        throw new Error("Không tìm thấy FoodRation nào để xóa");
      }

      let toDeductFood = []
      let toDeductMed = []

      // 2️⃣ Xử lý từng FoodRation
      for (const ration of rations) {
        const foodDetails = await RationFoodDetailModel.find({ food_ration: ration._id }).session(session);
        const medDetails = await RationMeditionDetailModel.find({ food_ration: ration._id }).session(session);  

        // 3️⃣ Tính số ngày thực hiện còn lại dựa trên log “Hoàn thành”
        const startTime = new Date(ration.start_time);
        const endTime = new Date(ration.end_time);
        const totalDaysForMeal = Math.max(1, Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)));
        const feedsPerDay = ration.number_of_feedings_per_day || 1;

        // 4️⃣ Tính tổng số lợn trong các barn
        barns = await BarnModel.find({ _id: { $in: ration.barn } }).session(session);
        const totalPigs = barns.reduce((sum, b) => sum + (b.total_pigs || 0), 0);

        // 5️⃣ Trả lại inventory cho thức ăn
        for (const f of foodDetails) {
          if (!f.food_warehouse) continue;
          const fw = await FoodWarehouseModel.findById(f.food_warehouse).session(session);
          if (!fw) continue;

          
          const mealWeightKg = normalizeWeightToKg(f.weight || 0, f.weight_unit || "kg");
          
          const executedMealCount = await FeedingLogModel.countDocuments({
            food_ration: ration._id,
            meal: f.meal,
            status: "Hoàn thành",
          }).session(session);

          console.log("executedMealCount: " + executedMealCount);

          const remainingMealsForThis = Math.max(0, totalDaysForMeal - executedMealCount);
          const totalKg = mealWeightKg * Number(feedsPerDay || 1) * totalPigs * remainingMealsForThis;
          console.log("totalKg: " + totalKg);

          let bagKg = Number(fw.weight || 1);
          if ((fw.unit || "kg").toLowerCase() === "g") bagKg /= 1000;

          const returnBags = Math.ceil(totalKg / bagKg);
          console.log("returnBags: " + returnBags);
          
          fw.inventory += returnBags;
          console.log("inventory: " + fw.inventory);
          await fw.save({ session });

          if(executedMealCount > 0){
            const usedKg = mealWeightKg * Number(feedsPerDay || 1) * totalPigs * totalDaysForMeal;
            const oldBags = Math.ceil(usedKg / bagKg);
            const usedBags = oldBags - returnBags;
            toDeductFood.push({
              import_price: Number(fw.import_price || 0),
              // Nếu có dữ liệu gốc thì dùng, nếu không fallback về kho hiện tại
              originalInventory: Number(fw.original_inventory),
              requiredBags: usedBags
            });
          }
        }

        console.log("---------------------------------------------------------------");
        
        // 6️⃣ Trả lại inventory cho thuốc
        for (const m of medDetails) {
            const whId = m.medition_warehouse || m.food_warehouse;
            if (!whId) continue;

            const mw = await MeditionWarehouseModel.findById(whId).session(session);
            if (!mw) continue;

            const cap = parseCapacity(mw.capacity);
            const capBase = toBaseUnit(cap.amount, cap.unit);
            const matchedFood = foodDetails.find(f => String(f.meal) === String(m.meal));
            if (!matchedFood) continue;

            const mealWeightKg = normalizeWeightToKg(matchedFood.weight || 0, matchedFood.weight_unit || "kg");

            const executedMealCount = await FeedingLogModel.countDocuments({
              food_ration: ration._id,
              meal: m.meal,
              status: "Hoàn thành",
            }).session(session);

            const remainingMealsForThis = Math.max(0, totalDaysForMeal - executedMealCount);

            const dosageValue = Number(m.dosage || 0);
            let baseMultiplier = 1;
            if (m.dosage_unit?.toLowerCase() === "kg") baseMultiplier = 1000;
            if (m.dosage_unit?.toLowerCase() === "l") baseMultiplier = 1000;

            const feedKgForBarn = mealWeightKg * Number(feedsPerDay || 1) * totalPigs * remainingMealsForThis;
            const totalBase = dosageValue * baseMultiplier * feedKgForBarn;
            const returnUnits = Math.ceil(totalBase / capBase.base);
            console.log("medition returnUnits: " + returnUnits);
            mw.inventory += returnUnits;
            console.log("inventory: " + mw.inventory);
            await mw.save({ session });
            if(executedMealCount > 0){
                const usedKg = mealWeightKg * Number(feedsPerDay || 1) * totalPigs * totalDaysForMeal;
                const baseAmount = Number(m.dosage || 0) * baseMultiplier * usedKg;
                const oldUnits = Math.ceil(baseAmount / capBase.base); 
                const usedUnits = oldUnits - returnUnits;
                toDeductMed.push({
                  import_price: Number(mw.import_price || 0),
                  // Nếu có dữ liệu gốc thì dùng, nếu không fallback về kho hiện tại
                  originalInventory: Number(mw.original_inventory),
                  requiredUnits: usedUnits
                });
            }
          }
        // 7️⃣ Xóa log, chi tiết, và ration
        //await FeedingLogModel.deleteMany({ food_ration: ration._id }).session(session);
        await RationFoodDetailModel.deleteMany({ food_ration: ration._id }).session(session);
        await RationMeditionDetailModel.deleteMany({ food_ration: ration._id }).session(session);
        await FoodRationModel.deleteOne({ _id: ration._id }).session(session);
      }

        await calculateAndSaveInvestmentCost({
          barns: barns,       
          toDeductFood,
          toDeductMed,
          session
        });
      })
    return { message: "FoodRation deleted successfully" };
  } catch (err) {
    // chỉ abort khi transaction còn hoạt động
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw new Error(err.message);
    } finally {
    await session.endSession();
  }
}

module.exports = { createFoodRationService, updateFoodRationService, deleteFoodRationService };