const Area = require('../models/Area');
const Barn = require('../models/Barn');
const FoodRation = require('../models/FoodRation');
const RationFoodDetail = require('../models/RationFoodDetail');
const RationMedDetail = require('../models/RationMeditionDetail');
const DrugUse = require('../models/DrugUse');
const DrugUseDetail = require('../models/DrugUseDetail');

async function getAreaTasks(areaId) {
        // Lấy khu
        const area = await Area.findById(areaId);

        // Lấy toàn bộ chuồng trong khu
        const barns = await Barn.find({ area: areaId });

        const result = [];

        for (const barn of barns) {

            // ------- Lấy Food Ration -------
            const rations = await FoodRation.find({ barn: barn._id });

            const rationData = [];
            for (const r of rations) {
                const foodDetail = await RationFoodDetail.find({ food_ration: r._id })
                    .populate("food_warehouse");

                const medDetail = await RationMedDetail.find({ food_ration: r._id })
                    .populate("medition_warehouse");

                rationData.push({
                    ration: r,
                    food_detail: foodDetail,
                    med_detail: medDetail
                });
            }

            // ------- Lấy Drug Use -------
            const drugUses = await DrugUse.find({ barn: barn._id });

            const drugData = [];
            for (const du of drugUses) {
                const duDetail = await DrugUseDetail.find({ drug_use: du._id })
                    .populate("medition_warehouse");

                drugData.push({
                    drug_use: du,
                    details: duDetail
                });
            }

            result.push({
                barn,
                food_rations: rationData,
                drug_uses: drugData
            });
        }

        return {
            area,
            barns: result
        };
}

module.exports = { getAreaTasks }