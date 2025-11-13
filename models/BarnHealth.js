const mongoose = require('mongoose');

const BarnHealthSchema = new mongoose.Schema({
    dateOfInspection: Date,
    averageWeight: Number,
    loss: Number,
    faecesStatus: String,
    note: String,
    barn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'barns' 
   },
});

var BarnHealthModel = mongoose.model('barn_healths', BarnHealthSchema)
module.exports = BarnHealthModel;