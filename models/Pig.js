var mongoose = require('mongoose');

var PigSchema = new mongoose.Schema({
   tag: String,
   birthDate: Date,
   sex: { 
      type: String, 
      enum: ['boar','sow'], 
      required: true 
   },
   parents: {
      father: { type: mongoose.Schema.Types.ObjectId, ref: 'pigs' },
      mother: { type: mongoose.Schema.Types.ObjectId, ref: 'pigs' }
   },
   herd: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'herds'
   },
   barn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'barns'
   },
   status: String,
   isDeleted: { type: Boolean, default: false }
});

var PigModel = mongoose.model('pigs', PigSchema); 
module.exports = PigModel;