var mongoose = require('mongoose');

const AttemptSchema = new mongoose.Schema({
  date: { type: Date },
  method: { type: String, enum: ["Natural", "AI"], default: "AI" },
  note: String,
  isSuccessful: { type: Boolean, default: null },
});

const BreedingRecordSchema = new mongoose.Schema({
  sow: { type: mongoose.Schema.Types.ObjectId, ref: "pigs", required: true },
  boar: { type: mongoose.Schema.Types.ObjectId, ref: "pigs", required: true },
  //fertility_score: Number,      // readinessScore (nái)
  //boar_match_score: Number,     // matchScore (đực)
  attempts: [AttemptSchema],    // Nhiều lần phối trong 1 chu kỳ
  expectedBirthDate: Date,
  note: String,
  status: {
    type: String,
    enum: ["Pending", "Pregnant", "Failed", "Cancel", "Gave birth"],
    default: "Pending"
  },
}, { timestamps: true });

var BreedingRecordModel = mongoose.model('breeding_records', BreedingRecordSchema); 
module.exports = BreedingRecordModel;