var express = require('express');
var router = express.Router();
const OffSpringModel = require('../models/OffSpring');
const InvoiceModel = require('../models/Invoice');

router.get('/', async (req, res) => {
   var invoices = await OffSpringModel.find({}).populate('invoice');
   res.json(invoices);
})

router.post('/add', async (req, res) => {
   var offspring = await OffSpringModel.create(req.body);
   res.json(offspring);
})

router.get('/edit/:id', async (req, res) => {
   var id = req.params.id;
   var offspring = await OffSpringModel.findById(id);
   res.json(offspring);
})

router.put('/edit/:id', async (req, res) => {
   var id = req.params.id;
   var offspring = req.body;
   try {
      await OffSpringModel.findByIdAndUpdate(id, offspring);
      res.json('update succeed !');
   } catch (err) {
      res.json('update failed. Error: ' + err);
   }
})

router.delete('/delete/:id', async (req, res) => {
   var id = req.params.id;
   try {
      await OffSpringModel.findByIdAndDelete(id);
      res.json('Delete breeding succeed !');
   } catch (err) {
      res.json('Delete breedingarea fail. Error: ' + err);
   };
})

module.exports = router;