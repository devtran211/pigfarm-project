const InvestmentCostModel = require('../models/InvestmentCost');

async function calculateAndSaveInvestmentCost({ barns, toDeductFood = [], toDeductMed = [], session }) {
  // total pigs
  const totalPigs = barns.reduce((s, b) => s + (Number(b.total_pigs) || 0), 0);
  const equalShare = (barns.length > 0) ? (1 / barns.length) : 0;

  for (const barn of barns) {
    const pigs = Number(barn.total_pigs) || 0;
    const ratio = totalPigs > 0 ? (pigs / totalPigs) : equalShare;

    let food_cost = 0;
    let medition_cost = 0;

    // food: mỗi item là 1 kho cung cấp, total cost = pricePerBag * requiredBags
    for (const item of toDeductFood) {
      const importPrice = Number(item.import_price || 0);            // tổng tiền nhập (snapshot)
      const originalInventory = Number(item.originalInventory || 0); // số bao có trước khi trừ
      const requiredBags = Number(item.requiredBags || 0);
      console.log("importPrice: " +importPrice + " " + " originalInventory: " + originalInventory + " requireBags: " + requiredBags)

      // guard: nếu không có importPrice hoặc originalInventory==0 -> pricePerBag = 0 (bạn có thể thay policy)
      const pricePerBag = originalInventory > 0 ? (importPrice / originalInventory) : 0;
      const totalCost = pricePerBag * requiredBags;
      console.log("totalCost: " + totalCost);

      // phân bổ cho barn theo ratio
      food_cost += totalCost * ratio;
      console.log("food_cost: " + food_cost);
    }

    // med: mỗi item total cost = pricePerUnit * requiredUnits
    for (const item of toDeductMed) {
      const importPrice = Number(item.import_price || 0);
      const originalInventory = Number(item.originalInventory || 0);
      const requiredUnits = Number(item.requiredUnits || 0);
      console.log("importPrice: " +importPrice + " " + " originalInventory: " + originalInventory + " requireUnits: " + requiredUnits)

      const pricePerUnit = originalInventory > 0 ? (importPrice / originalInventory) : 0;
      const totalCost = pricePerUnit * requiredUnits;
      console.log("totalCost: " + totalCost);
      medition_cost += totalCost * ratio;
      console.log("medition_cost: " + medition_cost);
    }

    const total = food_cost + medition_cost;
    console.log("total: " + total);

    // lưu/ cập nhật InvestmentCost cho barn
    const existing = await InvestmentCostModel.findOne({ barn: barn._id }).session(session);
    if (existing) {
      existing.food_cost = food_cost ?? Number(existing.food_cost) ?? 0;
      existing.medition_cost = medition_cost ?? Number(existing.medition_cost) ?? 0;
      existing.total = total ?? Number(existing.total) ?? 0;
      await existing.save({ session });
    } else {
      await InvestmentCostModel.create([{
        breeding_cost: 0,
        food_cost,
        medition_cost,
        fixed_cost: 0,
        total,
        barn: barn._id
      }], { session });
    }
  }
}

async function calculateAndSaveInvestmentMedCost({ barns, toDeductMed = [], session }) {
  // total pigs
  const totalPigs = barns.reduce((s, b) => s + (Number(b.total_pigs) || 0), 0);
  const equalShare = (barns.length > 0) ? (1 / barns.length) : 0;

  for (const barn of barns) {
    const pigs = Number(barn.total_pigs) || 0;
    const ratio = totalPigs > 0 ? (pigs / totalPigs) : equalShare;

    console.log("ratio: " + ratio);

    let medition_cost = 0;

    let i = 0;
    // med: mỗi item total cost = pricePerUnit * requiredUnits
    for (const item of toDeductMed) {
      console.log("Lần ", i+=1);
      const importPrice = Number(item.import_price || 0);
      const originalInventory = Number(item.originalInventory || 0);
      const requiredUnits = Number(item.requiredUnits || 0);
      console.log("importPrice: " +importPrice + " " + " originalInventory: " + originalInventory + " requireUnits: " + requiredUnits)

      const pricePerUnit = originalInventory > 0 ? (importPrice / originalInventory) : 0;
      const totalCost = pricePerUnit * requiredUnits;
      console.log("totalCost: " + totalCost);
      medition_cost += totalCost * ratio;
      console.log("medition_cost: " + medition_cost);
    }

    let total = 0;
    total += medition_cost;
    console.log("total: " + total);

    // lưu/ cập nhật InvestmentCost cho barn
    const existing = await InvestmentCostModel.findOne({ barn: barn._id }).session(session);
    if (existing) {
      existing.medition_cost = medition_cost ?? Number(existing.medition_cost) ?? 0;
      existing.total = total ?? Number(existing.total) ?? 0;
      await existing.save({ session });
    } else {
      await InvestmentCostModel.create([{
        breeding_cost: 0,
        food_cost,
        medition_cost,
        fixed_cost: 0,
        total,
        barn: barn._id
      }], { session });
    }
  }
}


module.exports = { calculateAndSaveInvestmentCost, calculateAndSaveInvestmentMedCost };