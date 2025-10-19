var mongoose = require('mongoose');

const BreedingRecordSchema = mongoose.Schema({
    sow: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'pigs', 
        required: true, 
        index: true },
    boar: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'pigs' 
    },
    attempts: [{
        date: { type: Date, default: Date.now },
        method: { type: String, enum: ['natural','artificial'] },
        success: { type: Boolean, default: false }
    }],
    pregnant: { type: Boolean, default: false },
    expectedBirthDate: Date,
    giveBirthRecord: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'give_birth_records' 
    },
    note: String,
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

var BreedingRecordModel = mongoose.model('breeding_records', BreedingRecordSchema); 
module.exports = BreedingRecordModel;