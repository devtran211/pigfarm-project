var mongoose = require('mongoose');

var HerdSchema = mongoose.Schema({
   name: String,
   origin: String,
   date_of_entry: Date,
   birth_date: Date,
   type: String,
   sex: String,
   weight_at_import: Number,
   health: String,
   vaccination: Boolean,
   inventory: Number,
   import_price: Number,
   invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'invoices' 
   }
});

var HerdModel = mongoose.model('herds', HerdSchema); 
module.exports = HerdModel;