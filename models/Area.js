const mongoose = require('mongoose');

const AreaSchema = new mongoose.Schema({
    name: {
        type: String,
        require: true
    },
    acreage: String,
    numberOfBarns: Number,
    type: {
        type: String,
        enum: ['Boar', 'Gestation', 'Farrowing', 'Weaning', 'Gilt Development', 'Fattening',
            'Isolation', 'Treatment', 'Restricted'],
        default: 'Empty'
    },
    status:{
        type: String,
        enum: ['Active','Empty','Cleaning', 'Disinfecting', 'Inactive'],
        default: 'Empty'
    },
    creationDate: Date,
    note: String
});

var AreaModel = mongoose.model('areas', AreaSchema)
module.exports = AreaModel;