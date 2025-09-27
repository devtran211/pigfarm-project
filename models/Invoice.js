var mongoose = require('mongoose');

var InvoiceSchema = mongoose.Schema({
   items: [{
      type: {type: String, enum: ["Con giống", "Thức ăn", "Thuốc"], required: true },
      refId: { type: mongoose.Schema.Types.ObjectId, required: true },
      price: Number,
      quantity: Number,
      unit: String,
   }],
   discount: Number,
   total: Number,
   payment_status: String,
   creation_date: Date,
   supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'suppliers'
   }
});

var InvoiceModel = mongoose.model('invoices', InvoiceSchema);
module.exports = InvoiceModel;