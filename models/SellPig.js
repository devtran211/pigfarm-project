const mongoose = require('mongoose');

const SellPigSchema = new mongoose.Schema({
    invoiceCode: String,
    exportDate: {
        type: Date,
        default: Date.now()
    },
    discount: Number,
    totalPrice: Number,
    //quarantineCertificate: 
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'customers' 
    },
    paymentStatus: String,
    note: String
});

var SellPigModel = mongoose.model('sell_pigs', SellPigSchema);
module.exports = SellPigModel;