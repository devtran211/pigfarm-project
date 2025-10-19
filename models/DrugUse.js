const mongoose = require('mongoose');

const DrugUseSchema = new mongoose.Schema({
    start_date: Date,
    end_date: Date,
    reason: String,
    note: String,
    barn: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'barns'
    }]
});

var DrugUseModel = mongoose.model('drug_uses', DrugUseSchema);
module.exports = DrugUseModel;