var mongoose = require('mongoose');

const HealthHistorySchema = mongoose.Schema({
    pig: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'pigs', 
        required: true, 
        index: true 
    },
    date: { 
        type: Date, 
        default: Date.now 
    },
    symptom: String,
    diagnosis: String,
    treatment: String,
    resolvedDate: Date,
    note: String,
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

var HealthHistoryModel = mongoose.model('health_histories', HealthHistorySchema); 
module.exports = HealthHistoryModel;