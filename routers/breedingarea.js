var express = require('express');
var router = express.Router();
const BreedingAreaModel = require('../models/BreedingArea');

router.get('/', async (req, res) => {
   var breedingarea = await BreedingAreaModel.find({});
   res.json(breedingarea);
});

router.post('/add', async (req, res) => {
   var breedingarea = await BreedingAreaModel.create(req.body);
   res.json(breedingarea);
});

router.get('/edit/:id', async (req, res) => {
   var id = req.params.id;
   var breedingarea = await BreedingAreaModel.findById(id);
   res.json(breedingarea);
})

router.put('/edit/:id', async (req, res) => {
   var id = req.params.id;
   var breedingarea = req.body;
   try {
      await BreedingAreaModel.findByIdAndUpdate(id, breedingarea);
      res.json('update succeed !');
   } catch (err) {
      res.json('update failed. Error: ' + err);
   }
})

router.delete('/delete/:id', async (req, res) => {
   var id = req.params.id;
   try {
      await BreedingAreaModel.findByIdAndDelete(id);
      res.json('Delete breeding succeed !');
   } catch (err) {
      res.json('Delete breedingarea fail. Error: ' + err);
   };
})

module.exports = router;