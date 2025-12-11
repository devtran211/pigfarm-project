const mongoose = require('mongoose');

const BarnSchema = new mongoose.Schema({
    name: {
        type: String,
        require: true
    },
    acreage: String,
    maximumCapacity: Number,
    total_pigs: {
        type: Number,
        default: 0,
    },
    status:{
        type: String,
        enum: ['Active','Empty','Cleaning', 'Disinfecting', 'Inactive'],
        default: 'Empty'
    },
    creationDate: Date,
    note: String,
    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'areas' 
   },
});

var BarnModel = mongoose.model('barns', BarnSchema)
module.exports = BarnModel;