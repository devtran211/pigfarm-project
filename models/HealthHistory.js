var mongoose = require('mongoose');

const HealthHistorySchema = new mongoose.Schema({
  pig: { type: mongoose.Schema.Types.ObjectId, ref: 'pigs', required: true }, // FK
  dateOfDiscovery: { type: Date, required: true, default: Date.now },
  dateOfRecovery: { type: Date },

  // symptoms
  symptom: { type: String, required: true }, // text description
  movementStatus: { type: String }, // "normal/sluggish/immobile"
  eatingBehavior: { type: String }, // "normal/less/no appetite"
  waterIntake: { type: String }, // "normal/reduced/increased"
  feverStatus: { type: String},
  humidity: { type: String },
  vaccinationHistory: {type: String},

  result: { type: String }, // outcome
  note: { type: String },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// update timestamp
HealthHistorySchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

var HealthHistoryModel = mongoose.model('health_histories', HealthHistorySchema); 
module.exports = HealthHistoryModel;