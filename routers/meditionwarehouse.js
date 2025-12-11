const express = require('express');
const router = express.Router();
const MeditionWareHouseModel = require('../models/MeditionWareHouse');

// get all medicine in warehouse
router.get('/', async (req,res) => {
    var meditions = await MeditionWareHouseModel.find({}).populate('invoice');
    res.render('meditionwarehouse/index', {
      title: "Medition Warehouse",
      active: "meditionWarehouse",
      meditions
    })
});

router.get('/list', async (req, res) => {
  try {
    const items = await MeditionWareHouseModel.find({});
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new medicine
router.post('/add', async (req,res) => {
    var medition = await MeditionWareHouseModel.create(req.body);
    console.log(req.body.usage_type);
    res.json(medition);
});

// get a medicine data to edit 
router.get('/detail/:id', async (req, res) => {
    try {
        const med = await MeditionWareHouseModel.findById(req.params.id);
        res.json(med);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// edit a medicine
router.put('/edit/:id', async (req, res) => {
    var id = req.params.id;
    var medition = req.body;
    try{
        await MeditionWareHouseModel.findByIdAndUpdate(id, medition);
        res.json('update succeed');
    }catch(err){
        res.json('update failed. Error: ' + err);
    }
});

// delete a medicine
router.delete('/delete/:id', async (req,res) => {
    await MeditionWareHouseModel.findByIdAndDelete(req.params.id);
    res.json({message: "Delete success"});
});

module.exports = router;