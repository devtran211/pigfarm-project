const mongoose = require('mongoose');

const SellPigDetailSchema = new mongoose.Schema({
    warehouse: String,
    productName: String,
    quantity: Number,
    unit: String,
    discount: Number,
    price: Number,
    totalPrice: Number,
    invoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'sell_pigs' 
    },
    barn: {          
        type: mongoose.Schema.Types.ObjectId,
        ref: 'barns'
    } 
});

var SellPigModel = mongoose.model('sell_pig_details', SellPigDetailSchema);
module.exports = SellPigModel;