const mongoose = require('mongoose');

const FoodWareHouseSchema = new mongoose.Schema({
    name: String,
    inventory: Number,
    weight: Number,
    unit: String,
    protein_content: String,
    energy_content: String,
    import_price: Number,
    import_date: Date,
    original_inventory: Number,
    date_of_manufacture: Date,
    expiry: Date,
    note: String,
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'invoices' 
   }
});

const FoodWareHouseModel = mongoose.models.food_warehouses || mongoose.model('food_warehouses', FoodWareHouseSchema);

module.exports = FoodWareHouseModel;