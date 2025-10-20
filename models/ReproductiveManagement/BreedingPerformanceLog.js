const mongoose = require ('mongoose');

const BreedingPerformanceLogSchema = mongoose.Schema({
    sow: { type: mongoose.Schema.Types.ObjectId, ref: 'pigs', required: true },
    boar: { type: mongoose.Schema.Types.ObjectId, ref: 'pigs', required: true },
    breedingPerformance: { type: mongoose.Schema.Types.ObjectId, ref: 'breeding_performances', required: true },
    birthCount: { type: Number, default: 0 },      // số con sinh
    weanCount: { type: Number, default: 0 },       // số con cai sữa
    avgWeaningWeight: { type: Number, default: 0 },// cân nặng cai sữa TB
    type: { type: String, enum: ['BIRTH', 'WEANING'], required: true }, // Lưu rõ log sinh hay cai sữa
    createdAt: { type: Date, default: Date.now }
});

var BreedingPerformanceLogModel = mongoose.model('breeding_performance_logs', BreedingPerformanceLogSchema); 
module.exports = BreedingPerformanceLogModel;