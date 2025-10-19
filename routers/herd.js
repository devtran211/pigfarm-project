var express = require('express');
var router = express.Router();
const HerdModel = require('../models/Herd');
const InvoiceModel = require('../models/Invoice');

router.get('/', async (req, res) => {
   var herds = await HerdModel.find({}).populate('invoice');
   res.json(herds);
})

router.post('/add', async (req, res) => {
   var herds = await HerdModel.create(req.body);
   res.json(herds);
})

router.get('/edit/:id', async (req, res) => {
   var id = req.params.id;
   var herds = await HerdModel.findById(id);
   res.json(herds);
})

router.put('/edit/:id', async (req, res) => {
   var id = req.params.id;
   var herds = req.body;
   try {
      await HerdModel.findByIdAndUpdate(id, herds);
      res.json('update succeed !');
   } catch (err) {
      res.json('update failed. Error: ' + err);
   }
})

router.delete('/delete/:id', async (req, res) => {
   var id = req.params.id;
   try {
      await HerdModel.findByIdAndDelete(id);
      res.json('Delete herd succeed !');
   } catch (err) {
      res.json('Delete herd fail. Error: ' + err);
   };
})

module.exports = router;