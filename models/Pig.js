var mongoose = require('mongoose');

var PigSchema = mongoose.Schema({
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
   // reproduction: {
   //    parityCount: { type: Number, default: 0 },
   //    lastMatingDate: Date,
   //    lastGiveBirthDate: Date
   // },
   herd: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'herds'
   },
   barn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'barns'
   },
   status: String,
   meta: mongoose.Schema.Types.Mixed,
   isDeleted: { type: Boolean, default: false }
});

var PigModel = mongoose.model('pigs', PigSchema); 
module.exports = PigModel;