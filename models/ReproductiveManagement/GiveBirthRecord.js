var mongoose = require('mongoose');

const GiveBirthRecordSchema = mongoose.Schema({
    breedingRecord: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'breeding_records' 
    },
    sow: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'pigs', 
        required: true 
    },
    boar: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'pigs' 
    },
    dateOfBirth: { 
        type: Date, 
        default: Date.now 
    },
    numberOfLivePiglets: Number,
    numberOfDeadPiglets: Number,
    piglets: [{
        pigId: { type: mongoose.Schema.Types.ObjectId, ref: 'pigs' },
        birthWeight: Number
    }],
    averageWeight: Number,
    note: String,
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

var GiveBirthRecordModel = mongoose.model('give_birth_records', GiveBirthRecordSchema); 
module.exports = GiveBirthRecordModel;