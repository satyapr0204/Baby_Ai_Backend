const express = require("express");
const adminRouter = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {
  adminLogin,
  allUsers,
  updateUserStatus,
  deleteUser,
  addFaq,
  getFaqs,
  updateFaq,
  updateGlobalStatus,
  createStaticPage,
  updateStaticPageData,
  faqDetails,
  allStaticPages,
  userDetails,
  allCategories,
  categoryDetails,
  addBanner,
  updateBanner,
  allBanners,
  globalDelete,
  addMinMaxTimeCount,
  updateMinMaxTimeCount,
  getTimeCountConfig,
  addAlertMessage,
  fetchAllFlashMessages,
  globleFlashMessageEnable,
  globleFlashEnableStatus,
  updateCategory,
  retailersData,
  updateRetailerPrice,
  getAllData,
  getAllOrderData,
  getAllTransactions,
} = require("../../controllers/AdminControllers/controllers");

const { authenticateToken } = require("../../middleware/authMiddleware");
const validateBody = require("../../middleware/validator");

const uploadBanner = path.join(__dirname, "../../Banners");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadBanner)) {
      fs.mkdirSync(uploadBanner, { recursive: true });
    }
    cb(null, uploadBanner);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Authentication Routes
adminRouter.post("/login", adminLogin);

adminRouter.post(
  "/update-status",
  authenticateToken,
  validateBody(["id", "type"]),
  updateGlobalStatus,
);

adminRouter.post(
  "/delete",
  authenticateToken,
  validateBody(["id", "type"]),
  globalDelete,
);

// Flash message, count and time Routes
adminRouter.post(
  "/enable-flash-message",
  authenticateToken,
  globleFlashMessageEnable,
);

adminRouter.get(
  "/fetch-flash-enable-status",
  authenticateToken,
  globleFlashEnableStatus,
);

adminRouter.post(
  "/add-flash-message",
  authenticateToken,
  validateBody(["message"]),
  addAlertMessage,
);

adminRouter.get(
  "/all-flash-messages",
  authenticateToken,
  fetchAllFlashMessages,
);

adminRouter.post(
  "/add-min-max-time-count",
  authenticateToken,
  validateBody(["min", "max", "type"]),
  addMinMaxTimeCount,
);

adminRouter.post(
  "/update-min-max-time-count",
  authenticateToken,
  validateBody(["id", "min", "max", "type"]),
  updateMinMaxTimeCount,
);

adminRouter.get(
  "/get-time-count-config",
  authenticateToken,
  getTimeCountConfig,
);

// User Management Routes
adminRouter.get("/all-users", authenticateToken, allUsers);

adminRouter.post(
  "/update-user-status",
  authenticateToken,
  validateBody(["id"]),
  updateUserStatus,
);

adminRouter.post(
  "/delete-user",
  authenticateToken,
  validateBody(["id"]),
  deleteUser,
);

adminRouter.post(
  "/user-details",
  authenticateToken,
  validateBody(["id"]),
  userDetails,
);

// FAQ Routes
adminRouter.post(
  "/add-faq",
  authenticateToken,
  validateBody(["question", "answer"]),
  addFaq,
);

adminRouter.get("/faqs", authenticateToken, getFaqs);

adminRouter.post(
  "/update-faq",
  authenticateToken,
  validateBody(["id"]),
  updateFaq,
);

// adminRouter.post('/delete-faq', authenticateToken, validateBody(['id']), deleteFaq);
adminRouter.post(
  "/faq-details",
  authenticateToken,
  validateBody(["id"]),
  faqDetails,
);

// Banner Routes
adminRouter.post(
  "/add-banner",
  authenticateToken,
  upload.single("banner"),
  validateBody([
    "location",
    "priority",
    "heading",
    "description",
    "redirection_link",
    "start_offer_date",
    "end_offer_date",
  ]),
  addBanner,
);

adminRouter.post(
  "/update-banner",
  authenticateToken,
  upload.single("banner"),
  validateBody(["id"]),
  updateBanner,
);

adminRouter.get("/banners", authenticateToken, allBanners);

// Static Pages Routes
adminRouter.post(
  "/create-static-page",
  authenticateToken,
  validateBody(["title", "content"]),
  createStaticPage,
);

adminRouter.post(
  "/update-static-page",
  authenticateToken,
  validateBody(["id"]),
  updateStaticPageData,
);

adminRouter.get("/pages", authenticateToken, allStaticPages);

// Category Routes
adminRouter.get("/categories", authenticateToken, allCategories);

adminRouter.post(
  "/categories-details",
  authenticateToken,
  validateBody(["id"]),
  categoryDetails,
);

adminRouter.post(
  "/update-category",
  authenticateToken,
  validateBody(["id", "add_on_percentage", "discount"]),
  updateCategory,
);

adminRouter.get("/retails", authenticateToken, retailersData);
adminRouter.post(
  "/update-retailer-price",
  authenticateToken,
  validateBody(["id", "add_on_percentage", "discount"]),
  updateRetailerPrice,
);

adminRouter.get("/orders", authenticateToken, getAllOrderData);

adminRouter.get("/transactions", authenticateToken, getAllTransactions);

adminRouter.get("/get-data", getAllData);

module.exports = adminRouter;
