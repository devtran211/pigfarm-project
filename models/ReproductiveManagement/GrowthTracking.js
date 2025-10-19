var mongoose = require('mongoose');

const GrowthTrackingSchema = mongoose.Schema({
    pig: { 
        type: mongoose.Schema.Types.ObjectId, ref: 'pigs', 
        required: true, 
        index: true 
    },
    date: { 
        type: Date, 
        default: Date.now 
    },
    weight: Number,
    length: Number,
    note: String,
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

var GrowthTrackingModel = mongoose.model('growth_trackings', GrowthTrackingSchema); 
module.exports = GrowthTrackingModel;