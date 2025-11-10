const mongoose = require('mongoose');
const DrugUseModel = require("../models/DrugUse");
const DrugUseDetailModel = require("../models/DrugUseDetail");
const DrugUseLogModel = require("../models/DrugUseLog");
const MeditionWareHouseModel = require("../models/MeditionWareHouse");
const BarnModel = require("../models/Barn");
const { parseCapacity, toBaseUnit } = require("./cvs");
const { calculateAndSaveInvestmentMedCost } = require("./calculatePricePerBarn");

/* Tính số lượng chai/lọ cần dùng dựa trên số lợn, số ngày, dung tích thuốc */
function calculateInventoryNeeded(dosagePerAnimal, unit, medition, numberOfPigs = 1, numberOfDays = 1) {
    const { amount, unit: capacityUnit } = parseCapacity(medition.capacity);

    // Tổng liều = liều/ngày * số lợn * số ngày
    const totalDosage = dosagePerAnimal * numberOfPigs * numberOfDays;

    const baseDosage = toBaseUnit(totalDosage, unit);
    const baseCapacity = toBaseUnit(amount, capacityUnit);

    console.log("Đơn vị: ", baseDosage, " ",baseCapacity);

    if (baseDosage.type !== baseCapacity.type) {
        throw new Error(`Đơn vị liều và capacity không khớp: ${baseDosage.type} vs ${baseCapacity.type}`);
    }

  const neededUnits = Math.ceil((baseDosage.base || 0) / (baseCapacity.base || 1));
  return Number(neededUnits || 0);
}

async function createDrugUse(payload) {
    const { start_date, end_date, reason, barnIds, areaId, details } = payload;

    // 1. Lấy danh sách chuồng áp dụng
    let barns = [];
    if (barnIds && barnIds.length > 0) {
        barns = await BarnModel.find({ _id: { $in: barnIds } });
    } else if (areaId) {
        barns = await BarnModel.find({ area: areaId });
    }
    if (barns.length === 0) throw new Error("Không tìm thấy chuồng áp dụng thuốc");

    // 2. Tính số ngày áp dụng
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const numberOfDays = Math.max(Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1, 1);

    let toDeductMed;
    // 3. Với mỗi chuồng → tạo riêng một DrugUse
    for (let barn of barns) {
        const barnPigCount = barn.total_pigs || 0;
        toDeductMed = [];
        // 3.1 Tạo DrugUse riêng cho từng chuồng
        const drugUse = await DrugUseModel.create({
            start_date,
            end_date,
            reason,
            note: payload.note || "",
            barn: [barn._id], // mỗi bản ghi chỉ 1 chuồng
        });

        // 3.2 Với mỗi detail → tính lượng tồn kho cần trừ theo (dosage × số lợn × số ngày), nhưng chỉ tạo 1 chi tiết cho mỗi chuồng
        for (let detail of details) {
            const med = await MeditionWareHouseModel.findById(detail.medition_warehouse);
            if (!med) throw new Error("Medition warehouse không tồn tại");

            const neededUnits = calculateInventoryNeeded(
                detail.dosage,
                detail.dosage_unit,
                med,
                barnPigCount,
                numberOfDays
            );

            if (med.inventory < neededUnits) {
                throw new Error(`Kho không đủ thuốc ${med.name} cho chuồng ${barn.name}. Cần ${neededUnits}, tồn kho ${med.inventory}`);
            }

            toDeductMed.push({
              import_price: Number(med.import_price),
              originalInventory: Number(med.original_inventory),
              requiredUnits: Number(neededUnits)
            });

            med.inventory -= Number(neededUnits || 0);
            await med.save();

            await DrugUseDetailModel.create({
                time: detail.time,
                method: detail.method,
                reason: detail.reason || reason || "",
                dosage: detail.dosage,
                dosage_unit: detail.dosage_unit,
                note: detail.note,
                medition_warehouse: med._id,
                drug_use: drugUse._id,
                vaccination: detail.vaccination || null
            });
        }
    }
    calculateAndSaveInvestmentMedCost({barns, toDeductMed}); 
    return { message: "Tạo áp dụng thuốc thành công cho từng chuồng!" };
}

function diffDaysInclusive(startDateInput, endDateInput) {
  const start = new Date(startDateInput);
  const end = new Date(endDateInput);
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((endUtc - startUtc) / msPerDay);
  return diff >= 0 ? diff + 1 : 0;
}

async function editDrugUse(drugUseId, payload) {
  const session = await mongoose.startSession();
  try {
    let finalResult = null;
    let toDeductMed = [];

    await session.withTransaction(async () => {
      // 1) Load existing DrugUse
      const oldDrugUse = await DrugUseModel.findById(drugUseId).session(session);
      if (!oldDrugUse) throw new Error("DrugUse không tồn tại");

      // 2) Get the barn associated with oldDrugUse (we expect one barn per doc)
      const oldBarnId = (oldDrugUse.barn && oldDrugUse.barn[0]) ? oldDrugUse.barn[0] : null;
      if (!oldBarnId) throw new Error("DrugUse hiện tại không liên kết tới chuồng nào");

      const oldBarn = await BarnModel.findById(oldBarnId).session(session);
      if (!oldBarn) throw new Error("Chuồng liên quan không tồn tại");

      // 3) Load old details
      const oldDetails = await DrugUseDetailModel.find({ drug_use: oldDrugUse._id }).session(session);

      // 4) ROLLBACK INVENTORY based on oldDetails + logs (completed)
      // build rollbackMap: medId -> totalUnitsToReturn
      const rollbackMap = new Map();
      const oldNumberOfDays = diffDaysInclusive(oldDrugUse.start_date, oldDrugUse.end_date);
      for (const od of oldDetails) {
        if (!od.medition_warehouse) continue;
        // count completed logs for this detail
        const completedCount = await DrugUseLogModel.countDocuments({
          med_details: od._id,
          time: od.time,
          status: "completed"
        }).session(session);

        const daysToReturn = completedCount > 0 ? completedCount : oldNumberOfDays;

        // fetch med
        const med = await MeditionWareHouseModel.findById(od.medition_warehouse).session(session);
        if (!med) throw new Error(`Medition warehouse không tồn tại cho detail ${od._id}`);

        const units = calculateInventoryNeeded(
          od.dosage,
          od.dosage_unit,
          med,
          Number(oldBarn.total_pigs || 0),
          Number(daysToReturn || 0)
        );

        console.log("Lượng thuốc của bữa cũ: " + units);
        const usedUnit = units - daysToReturn;

        const key = med._id.toString();
        rollbackMap.set(key, (rollbackMap.get(key) || 0) + units);

        if(completedCount > 0){
          toDeductMed.push({
            import_price: Number(med.import_price),
            originalInventory: Number(med.original_inventory),
            requiredUnits: usedUnit
          })
        } 
      }
      calculateAndSaveInvestmentMedCost({barns: [oldBarn], toDeductMed});

      // Apply rollback to med inventories
      for (const [medId, qty] of rollbackMap.entries()) {
        const med = await MeditionWareHouseModel.findById(medId).session(session);
        if (!med) throw new Error(`Medition not found while rolling back: ${medId}`);
        med.inventory = Number(med.inventory || 0) + Number(qty || 0);
        console.log("Tồn kho cho bữa cũ: " + med.inventory);
        await med.save({ session });
      }

      // 5) Delete old details and their logs (per your 2.A requirement)
      const oldDetailIds = oldDetails.map(d => d._id);
      if (oldDetailIds.length > 0) {
        // delete logs referencing these details
        // await DrugUseLogModel.deleteMany({ med_details: { $in: oldDetailIds } }).session(session);
        // delete the details
        await DrugUseDetailModel.deleteMany({ _id: { $in: oldDetailIds } }).session(session);
      }

      // 6) Determine target barns from payload (if none provided -> keep old barn)
      let targetBarns = null;
      if (Array.isArray(payload.barnIds) && payload.barnIds.length > 0) {
        targetBarns = await BarnModel.find({ _id: { $in: payload.barnIds } }).session(session);
      } else if (payload.areaId) {
        targetBarns = await BarnModel.find({ area: payload.areaId }).session(session);
      } else {
        // keep old barn
        targetBarns = [oldBarn];
      }

      // check if barns actually changed (compare ids)
      const oldBarnIdStr = oldBarn._id.toString();
      const targetBarnIdsStr = targetBarns.map(b => b._id.toString()).sort();
      const isSameBarnSet = (targetBarnIdsStr.length === 1 && targetBarnIdsStr[0] === oldBarnIdStr) ||
                            (targetBarnIdsStr.length === 0 && oldBarnIdStr);

      // Prepare new details array from payload
      const newDetails = Array.isArray(payload.details) ? payload.details : [];

      // Compute new date range (use payload start/end or old ones if not provided)
      const newStart = payload.start_date ? new Date(payload.start_date) : new Date(oldDrugUse.start_date);
      const newEnd = payload.end_date ? new Date(payload.end_date) : new Date(oldDrugUse.end_date);
      const newNumberOfDays = diffDaysInclusive(newStart, newEnd);
      if (newNumberOfDays <= 0) throw new Error("Khoảng thời gian không hợp lệ (end_date phải >= start_date)");

      // 7) If barn set changed (not same single barn), then per your rule: delete oldDrugUse and create new DrugUse per barn
      if (!isSameBarnSet) {
        // delete the old DrugUse doc (we already rolled back & deleted its details & logs)
        await DrugUseModel.deleteOne({ _id: oldDrugUse._id }).session(session);

        // For each target barn, check overlap and create new DrugUse
        const createdDrugUses = [];

        for (const barn of targetBarns) {
          //toDeductMed = [];
          // Overlap check: any other DrugUse (excluding the deleted one) that overlaps with newStart-newEnd
          const overlapping = await DrugUseModel.findOne({
            barn: barn._id,
            $or: [
              {
                start_date: { $lte: newEnd },
                end_date: { $gte: newStart }
              }
            ]
          }).session(session);

          if (overlapping) {
            throw new Error(`Chuồng ${barn.name || barn._id} đã có thiết lập thuốc khác trong khoảng thời gian này. Không cho phép chèn thêm.`);
          }

          // build medition_origin_inventory for this barn (unique meds)
        //   const medOriginArr = [];
        //   const usedSet = new Set();
        //   for (const d of newDetails) {
        //     if (!d.medition_warehouse) continue;
        //     const med = await MeditionWareHouseModel.findById(d.medition_warehouse).session(session);
        //     if (!med) throw new Error(`Medition warehouse không tồn tại: ${d.medition_warehouse}`);
        //     const idStr = med._id.toString();
        //     if (!usedSet.has(idStr)) {
        //       medOriginArr.push({ medition_id: med._id, name: med.name, inventory: med.inventory });
        //       usedSet.add(idStr);
        //     }
        //   }

          // Create new DrugUse doc for this barn
          const [newDrugUse] = await DrugUseModel.create([{
            start_date: newStart,
            end_date: newEnd,
            reason: payload.reason !== undefined ? payload.reason : oldDrugUse.reason,
            note: payload.note !== undefined ? payload.note : oldDrugUse.note || "",
            barn: [barn._id]
          }], { session });

          // Now compute total deduction per med for this barn (based on barn.number_of_pigs)
          const deductMap = new Map(); // medId -> qty
          for (const d of newDetails) {
            if (!d.medition_warehouse) continue;
            const med = await MeditionWareHouseModel.findById(d.medition_warehouse).session(session);
            if (!med) throw new Error(`Medition not found: ${d.medition_warehouse}`);
            const units = calculateInventoryNeeded(
              d.dosage,
              d.dosage_unit,
              med,
              Number(barn.total_pigs || 0),
              newNumberOfDays
            );
            toDeductMed.push({
              import_price: Number(med.import_price || 0),
              originalInventory: Number(med.original_inventory || 0),
              requiredUnits: Number(units)
            });
            const key = med._id.toString();
            deductMap.set(key, (deductMap.get(key) || 0) + units);
          }

          // Check inventory sufficiency for all meds
          for (const [medId, qty] of deductMap.entries()) {
            const med = await MeditionWareHouseModel.findById(medId).session(session);
            if (Number(med.inventory || 0) < Number(qty || 0)) {
              throw new Error(`Kho không đủ thuốc ${med.name} cho chuồng ${barn.name}. Cần ${qty}, tồn kho ${med.inventory}`);
            }
          }

          // Deduct inventories
          for (const [medId, qty] of deductMap.entries()) {
            const med = await MeditionWareHouseModel.findById(medId).session(session);
            med.inventory = Number(med.inventory || 0) - Number(qty || 0);
            await med.save({ session });
          }

          // Create DrugUseDetail docs (1 record per detail for this barn)
          const detailsToInsert = [];
          for (const d of newDetails) {
            const med = await MeditionWareHouseModel.findById(d.medition_warehouse).session(session);
            detailsToInsert.push({
              time: d.time,
              method: d.method,
              reason: d.reason || (payload.reason || oldDrugUse.reason) || "",
              dosage: d.dosage,
              dosage_unit: d.dosage_unit,
              note: d.note,
              medition_warehouse: med._id,
              drug_use: newDrugUse._id,
              vaccination: d.vaccination || null
            });
          }
          if (detailsToInsert.length > 0) {
            await DrugUseDetailModel.insertMany(detailsToInsert, { session });
          }

          calculateAndSaveInvestmentMedCost({barns: [barn], toDeductMed})
          createdDrugUses.push(newDrugUse);
        } // end for each target barn

        finalResult = createdDrugUses;
      } else {
        // 8) Barn unchanged -> update oldDrugUse fields, rebuild medition_origin_inventory and create new details
        // update fields
        oldDrugUse.start_date = newStart;
        oldDrugUse.end_date = newEnd;
        if (payload.reason !== undefined) oldDrugUse.reason = payload.reason;
        if (payload.note !== undefined) oldDrugUse.note = payload.note;

        // rebuild medition_origin_inventory from current meds (before deduction)
        // const medOriginArr = [];
        // const usedSet = new Set();
        // for (const d of newDetails) {
        //   if (!d.medition_warehouse) continue;
        //   const med = await MeditionWareHouseModel.findById(d.medition_warehouse).session(session);
        //   if (!med) throw new Error(`Medition not found: ${d.medition_warehouse}`);
        //   const idStr = med._id.toString();
        //   if (!usedSet.has(idStr)) {
        //     medOriginArr.push({ medition_id: med._id, name: med.name, inventory: med.inventory });
        //     usedSet.add(idStr);
        //   }
        // }
        // oldDrugUse.medition_origin_inventory = medOriginArr;
        // await oldDrugUse.save({ session });

        // compute deduction map for this single barn
        const deductMap = new Map();
        for (const d of newDetails) {
          if (!d.medition_warehouse) continue;
          const med = await MeditionWareHouseModel.findById(d.medition_warehouse).session(session);
          const units = calculateInventoryNeeded(
            d.dosage,
            d.dosage_unit,
            med,
            Number(oldBarn.total_pigs || 0),
            newNumberOfDays
          );
          console.log("Số lượng của bữa mới: " + units);
          toDeductMed.push({
            import_price: Number(med.import_price || 0),
            originalInventory: Number(med.original_inventory || 0),
            requiredUnits: Number(units)
          });
          const key = med._id.toString();
          deductMap.set(key, (deductMap.get(key) || 0) + units);
        }

        // Check inventory sufficiency
        for (const [medId, qty] of deductMap.entries()) {
          const med = await MeditionWareHouseModel.findById(medId).session(session);
          if (Number(med.inventory || 0) < Number(qty || 0)) {
            throw new Error(`Kho không đủ thuốc ${med.name}. Cần ${qty}, tồn kho ${med.inventory}`);
          }
        }

        // Deduct inventories
        for (const [medId, qty] of deductMap.entries()) {
          const med = await MeditionWareHouseModel.findById(medId).session(session);
          med.inventory = Number(med.inventory || 0) - Number(qty || 0);
          console.log("Tồn kho cho bữa mới: " + med.inventory);
          await med.save({ session });
        }

        // Create new details and link to oldDrugUse
        const detailsToInsert = [];
        for (const d of newDetails) {
          const med = await MeditionWareHouseModel.findById(d.medition_warehouse).session(session);
          detailsToInsert.push({
            time: d.time,
            method: d.method,
            reason: d.reason || oldDrugUse.reason || "",
            dosage: d.dosage,
            dosage_unit: d.dosage_unit,
            note: d.note,
            medition_warehouse: med._id,
            drug_use: oldDrugUse._id,
            vaccination: d.vaccination || null
          });
        }
        if (detailsToInsert.length > 0) {
          await DrugUseDetailModel.insertMany(detailsToInsert, { session });
        }

        calculateAndSaveInvestmentMedCost({barns: [oldBarn], toDeductMed});
        finalResult = oldDrugUse;
      } // end barn unchanged branch

    }); // end transaction

    return finalResult;
  } catch (err) {
    // transaction will be rolled back automatically when throwing inside withTransaction
    throw err;
  } finally {
    session.endSession();
  }
}

async function deleteDrugUse({ drugUseId = null, areaId = null } = {}) {
  if (!drugUseId && !areaId) throw new Error("Phải cung cấp drugUseId hoặc areaId");

  // Lấy danh sách DrugUse cần xóa
  let drugUsesToDelete = [];
  if (drugUseId) {
    const du = await DrugUseModel.findById(drugUseId);
    if (!du) throw new Error("Không tìm thấy DrugUse với id cung cấp");
    drugUsesToDelete = [du];
  } else {
    // areaId case: lấy tất cả chuồng trong khu, rồi tìm DrugUse có barn in that list
    const barns = await BarnModel.find({ area: areaId }, { _id: 1 });
    if (!barns || barns.length === 0) return { message: "Không có chuồng nào trong khu này" };
    const barnIds = barns.map(b => b._id);
    drugUsesToDelete = await DrugUseModel.find({ barn: { $in: barnIds } });
    if (!drugUsesToDelete.length) return { message: "Không có DrugUse nào trong khu này" };
  }

  const session = await mongoose.startSession();
    try {
        const summary = {
          deletedDrugUses: 0,
          deletedDetails: 0,
          deletedLogs: 0,
          medsReturned: [] // { medition_id, name, unitsReturned, inventoryAfter }
        };

        let toDeductMed = [];

        await session.withTransaction(async () => {
        // accumulate returns per medId
        const medReturnMap = new Map(); // medId -> totalUnitsToReturn

        for (const du of drugUsesToDelete) {
            // load details for this DrugUse
            const details = await DrugUseDetailModel.find({ drug_use: du._id }).session(session);

            // get barn and pig count (DrugUse.barn is array; we expect 1 barn per doc)
            const barnIdLocal = (du.barn && du.barn[0]) ? du.barn[0] : null;
            const barn = barnIdLocal ? await BarnModel.findById(barnIdLocal).session(session) : null;
            const barnPigs = Number(barn?.total_pigs || 0);

            const duDays = diffDaysInclusive(du.start_date, du.end_date);

            for (const det of details) {
                if (!det.medition_warehouse) continue;

                // get med
                const med = await MeditionWareHouseModel.findById(det.medition_warehouse).session(session);
                if (!med) throw new Error(`Medition warehouse không tồn tại: ${det.medition_warehouse}`);

                // count completed logs for this detail
                const completedCount = await DrugUseLogModel.countDocuments({
                    med_details: det._id,
                    time: det.time,
                    status: "completed"
                }).session(session);
                console.log(completedCount);

                // total units originally deducted for this detail (dosage * barnPigs * duDays)
                const unitsTotal = calculateInventoryNeeded(
                    det.dosage,
                    det.dosage_unit,
                    med,
                    barnPigs,
                    duDays
                );

                // units completed:
                const unitsCompleted = calculateInventoryNeeded(
                    det.dosage,
                    det.dosage_unit,
                    med,
                    barnPigs,
                    completedCount
                );
                console.log(unitsCompleted);

                if(completedCount > 0)
                {
                  usedUnits = unitsCompleted - completedCount;
                  toDeductMed.push({
                    import_price: Number(med.import_price),
                    originalInventory: Number(med.original_inventory),
                    requiredUnits: usedUnits
                  })
                }

                // units to return = total - completed
                let unitsToReturn = Number(unitsTotal || 0) - Number(unitsCompleted || 0);
                if (unitsToReturn < 0) unitsToReturn = 0;

                if (unitsToReturn > 0) {
                    const key = med._id.toString();
                    medReturnMap.set(key, (medReturnMap.get(key) || 0) + unitsToReturn);
                }

                // delete logs for this detail
                //const delLogRes = await DrugUseLogModel.deleteMany({ med_details: det._id }).session(session);
                //summary.deletedLogs += delLogRes.deletedCount || 0;

                // delete detail
                const delDetRes = await DrugUseDetailModel.deleteOne({ _id: det._id }).session(session);
                summary.deletedDetails += delDetRes.deletedCount || 0;
            } // end details loop

            // delete du
            const delDuRes = await DrugUseModel.deleteOne({ _id: du._id }).session(session);
            summary.deletedDrugUses += delDuRes.deletedCount || 0;

            calculateAndSaveInvestmentMedCost({barns: [barn], toDeductMed});
        } // end for each DrugUse

        // apply med returns
        for (const [medId, totalUnits] of medReturnMap.entries()) {
            const med = await MeditionWareHouseModel.findById(medId).session(session);
            if (!med) continue;
            med.inventory = Number(med.inventory || 0) + Number(totalUnits || 0);
            await med.save({ session });

            summary.medsReturned.push({
            medition_id: med._id,
            name: med.name,
            unitsReturned: Number(totalUnits || 0),
            inventoryAfter: med.inventory
            });
        }
        }); // end transaction

        return summary;
    } catch (err) {
        throw err;
    } finally {
        session.endSession();
    }
}

module.exports = { createDrugUse, editDrugUse, deleteDrugUse };