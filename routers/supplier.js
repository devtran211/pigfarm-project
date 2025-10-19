var express = require('express');
var router = express.Router();
const SupplierModel = require('../models/Supplier');

router.get('/', async (req, res) => {
   var supplier = await SupplierModel.find({});
   res.json(supplier);
})

router.post('/add', async (req, res) => {
   var suppliers = await SupplierModel.create(req.body);
   res.json(suppliers);
})

router.put('/edit/:id', async (req, res) => {
   var id = req.params.id;
   var suppliers = req.body;
   try {
      await SupplierModel.findByIdAndUpdate(id, suppliers);
      res.json('update succeed !');
   } catch (err) {
      res.json('update failed. Error: ' + err);
   }
})

router.delete('/delete/:id', async (req, res) => {
   var id = req.params.id;
   try {
      await SupplierModel.findByIdAndDelete(id);
      res.json('Delete breeding succeed !');
   } catch (err) {
      res.json('Delete breedingarea fail. Error: ' + err);
   };
})

module.exports = router;