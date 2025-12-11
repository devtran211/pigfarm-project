const mongoose = require('mongoose');

const MeditionWareHouseSchema = new mongoose.Schema({
    name: String,
    brand: String,
    medicineType: String,
    usageType: {
      type: String,
      enum: ['Mixing feed', 'Mixing water', 'Injection', 'Drinking directly', 'Disinfectant spray'], 
      required: true
   },
    inventory: Number,
    original_inventory: Number,
    unit: String,
    capacity: String,
    import_price: Number,
    dateOfManufacture: Date,
    expiry: Date,
    importDate: {
      type: Date,
      default: Date.now()
    },
    note: String,
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'invoices' 
   }
});

const MeditionWareHouseModel = mongoose.models.medition_warehouses || mongoose.model('medition_warehouses', MeditionWareHouseSchema);
module.exports = MeditionWareHouseModel;