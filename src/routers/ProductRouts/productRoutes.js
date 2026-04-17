const express = require("express");
const router = express.Router();
const multer = require("multer");

const upload = multer({ dest: "uploads/" });

const {
    uploadFile,
    getProducts,
} = require("../../controllers/ProductControllers/productController");

router.post("/upload", upload.single("file"), uploadFile);
router.get("/getData", getProducts);

module.exports = router;