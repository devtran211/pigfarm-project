var mongoose = require('mongoose');

var SupplierSchema = mongoose.Schema({
   name: String,
   telephone: String,
   tax_code: String,
   group: String,
   address: String,
});

var SupplierModel = mongoose.model('suppliers', SupplierSchema); 
module.exports = SupplierModel;