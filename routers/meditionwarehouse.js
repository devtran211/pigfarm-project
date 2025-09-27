const express = require('express');
const router = express.Router();
const MeditionWareHouseModel = require('../models/MeditionWareHouse');
const { findById } = require('../models/User');

router.get('/', async (req,res) => {
    var medition = await MeditionWareHouseModel.find({}).populate('invoice');
    res.json(medition);
})

router.post('/add', async (req,res) => {
    var medition = await MeditionWareHouseModel.create(req.body);
    res.json(medition);
})

router.put('edit/:id', async (req, res) => {
    var id = req.params.id;
    var medition = req.body;
    try{
        await MeditionWareHouseModel.findByIdAndUpdate(id, medition);
        res.json('update succeed');
    }catch(err){
        res.json('update failed. Error: ' + err);
    }
})

router.delete('delete/:id', async (req,res) => {
    var medition = await findByIdAndDelete(req.params.id);
    res.json('delete successfully');
})

module.exports = router;