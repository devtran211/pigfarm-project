var express = require('express');
var router = express.Router();
var BarnModel = require('../models/Barn');
var BreedingAreaModel = require('../models/BreedingArea');
var OffSpringModel = require('../models/OffSpring');

router.get('/', async (req, res) => {
   var barns = await BarnModel.find({}).populate('breedingarea');
   res.json(barns);
})

router.post('/add', async (req, res) => {
   var barns = await BarnModel.create(req.body);
   res.json(barns);
})

router.get('/edit/:id', async (req, res) => {
   var id = req.params.id;
   var barn = await BarnModel.findById(id);
   var breedingarea = await BreedingAreaModel.find({});
   res.json({
      barn,
      breedingarea
   });
})

router.put('/edit/:id', async (req, res) => {
   var id = req.params.id;
   var barns = req.body;
   try {
      await BarnModel.findByIdAndUpdate(id, barns);
      res.json('update succeed !');
   } catch (err) {
      res.json('update failed. Error: ' + err);
   }
})

router.delete('/delete/:id', async (req, res) => {
   var id = req.params.id;
   try {
      await BarnModel.findByIdAndDelete(id);
      res.json('Delete barn succeed !');
   } catch (err) {
      res.json('Delete barn fail. Error: ' + err);
   };
})

// Thêm con giống lợn vào chuồng

// Lấy danh sách con giống trong một chuồng

// Lấy lịch sử chuồng của một con giống

module.exports = router;