var mongoose = require('mongoose');

var HerdSchema = mongoose.Schema({
   name: String,
   origin: String,
   dateOfEntry: Date,
   type: String,
   sex: { type: String, enum: ["boar", "sow"], default: "mixed" },
   weightAtImport: Number,
   health: { type: String, default: "good" },
   vaccination: Boolean,
   inventory: { type: Number, default: 0 },
   originalInventory: Number,
   importPrice: { type: Number, default: 0 },
   note: String,
   invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'invoices' 
   }
});

var HerdModel = mongoose.model('herds', HerdSchema); 
module.exports = HerdModel;