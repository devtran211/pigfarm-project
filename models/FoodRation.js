const mongoose = require('mongoose');

var FoodRationSchema = mongoose.Schema({
   name: String,
   food: String,
   weight: Number,
   unit: String,
   supplements: String,
   dosage: Number,
   unit: String,
   start_time: Date,
   end_time: Date,
   number_of_feedings_per_day: Number,
   total_food_intake_per_day: Number,
   barn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'barns' 
   },
   food_warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'food_warehouses'
   },
   medition_warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'medition_warehouses'
   }
});

var FoodRationModel = mongoose.model('food_rations', FoodRationSchema)
module.exports = FoodRationModel;