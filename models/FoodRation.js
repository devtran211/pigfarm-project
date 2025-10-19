const mongoose = require('mongoose');

var FoodRationSchema = mongoose.Schema({
   name: String,
   start_time: Date,
   end_time: Date,
   number_of_feedings_per_day: Number,
   total_food_intake_per_day: Number,
   barn: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'barns' 
   }]
});

var FoodRationModel = mongoose.model('food_rations', FoodRationSchema)
module.exports = FoodRationModel;