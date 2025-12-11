var mongoose = require('mongoose');

var InvoiceSchema = mongoose.Schema({
   name: String,
   items: [{
      type: {type: String, enum: ["Herd", "Food", "Medition"], required: true },
      refId: { type: mongoose.Schema.Types.ObjectId, required: true },
      price: Number,
      quantity: Number,
      total_price: Number,
   }],
   discount: Number,
   total: Number,
   payment_status: String,
   creation_date: {
      type: Date,
      default: Date.now
   },
   supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'suppliers'
   },
   isDelete: {
      type: Boolean,
      default: false
   },
   note: String
});

var InvoiceModel = mongoose.model('invoices', InvoiceSchema);
module.exports = InvoiceModel;