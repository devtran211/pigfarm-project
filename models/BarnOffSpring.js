const mongoose = require("mongoose");

const BarnOffSpringSchema = new mongoose.Schema({
    barnId: 
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "barns" 
    },
    offspringId: 
    { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "offsprings" 
    },
    dateIn: 
    { 
        type: Date, 
        default: Date.now 
    },
    dateOut: Date,
    note: String,
    },
    {
        collection: barn_offspring
    }
);

var BarnOffSpringModel = mongoose.model('barn_offspring', BarnOffSpringSchema)
module.exports = BarnOffSpringModel;