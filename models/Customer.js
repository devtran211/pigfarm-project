var mongoose = require('mongoose');

var CustomerSchema = mongoose.Schema({
   name: String,
   telephone: String,
   tax_code: String,
   address: String,
});

var CustomerModel = mongoose.model('customers', CustomerSchema); 
module.exports = CustomerModel;