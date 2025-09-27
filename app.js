const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();
const cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

const app = express();

const authRoutes = require('./routers/auth');
const breedingareaRoute = require('./routers/breedingarea');
const barnRoute = require('./routers/barn');
const offspringRoute = require('./routers/offspring');
const foodWareHouseRoute = require('./routers/foodwarehouse');
const meditionWareHouseRoute = require('./routers/meditionwarehouse');
const invoiceRoute = require('./routers/invoice');
const supplierRoute = require('./routers/supplier');

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

// Middleware
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// CORS: chỉnh origin cho frontend của bạn; credentials:true nếu dùng cookie
app.use(cors({
  origin: true, // development: allow all origins (thay đổi ở production)
  credentials: true
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/breedingarea', breedingareaRoute);
app.use('/api/barn', barnRoute);
app.use('/api/offspring', offspringRoute);
app.use('/api/food-warehouse', foodWareHouseRoute);
app.use('/api/medition-warehouse', meditionWareHouseRoute);
app.use('/api/invoice', invoiceRoute);
app.use('/api/supplier', supplierRoute);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// Connect DB + start server
const PORT = process.env.PORT || 3001;
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('DB connection error:', err);
});

app.listen(PORT, () => 
    console.log(`Server running on port ${PORT}`
));