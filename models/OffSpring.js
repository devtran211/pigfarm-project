var mongoose = require('mongoose');

var OffSpringSchema = mongoose.Schema({
   name: String,
   origin: String,
   date_of_entry: Date,
   type: String,
   sex: String,
   weight_at_import: Number,
   health: String,
   vaccination: Boolean,
   inventory: Number,
   invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'invoices' 
   }
});

var OffSpringModel = mongoose.model('offsprings', OffSpringSchema); 
module.exports = OffSpringModel;