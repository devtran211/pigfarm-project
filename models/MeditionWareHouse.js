const mongoose = require('mongoose');

const MeditionWareHouseSchema = new mongoose.Schema({
    name: String,
    brand: String,
    drug_type: String,
    usage_type: {
      type: String,
      enum: ['Trộn thức ăn', 'Pha nước', 'Tiêm', 'Uống trực tiếp'], 
      required: true
   },
    inventory: Number,
    original_inventory: Number,
    unit: String,
    capacity: String,
    import_price: Number,
    date_of_manufacture: Date,
    expiry: Date,
    note: String,
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'invoices' 
   }
});

const MeditionWareHouseModel = mongoose.models.medition_warehouses || mongoose.model('medition_warehouses', MeditionWareHouseSchema);
module.exports = MeditionWareHouseModel;