const mongoose = require('mongoose');

const DrugUseDetailSchema = new mongoose.Schema({
    time: String,
    method: String,
    dosage: Number,
    dosage_unit: String,
    note: String,
    medition_warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'medition_warehouses'
    },
    drug_use: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'drug_uses'
    },
    vaccination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'vaccinations'
    },
});

var DrugUseDetailModel = mongoose.model('drug_use_details', DrugUseDetailSchema);
module.exports = DrugUseDetailModel;