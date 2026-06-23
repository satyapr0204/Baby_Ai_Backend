// require("./dbConfig");
// const dotenv = require("dotenv");
// dotenv.config();
// const express = require("express");
// const PORT = process.env.PORT || 8080;
// const app = express();
// const cors = require("cors");
// var morgan = require("morgan");
// const path = require("path");
// const helmet = require('helmet');
// const compression = require('compression');
// const rateLimit = require('express-rate-limit');

// // Custom Error Handling
// const CoustomError = require("./src/utils/CoustomError");
// const { sendError } = require("./src/utils/coustomResponse");

// // Routes Imports
// // const dobaDataRoute = require("./src/routers/dobaDataRoute");
// const admin = require("./src/routers/AdminRouters/adminRouters");
// const user = require("./src/routers/UserRouters/userRoutes");
// const productRoutes = require("./src/routers/ProductRouts/productRoutes");

// // const { syncCategories, syncRetailers } = require("./cron-task");

// // Middleware
// app.use(cors());
// app.use(morgan("dev"));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Cron Job
// // syncCategories();
// // syncRetailers();

// // Log every incoming request for debugging
// app.use((req, res, next) => {
//   console.log(`[REQUEST] ${req.method} ${req.url}`);
//   next();
// });

// // Image Acces from folder
// app.use(
//   "/baby-image",
//   express.static(path.join(__dirname, "./src/BabyProfileImage")),
// );
// app.use("/banners", express.static(path.join(__dirname, "./src/Banners")));

// // Routes
// // app.use("/api/doba-data", dobaDataRoute);
// // app.use("/api/admin", admin);
// // app.use("/api/user", user);

// app.use("/admin", admin);
// app.use("/user", user);
// app.use("/api/products", productRoutes);
// // Global Error Handling Middleware
// app.use((err, req, res, next) => {
//   console.error("[ERROR]", err.message);
//   if (!(err instanceof CoustomError)) {
//     err = new CoustomError(
//       err.message || "Internal Server Error",
//       err.statusCode || 500,
//     );
//   }
//   sendError(res, err);
// });

// app.listen(PORT, "127.0.0.1", () => {
//   console.log(`Server is running on http://127.0.0.1:${PORT}`);
// });

require("./dbConfig");
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

// Custom Utilities
const CoustomError = require("./src/utils/CoustomError");
const { sendError } = require("./src/utils/coustomResponse");

// Routes Imports
const adminRoutes = require("./src/routers/AdminRouters/adminRouters");
const userRoutes = require("./src/routers/UserRouters/userRoutes");
const productRoutes = require("./src/routers/ProductRouts/productRoutes");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 8080;

// ==========================================
// 1. GLOBAL SECURITY MIDDLEWARES
// ==========================================
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    status: 429,
    message: "Too many requests, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/", limiter);

// app.use(
//   cors({
//     origin: process.env.CLIENT_URL || "*",
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
//     credentials: true,
//   }),
// );

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// ==========================================
// 2. PERFORMANCE & LOGGING
// ==========================================
app.use(compression());
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// ==========================================
// 3. STATIC FILES HANDLING
// ==========================================
const staticOptions = {
  maxAge: "1d",
  etag: true,
};

const staticOptionsImg = {
  maxAge: "1d",
  etag: true,
  setHeaders: (res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  },
};



app.use(
  "/baby-image",
  express.static(path.join(__dirname, "files/BabyProfileImage"), staticOptionsImg),
);

app.use(
  "/baby-try-on-image",
  express.static(path.join(__dirname, "files/uploads/"), staticOptionsImg),
);

app.use(
  "/banners",
  express.static(path.join(__dirname, "files/Banners"), staticOptionsImg),
);

app.use("/admin", adminRoutes);
app.use("/user", userRoutes);
app.use("/api/products", productRoutes);

// Catch-all route for undefined paths (Using regex for Express 5 compatibility)
// app.all("(.*)", (req, res, next) => {
//     next(new CoustomError(`Can't find ${req.originalUrl} on this server!`, 404));
// });

app.use((req, res, next) => {
  const error = new CoustomError(
    `Can't find ${req.originalUrl} on this server!`,
    404,
  );
  next(error);
});

// Global Error Handler
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    console.error("[DEV ERROR] 💥", {
      message: err.message,
      stack: err.stack,
      path: req.originalUrl,
    });
  } else {
    console.error("[PROD ERROR] 💥", err.message);
  }

  if (!(err instanceof CoustomError)) {
    err = new CoustomError(
      err.message || "Internal Server Error",
      err.statusCode,
    );
  }

  sendError(res, err);
});

const server = app.listen(PORT, () => {
  console.log(
    `🚀 Server running in ${process.env.NODE_ENV || "development"} mode`,
  );
  console.log(`📡 URL: http://localhost:${PORT}`);
});
// const server = app.listen(PORT,'0.0.0.0', () => {
//   console.log(
//     `🚀 Server running in ${process.env.NODE_ENV || "development"} mode`,
//   );
//   console.log(`📡 URL: http://localhost:${PORT}`);
// });

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! 🌑 Shutting down...");
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  console.log("👋 SIGTERM RECEIVED. Shutting down gracefully");
  server.close(() => {
    console.log("💥 Process terminated!");
  });
});
