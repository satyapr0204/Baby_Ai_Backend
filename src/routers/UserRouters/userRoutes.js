const userRouter = require("express").Router();
const path = require("path");

// Middlewares 
const { authenticateToken } = require("../../middleware/authMiddleware");
const validateBody = require("../../middleware/validator");
const createMulterStorage = require("../../utils/path-to-above-file");
//Controllers require
const {
    sendOtpForLogin, verifyOtp, userProfile, updateBabyProfileWithStep, homeData, allWishlistData, addToWishlist, deleteFromWishlist, fetchProductDetails,
    fetchBabyProfileData, addNewUserAddress, allSavedAddress, updateUserAddress, addressDetails, deleteAddress, setAsIsDefault, deleteBabyProfile,
    verifyPhoneEmailForUpdate, sendOtpForUpdatePhoneEmail, deleteMyProfile, babyCategoryData, productCategoryWiseData, addToCart, updatedQuantityInCart,
    fetchAllCartItems, removeFromCart, fabricList, colorsPreferenceList, getAllSizes, allFilterData, generateAvatar, applayFilters, selectBabyProfile,
    staticPageDetails, getAllPreferencesData, helpAndSupport, placeOrder, createPaymentIntent, createCheckoutSession, verifyPayment, fetchAllOrderedItems,
    buyAgain, createReorderCheckoutSession, getAllOrders, fetchOrderDetails, cancelMyOrder, getAllCountryCode, getAllStateCode, allProduct, getRecommendedProduct,
    generateBabyTryOn, getOrder, trackOrderC, productCategoryWiseDataPagination, generateBabyTryOnModal, createCheckoutSessionForSubscription, allFitingRoomProduct,
    removeFromFitingRoom, genrateSingleImage, searchProduct, getAllRecentlySearchedData,
    getAllFitingRoomData,
    createCheckoutSessionAddOnePlan, } = require("../../controllers/UserControllers/controllers");
const { getRecommendedSize, } = require("../../controllers/AiControllers/sizeController");
const { getFaqs, allStaticPages, fetchAllPlans, } = require("../../controllers/AdminControllers/controllers");

const uploadBabyProfileDir = path.join(__dirname, "../../../files/BabyProfileImage");
const uploadBabyImage = createMulterStorage(uploadBabyProfileDir);

const uploadProfileAvatarDir = path.join(__dirname, "../../../files/ProfileAvatarImage");
const uploadUserAvatar = createMulterStorage(uploadProfileAvatarDir);

// Taking plan data for subscription
userRouter.post(
    '/init-subscription',
    authenticateToken,
    createCheckoutSessionForSubscription,
);

userRouter.post('/add-on-token', authenticateToken, createCheckoutSessionAddOnePlan)

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

userRouter.post(
    "/category-products-pagination",
    authenticateToken,
    validateBody(["category_id"]),
    productCategoryWiseDataPagination,
);


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
        "lat",
        "long",
        "post_code",
        "country_id",
        "state_id",
    ]),
    addNewUserAddress,
);

userRouter.get("/saved-address", authenticateToken, allSavedAddress);

userRouter.post(
    "/update-address",
    authenticateToken,
    validateBody(["id"]),
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

userRouter.get("/my-closet", authenticateToken, fetchAllOrderedItems);

userRouter.get("/filter-data", authenticateToken, allFilterData);

userRouter.post("/filter", authenticateToken, applayFilters);

userRouter.post('/search-product', validateBody(["search_text"]), authenticateToken, searchProduct)

userRouter.get('/recent-search-data', authenticateToken, getAllRecentlySearchedData)

userRouter.post(
    "/select-baby-profile",
    authenticateToken,
    validateBody(["id"]),
    selectBabyProfile,
);

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
    validateBody(["id", "shipping_address_id"]),
    // createPaymentIntent,
    createCheckoutSession,
    // placeOrder,
);

userRouter.post(
    "/buy-again",
    authenticateToken,
    validateBody(["id"]),
    buyAgain,
);

userRouter.post("/re-order", authenticateToken, createReorderCheckoutSession);

userRouter.get("/fetch-all-orders", authenticateToken, getAllOrders);

userRouter.post("/order-details", authenticateToken, fetchOrderDetails);

userRouter.post(
    "/cancel-order",
    authenticateToken,
    validateBody(["id", "reason"]),
    cancelMyOrder,
);

userRouter.post(
    "/verify-payment",
    // authenticateToken,
    validateBody(["sessionId"]),
    verifyPayment,
);

userRouter.get("/all-country-code", authenticateToken, getAllCountryCode);

userRouter.post("/state-code", authenticateToken, getAllStateCode);

// Ai Servicess
// userRouter.post("/predict-size", authenticateToken, getRecommendedSize);

userRouter.post(
    "/predict-size",
    authenticateToken,
    validateBody(["landmarks", "image_height", "image_width"]),
    getRecommendedProduct,
);

userRouter.get("/all-product", allProduct);

userRouter.get('/plans', authenticateToken, fetchAllPlans);

// AI Related Routers
userRouter.post("/test-bambani-order", authenticateToken, getOrder);

userRouter.get("/track-order", authenticateToken, trackOrderC);

userRouter.post("/try-on", authenticateToken, generateBabyTryOn);

userRouter.get('/fiting-room-data', authenticateToken, allFitingRoomProduct);

userRouter.get('/all-fiting-room-data', authenticateToken, getAllFitingRoomData)

userRouter.post('/remove-from-fiting-room', authenticateToken, removeFromFitingRoom);

userRouter.post("/create-baby-modal", uploadUserAvatar.single("BabyModalImage"), generateBabyTryOnModal);

userRouter.post('/saprate-product-image', uploadUserAvatar.single("productImage"), genrateSingleImage);

module.exports = userRouter;