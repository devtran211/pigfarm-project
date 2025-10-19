var mongoose = require('mongoose');

const BreedingPerformanceSchema = mongoose.Schema({
    boar: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'pigs' },
    sow: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'pigs' },
    totalLitters: { type: Number, default: 0 },
    avgLitterSize: { type: Number, default: 0 },
    avgSurvivalRate: { type: Number, default: 0 },
    avgWeaningWeight: { type: Number, default: 0 },
    lastUsed: Date,
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

var BreedingPerformanceModel = mongoose.model('breeding_performances', BreedingPerformanceSchema); 
module.exports = BreedingPerformanceModel;