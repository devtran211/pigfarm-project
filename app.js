const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();
const cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
const { engine } = require("express-handlebars");
const path = require("path");
const jsonHelper = require("./helpers/json");
const authMiddleware = require("./middleware/auth");

const app = express();

app.use(express.static(path.join(__dirname, "public")));

const authRoutes = require('./routers/auth');
const areaRoute = require('./routers/area');
const homeRoute = require('./routers/index');
const barnRoute = require('./routers/barn');
const herdRoute = require('./routers/herd');
const foodWareHouseRoute = require('./routers/foodwarehouse');
const meditionWareHouseRoute = require('./routers/meditionwarehouse');
const foodrationRoute = require('./routers/foodration')
const feedinglogRoute = require('./routers/feedinglog');
const drugUseLogRoute = require('./routers/druguselog');
const druguseRoute = require('./routers/druguse');
const barnhealthRoute = require('./routers/barnhealth');
const healthhistoryRoute = require('./routers/healthhistory');
const growthtrackingRoute = require('./routers/growthtracking');
const givebirthRoute = require('./routers/givebirth');
const weaningRoute = require('./routers/weaning');
const invoiceRoute = require('./routers/invoice');
const supplierRoute = require('./routers/supplier');
const pigRoute = require('./routers/pig');
const sellPigRoute = require('./routers/sellpigs');

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

// Handlebars config
app.engine("hbs", engine({
    extname: ".hbs",
    defaultLayout: "main",    // layout chính
    layoutsDir: path.join(process.cwd(), "views/layouts"),
    partialsDir: path.join(process.cwd(), "views/partials"),
    helpers: {
        eq: (a, b) => a === b,
        formatDate: (isoDate) => {
            if (!isoDate) return "";
            const d = new Date(isoDate);
            let day = d.getDate().toString().padStart(2, "0");
            let month = (d.getMonth() + 1).toString().padStart(2, "0");
            let year = d.getFullYear();
            return `${day}/${month}/${year}`;
        },
        formatMoney: (value) => {
            if (value == null || value === "") return "0đ";

            // Làm tròn xuống (FarmGo làm vậy)
            value = Math.floor(Number(value));

            // Chuyển thành chuỗi có dấu chấm mỗi 3 số
            const formatted = value
                .toString()
                .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

            return formatted + "đ";
        },
        ifEqual: function (a, b, options) {
            return a === b ? options.fn(this) : options.inverse(this);
        },
        ifCond: (v1, v2, options) => {
            return v1 == v2 ? options.fn(this) : options.inverse(this);
        },
        json: jsonHelper,
        statusClass: function (status) {
            if (status === "Paid") return "success";
            if (status === "Half paid") return "warning";
            if (status === "Unpaid") return "error";
            return "";
        }
    },
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true
    }
}));

app.set("view engine", "hbs");
app.set("views", path.join(process.cwd(), "views"));

// Static files
app.use(express.static("public"));

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
app.use('/auth', authRoutes);
app.use(authMiddleware);
app.use('/home', homeRoute);
app.use('/area', areaRoute);
app.use('/barn', barnRoute);
app.use('/herd', herdRoute);
app.use('/food-warehouse', foodWareHouseRoute);
app.use('/medition-warehouse', meditionWareHouseRoute);
app.use('/food-ration', foodrationRoute);
app.use('/api/feeding-log', feedinglogRoute);
app.use('/api/drug-use-log', drugUseLogRoute);
app.use('/drug-use', druguseRoute);
app.use('/growth-tracking', growthtrackingRoute);
app.use('/barn-health/', barnhealthRoute);
app.use('/health-history/', healthhistoryRoute);
app.use('/api/give-birth', givebirthRoute);
app.use('/api/weaning', weaningRoute);
app.use('/invoices', invoiceRoute);
app.use('/supplier', supplierRoute);
app.use('/pig', pigRoute);
app.use('/sell-pigs', sellPigRoute);


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