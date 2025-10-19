const mongoose =  require("mongoose");

const DrugUseLogSchema = new mongoose.Schema({
    time: {
        type: String, // ví dụ: "morning", "noon", "evening"
        required: true,
    },
    status: {
        type: String,
    },
    completed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
        //required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    barn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "barns",
    required: true,
    },
    drug_use: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "drug_uses",
        required: true,
    },
    med_details: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "drug_use_details",
    }
});

var DrugUseLogModel = mongoose.model('drug_use_logs', DrugUseLogSchema);
module.exports = DrugUseLogModel;