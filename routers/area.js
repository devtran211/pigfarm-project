var express = require('express');
var router = express.Router();
const AreaModel = require('../models/Area');
const BarnModel = require('../models/Barn');

// get all area + number of barns in an area
router.get('/', async (req, res) => {
    try {
        const areas = await AreaModel.find().lean();

        // go through each area and count barns in an area
        const areasWithBarnCount = await Promise.all(
            areas.map(async (area) => {
                const barnCount = await BarnModel.countDocuments({ 
                    area: area._id
                });

                return {
                    ...area,
                    total_barns: barnCount || 0 
                };
            })
        );

        // Render ra view Handlebars
        res.render('area/index', { 
            title: "Area",
            active: "area",
            area: areasWithBarnCount, 
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// get all barns
router.get('/barns/:areaId', async (req, res) => {
    Id = req.params.areaId;
    const area = await AreaModel.findById(Id).lean();
    const barns = await BarnModel.find({ area: Id }).lean();

    res.render('barn/index', {
        title: "Barn",
        area,
        barns
    });
});

// redirect to barns 
router.get('/barns/:areaId', async (req, res) => {
  try {
        const areaId = req.params.areaId;

        const area = await AreaModel.findById(areaId);
        const barns = await BarnModel.find({ breedingarea: areaId });

        res.render("barn/index", { area, barns });
  } catch (err) {
        console.log(err);
        res.status(500).send("Error loading barns");
  }
});

// create a new area
router.post('/create', async (req, res) => {
    try {
        const { 
            name, 
            acreage, 
            numberOfBarns, 
            type, 
            status, 
            creationDate, 
            note 
        } = req.body;

        // Validate 
        if (!name || !acreage || !numberOfBarns || !type || !status || !creationDate) {
            return res.status(400).send("Missing required fields");
        }

        // create object with schema Area
        const newArea = {
            name,
            acreage,
            numberOfBarns: Number(numberOfBarns),
            type,
            status,
            creationDate: creationDate,
            note
        };

        await AreaModel.create(newArea);

        //res.redirect('/area');
        res.status(200).json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// get data to edit 
router.get("/detail/:id", async (req, res) => {
    const area = await AreaModel.findById(req.params.id);
    res.json(area);
});

// edit an area
router.put("/edit/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            acreage,
            numberOfBarns,
            type,
            status,
            creationDate,
            note
        } = req.body;

        console.log('req.body', req.body);

        const updatedData = {
            name,
            acreage,
            numberOfBarns: Number(numberOfBarns),
            type,
            status,
            creationDate: new Date(creationDate),
            note
        };

        await AreaModel.findByIdAndUpdate(id, updatedData);

        res.json({ success: true });

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Update failed" });
    }
});

router.delete('/delete/:id', async (req, res) => {
   var id = req.params.id;
   try {
      await AreaModel.findByIdAndDelete(id);
      res.json({ success: true });
   } catch (err) {
      res.json('Delete breedingarea fail. Error: ' + err);
   };
});

module.exports = router;