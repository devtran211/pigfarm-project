const express = require('express');
const router = express.Router();
const FoodWareHouseModel = require('../models/FoodWareHouse'); 

router.get('/', async (req, res) => {
   var foodWareHouse = await FoodWareHouseModel.find({}).populate('invoice');
   res.json(foodWareHouse);
})

router.post('/add', async (req, res) => {
   var food = await FoodWareHouseModel.create(req.body);
   res.json(food);
})

router.put('/edit/:id', async (req,res) => {
   var id = req.params.id;
   var food = req.body;
   try{
      await FoodWareHouseModel.findByIdAndUpdate(id, food);
      res.json('update succeed !');
   } catch (err) {
      res.json('update failed. Error: ' + err);
   }
})

router.delete('delete/:id', async (req,res) => {
   await FoodWareHouseModel.findByIdAndDelete(req.params.id);
   res.json('delete successfully');
})

module.exports = router;