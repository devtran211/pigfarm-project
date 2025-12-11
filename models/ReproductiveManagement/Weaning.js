var mongoose = require('mongoose');

const WeaningSchema = mongoose.Schema({
    pigMother: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'pigs' 
    },
    weaningDay: Date,
    numberOfLivePiglets: Number,
    sowHealth: String,
    pigletHealth: String,
    avgWeaningWeightKg: Number,
    note: String,
    birthRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'give_birth_records' }
});

var WeaningModel = mongoose.model('weanings', WeaningSchema); 
module.exports = WeaningModel;