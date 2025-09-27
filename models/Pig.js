var mongoose = require('mongoose');

var PigSchema = mongoose.Schema({
   birth_date: Date,
   sex: String,
   status: String,
   herd: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'offsprings'
   },
   pig_father: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'pig'
   },
   pig_mother: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'pigs'
   }
});

var PigModel = mongoose.model('pigs', PigSchema); 
module.exports = PigModel;