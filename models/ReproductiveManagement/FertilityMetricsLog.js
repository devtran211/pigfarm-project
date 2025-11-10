var mongoose = require('mongoose');

const FertilityMetricsLogSchema = mongoose.Schema({
    boar: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'pigs' 
    },
    sow: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'pigs' 
    },
    ageAtMating: { type: Number, default: 0 },
    weightAtMating: { type: Number, default: 0 },
    lengthAtMating: {type: Number, default: 0},
    fcrAtMating: {type: Number, default: 0},
    avgLitterSize: { type: Number, default: 0 },
    readinessScore: { type: Number, default: 0 },
    boarMatchScore: { type: Number, default: 0 },
    // ----- GIAI ĐOẠN SAU CAI SỮA -----
    weaningOK: Boolean,            // đạt tiêu chí cai sữa tổng thể
    sowHealthOK: Boolean,          // sức khỏe nái tốt sau cai
    pigletHealthOK: Boolean,       // heo con khỏe mạnh
    weaningWeightOK: Boolean,      // trọng lượng cai đạt chuẩn
    // ----- KẾT QUẢ ĐẦU RA (để ML dùng làm label) -----
    healthRiskScore: Number, // 0–100 (để trống, dùng khi có model bệnh)
    resultSuccess: { type: Boolean, default: null },  // true = phối thành công
    resultLitterSize: { type: Number, default: null }, // số con sinh ra thật sự
}, { timestamps: true });

var FertilityMetricsLogModel = mongoose.model('fertility_metrics_logs', FertilityMetricsLogSchema); 
module.exports = FertilityMetricsLogModel;