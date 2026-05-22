const express = require("express");
const router = express.Router();

const {
  getRecommendedSize,
  getSizes,
} = require("../controllers/sizeController");

router.get("/sizes", getSizes);
router.post("/predict-size", getRecommendedSize);

module.exports = router;
