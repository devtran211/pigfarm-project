const express = require('express');
const router = express.Router();
const FoodWareHouseModel = require('../models/FoodWareHouse'); 

router.get('/', async (req, res) => {
   var items = await FoodWareHouseModel.find({}).populate('invoice');
   res.render('foodwarehouse/index', {
      title: 'Food Warehouse',
      active: 'foodWareHouse',
      items
   });
});

router.get('/list', async (req, res) => {
  try {
    const items = await FoodWareHouseModel.find({});
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/create', async (req, res) => {
   var food = await FoodWareHouseModel.create(req.body);
   res.redirect('/food-warehouse');
});

router.post('/update/:id', async (req,res) => {
   var id = req.params.id;
   var food = req.body;
   try{
      await FoodWareHouseModel.findByIdAndUpdate(id, food);
      res.redirect('/food-warehouse');
   } catch (err) {
      res.json('update failed. Error: ' + err);
   }
});

router.get("/detail/:id", async (req, res) => {
    try {
        const item = await FoodWareHouseModel.findById(req.params.id);
        res.json(item);
    } catch (err) {
        res.json("Error: " + err);
    }
});

router.get('/delete/:id', async (req,res) => {
   await FoodWareHouseModel.findByIdAndDelete(req.params.id);
   res.json('delete successfully');
})

module.exports = router;