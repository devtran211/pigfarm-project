const mongoose =  require("mongoose");

const FeedingLogSchema = new mongoose.Schema({
    meal: {
        type: String, // exp: "morning", "noon", "evening"
        required: true,
    },
    status: {
        type: String,
    },
    completed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
        //required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
        barn: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "barns",
        required: true,
    },
    food_ration: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "food_rations",
        required: true,
    },
    meal_details: {
        foodDetailIds: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ration_food_details",
        },
        ],
        medDetailIds: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ration_medtiton_details",
        },
        ]
    }
});

var FeedingLogModel = mongoose.model('feedinglogs', FeedingLogSchema);
module.exports = FeedingLogModel;