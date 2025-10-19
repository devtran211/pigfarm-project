var mongoose = require('mongoose');

const WeaningSchema = mongoose.Schema({
    pigMother: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'pigs' 
    },
    weaningDay: Date,
    numberOfLivePiglets: number,
    sowHealth: String,
    pigletHealth: String,
    avgWeaningWeightKg: Number,
    note: String,
    isDeleted: { type: Boolean, default: false },
    birthRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'GiveBirthRecord' }
});

var WeaningModel = mongoose.model('weanings', WeaningSchema); 
module.exports = WeaningModel;