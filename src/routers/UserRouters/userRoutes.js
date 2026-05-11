const path = require("path");
const {
  sendOtpForLogin,
  verifyOtp,
  userProfile,
  updateBabyProfileWithStep,
  homeData,
  allWishlistData,
  addToWishlist,
  deleteFromWishlist,
  fetchProductDetails,
  fetchBabyProfileData,
  addNewUserAddress,
  allSavedAddress,
  updateUserAddress,
  addressDetails,
  deleteAddress,
  setAsIsDefault,
  deleteBabyProfile,
  verifyPhoneEmailForUpdate,
  sendOtpForUpdatePhoneEmail,
  deleteMyProfile,
  babyCategoryData,
  productCategoryWiseData,
  addToCart,
  updatedQuantityInCart,
  fetchAllCartItems,
  removeFromCart,
  fabricList,
  colorsPreferenceList,
  getAllSizes,
  allFilterData,
  proxyImage,
  generateAvatar,
  applayFilters,
  selectBabyProfile,
  staticPageDetails,
  getAllPreferencesData,
  helpAndSupport,
  placeOrder,
  createPaymentIntent,
  createCheckoutSession,
  verifyPayment,
} = require("../../controllers/UserControllers/controllers");
const { authenticateToken } = require("../../middleware/authMiddleware");
const validateBody = require("../../middleware/validator");
const multer = require("multer");
const fs = require("fs");
const {
  getFaqs,
  allStaticPages,
} = require("../../controllers/AdminControllers/controllers");
const createMulterStorage = require("../../utils/path-to-above-file");
const userRouter = require("express").Router();

// Multer
// const uploadBabyProfile = path.join(__dirname, "../../BabyProfileImage");

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     if (!fs.existsSync(uploadBabyProfile)) {
//       fs.mkdirSync(uploadBabyProfile, { recursive: true });
//     }
//     cb(null, uploadBabyProfile);
//   },
//   filename: (req, file, cb) => {
//     const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, uniqueName + path.extname(file.originalname));
//   },
// });

// const uploadBabyImage = multer({ storage });

const uploadBabyProfileDir = path.join(__dirname, "../../BabyProfileImage");
const uploadBabyImage = createMulterStorage(uploadBabyProfileDir);

const uploadProfileAvatarDir = path.join(__dirname, "../../ProfileAvatarImage");
const uploadUserAvatar = createMulterStorage(uploadProfileAvatarDir);

// Auth api
userRouter.post(
  "/send-otp",
  validateBody(["input", "name", "channel"]),
  sendOtpForLogin,
);

userRouter.post(
  "/verify-otp",
  validateBody(["input", "otp", "token", "device_type"]),
  verifyOtp,
);

userRouter.post(
  "/send-otp-for-update",
  authenticateToken,
  validateBody(["input", "channel"]),
  sendOtpForUpdatePhoneEmail,
);

userRouter.post(
  "/verify-phone-email",
  authenticateToken,
  validateBody(["otp", "token"]),
  verifyPhoneEmailForUpdate,
);

userRouter.get("/fabric-preference-list", authenticateToken, fabricList);

userRouter.get(
  "/colors-preference-list",
  authenticateToken,
  colorsPreferenceList,
);

userRouter.get("/preferences", authenticateToken, getAllPreferencesData);

userRouter.get("/size-list", authenticateToken, getAllSizes);

// User profile api
userRouter.get("/user-profile", authenticateToken, userProfile);

userRouter.post(
  "/baby-profile-update-step",
  authenticateToken,
  uploadBabyImage.single("baby_profile_image"),
  updateBabyProfileWithStep,
);

userRouter.get("/home-data", authenticateToken, homeData);

// Wish list api
userRouter.get("/wishlist-data", authenticateToken, allWishlistData);

userRouter.post(
  "/add-wishlist",
  authenticateToken,
  validateBody(["product_id"]),
  addToWishlist,
);

userRouter.post(
  "/delete-from-wishlist",
  authenticateToken,
  validateBody(["id"]),
  deleteFromWishlist,
);

// Product api
userRouter.post(
  "/product-detail",
  authenticateToken,
  validateBody(["id"]),
  fetchProductDetails,
);

// Category api
userRouter.get("/categories", authenticateToken, babyCategoryData);

userRouter.post(
  "/category-products",
  authenticateToken,
  validateBody(["category_id"]),
  productCategoryWiseData,
);

userRouter.get("/proxy-image", proxyImage);

// Baby profile api
userRouter.post(
  "/baby-profile",
  authenticateToken,
  validateBody(["id"]),
  fetchBabyProfileData,
);

userRouter.post(
  "/delete-baby-profile",
  authenticateToken,
  validateBody(["id"]),
  deleteBabyProfile,
);

userRouter.post("/delete-my-profile", authenticateToken, deleteMyProfile);

// User Address Api
userRouter.post(
  "/add-address",
  authenticateToken,
  validateBody([
    "address_type",
    "street_address",
    "city",
    "state",
    "zip_code",
    "lat",
    "long",
  ]),
  addNewUserAddress,
);

userRouter.get("/saved-address", authenticateToken, allSavedAddress);

userRouter.post(
  "/update-address",
  authenticateToken,
  validateBody([
    "id",
    "address_type",
    "street_address",
    "city",
    "state",
    "zip_code",
    "lat",
    "long",
  ]),
  updateUserAddress,
);

userRouter.post(
  "/address-details",
  authenticateToken,
  validateBody(["id"]),
  addressDetails,
);

userRouter.post(
  "/delete-address",
  authenticateToken,
  validateBody(["id"]),
  deleteAddress,
);

userRouter.post(
  "/set-as-is-default",
  authenticateToken,
  validateBody(["id"]),
  setAsIsDefault,
);

// Cart api
userRouter.post(
  "/add-to-cart",
  authenticateToken,
  validateBody(["id", "quantity"]),
  addToCart,
);

userRouter.post(
  "/update-cart-quantity",
  authenticateToken,
  validateBody(["id", "quantity"]),
  updatedQuantityInCart,
);

userRouter.post(
  "/remove-from-cart",
  authenticateToken,
  validateBody(["id"]),
  removeFromCart,
);

userRouter.get("/fetch-cart-items", authenticateToken, fetchAllCartItems);

userRouter.get("/filter-data", authenticateToken, allFilterData);

userRouter.post("/filter", authenticateToken, applayFilters);

userRouter.post("/select-baby-profile", authenticateToken, selectBabyProfile);

// For static pages
userRouter.get("/faqs", authenticateToken, getFaqs);

userRouter.get("/all-static-pages", authenticateToken, allStaticPages);

userRouter.post(
  "/help-and-support",
  authenticateToken,
  validateBody([
    "name",
    "email",
    "message",
    "subject",
    "phone",
    "country_code",
  ]),
  helpAndSupport,
);

userRouter.post(
  "/static-page-details",
  authenticateToken,
  validateBody(["id"]),
  staticPageDetails,
);

userRouter.post(
  "/generate-avatar",
  authenticateToken,
  uploadUserAvatar.single("avatar_image"),
  // validateBody(["baby_name", "baby_dob", "baby_gender"]),
  generateAvatar,
);

// Oder api and checkout
userRouter.post(
  "/place-order",
  authenticateToken,
  validateBody(["id", "shipping_address"]),
  // createPaymentIntent,
  createCheckoutSession,
  // placeOrder,
);

userRouter.post(
  "/verify-payment",
  // authenticateToken,
  validateBody(["sessionId"]),
  verifyPayment,
);

module.exports = userRouter;
