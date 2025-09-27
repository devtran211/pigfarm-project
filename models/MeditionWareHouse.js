const mongoose = require('mongoose');

const MeditionWareHouseSchema = new mongoose.Schema({
    name: String,
    brand: String,
    drug_type: String,
    usage_type: {
      type: String,
      enum: ['Trộn thức ăn', 'pha nước', 'tiêm'], 
      required: true
   },
    inventory: Number,
    unit: String,
    capacity: String,
    import_price: Number,
    date_of_manufacture: Date,
    expiry: Date,
    Note: String,
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'invoices' 
   }
});

var MeditionWareHouseModel = mongoose.model('medition_warehouses', MeditionWareHouseSchema);
module.exports = MeditionWareHouseModel;