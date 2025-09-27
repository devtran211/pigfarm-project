const mongoose = require('mongoose');

const InvestmentCostSchema = new mongoose.Schema({
    name: {
        type: String,
        require: true
    },
    acreage: String,
    number_of_barns: Number,
    type: String,
    status: String,
    start_date: Date,
    note: String
});

var BreedingAreaModel = mongoose.model('breedingareas', BreedingAreaSchema)
module.exports = BreedingAreaModel;