require("./dbConfig");
const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const PORT = process.env.PORT || 8000;
const app = express();
const cors = require("cors");
var morgan = require("morgan");
const path = require("path");

// Custom Error Handling
const CoustomError = require("./src/utils/CoustomError");
const { sendError } = require("./src/utils/coustomResponse");

// Routes Imports
// const dobaDataRoute = require("./src/routers/dobaDataRoute");
const admin = require("./src/routers/AdminRouters/adminRouters");
const user = require("./src/routers/UserRouters/userRoutes");
const productRoutes = require("./src/routers/ProductRouts/productRoutes");

// const { syncCategories, syncRetailers } = require("./cron-task");

// Middleware
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cron Job
// syncCategories();
// syncRetailers();

// Log every incoming request for debugging
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// Image Acces from folder
app.use(
  "/baby-image",
  express.static(path.join(__dirname, "./src/BabyProfileImage")),
);
app.use("/banners", express.static(path.join(__dirname, "./src/Banners")));

// Routes
// app.use("/api/doba-data", dobaDataRoute);
// app.use("/api/admin", admin);
// app.use("/api/user", user);

app.use("/admin", admin);
app.use("/user", user);
app.use("/api/products", productRoutes);
// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  if (!(err instanceof CoustomError)) {
    err = new CoustomError(
      err.message || "Internal Server Error",
      err.statusCode || 500,
    );
  }
  sendError(res, err);
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
