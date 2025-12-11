const mongoose = require('mongoose');

const InvestmentCostSchema = new mongoose.Schema({
    breeding_cost: Number,
    food_cost: Number,
    medition_cost: Number,
    total: Number,
    barn:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'barns' 
    }
});

var InvestmentCostModel = mongoose.model('investment_costs', InvestmentCostSchema)
module.exports = InvestmentCostModel;