const mongoose = require('mongoose');

const BarnHerdDetailSchema = new mongoose.Schema({
   herdName: String, 
   herdQuantity: Number,
   sex: String,
    barn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'barns' 
   },
    herd: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'herds' 
   }, 
   importDate: Date
});

var BarnHerdDetailModel = mongoose.model('barn_herd_details', BarnHerdDetailSchema)
module.exports = BarnHerdDetailModel;