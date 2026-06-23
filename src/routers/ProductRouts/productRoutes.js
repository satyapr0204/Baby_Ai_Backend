const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { authenticateToken } = require("../../middleware/authMiddleware");

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls", ".json"];

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV, Excel, and JSON files are allowed"));
    }
  },
});

const {
    uploadFile,
    getProducts,
} = require("../../controllers/ProductControllers/productController");

router.post("/upload", authenticateToken, upload.single("file"), uploadFile);
router.get("/getData", authenticateToken, getProducts);

module.exports = router;