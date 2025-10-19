const mongoose = require('mongoose');

var RationMeditionDetailSchema = mongoose.Schema({
    meal: String,
    dosage: Number,
    dosage_unit: String,
    food_ration:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'food_rations' 
    },
    medition_warehouse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'medition_warehouses' 
    }
});

var RationMetionDetailModel = mongoose.model('ration_metion_details', RationMeditionDetailSchema);
module.exports = RationMetionDetailModel;