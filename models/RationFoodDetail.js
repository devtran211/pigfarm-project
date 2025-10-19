const mongoose = require('mongoose');

var RationFoodDetailSchema = mongoose.Schema({
    meal: String,
    weight: Number,
    weight_unit: String,
    food_ration:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'food_rations' 
    },
    food_warehouse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'food_warehouses' 
    }
});

var RationFoodDetailModel = mongoose.model('ration_food_details', RationFoodDetailSchema);
module.exports = RationFoodDetailModel;