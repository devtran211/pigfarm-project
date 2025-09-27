const mongoose = require('mongoose');

const BarnSchema = new mongoose.Schema({
    name: {
        type: String,
        require: true
    },
    acreage: String,
    maximum_capacity: Number,
    status: String,
    start_date: Date,
    note: String,
    breedingarea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'breedingareas' 
   },
});

var BarnModel = mongoose.model('barns', BarnSchema)
module.exports = BarnModel;