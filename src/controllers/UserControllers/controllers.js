const FASHN_API_KEY = process.env.FASHN_API_KEY;
const FASHN_BASE_URL = process.env.FASHN_AI_BASE_URL;
const User = require("../../modals/userModal");
const fs = require("fs").promises;
const CoustomError = require("../../utils/CoustomError");
const jwt = require("jsonwebtoken");
const { sendResponse } = require("../../utils/coustomResponse");
const crypto = require("crypto");
const { sendOtpOnEmail } = require("../../utils/sendMailServices");
const BabyProfile = require("../../modals/babyProfileModal");
const Banner = require("../../modals/bannerModal");
const { Wishlist } = require("../../modals/userWishlistModal");
const { getPagination, getPagingData } = require("../../utils/pagination");
const Product = require("../../modals/ProductModal/product");
const Address = require("../../modals/addressModal");
const path = require("path");
const Cart = require("../../modals/cartModal");
const Category = require("../../modals/ProductModal/category");
const Fabric = require("../../modals/ProductModal/fabric");
const { Op, Sequelize } = require("sequelize");
const Retailer = require("../../modals/ProductModal/retailer");
const { getCalculatedProducts } = require("../../utils/PriceHelper");
const Color = require("../../modals/ProductModal/color");
const Size = require("../../modals/ProductModal/size");
const { processBabyData } = require("../AdminControllers/controllers");
const Gender = require("../../modals/ProductModal/gender");
const Brand = require("../../modals/ProductModal/brand");
const axios = require("axios");
const sharp = require("sharp");
const StaticPage = require("../../modals/staticPageModal");
const Order = require("../../modals/orderModal");
const Transaction = require("../../modals/transactionModal");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Country, State } = require("country-state-city");
const { formatFullAddress } = require("../../utils/getFullAddress");
const { createOrder } = require("../../utils/bambiniService");
const {
  getCalculatedProductsWithSuffling,
} = require("../../utils/calclutePricewithSuffaling");

const genrateOtpAndToken = async (input, name, channel, country_code) => {
  const otp = crypto.randomInt(10000, 99999).toString();
  console.log("otp", otp);
  const expiryToken = await jwt.sign(
    { input, otp, channel, name, country_code },
    process.env.JWT_SECRET,
    { expiresIn: "1m" },
  );
  return { otp, expiryToken };
};

const proxyImage = async (req, res) => {
  try {
    const { url } = req.query;
    console.log("url", url);
    if (!url) return res.status(400).send("URL missing");

    const response = await axios({
      method: "get",
      url: url,
      headers: {
        "X-App-ID": "BabyAiApp-Frontend-v1",
      },
    });
    console.log("response", response);
    res.setHeader(
      "Content-Type",
      response.headers["content-type"] || "image/jpeg",
    );
    response.data.pipe(res);
  } catch (error) {
    console.log("error", error);
    console.error("Proxy Error:", error.message);
    res.status(500).send("Image fetch failed");
  }
};

const ensureHttps = (data) => {
  if (!data) return data;
  const proxyBaseUrl =
    "https://bridgeable-erinn-overluxuriously.ngrok-free.dev/proxy-image?url=";
  const getProxyUrl = (originalUrl) => {
    return `${proxyBaseUrl}${encodeURIComponent(originalUrl)}`;
  };
  if (Array.isArray(data)) {
    return data.map((url) => getProxyUrl(url));
  }
  return getProxyUrl(data);
};

const sendOtpForLogin = async (req, res, next) => {
  try {
    const { input, name, channel, country_code } = req.body;
    if (!input || !name || !channel)
      throw new CoustomError("Email Or Phone is required");
    const { otp, expiryToken } = await genrateOtpAndToken(
      input,
      name,
      channel,
      country_code,
    );
    if (channel === "email") {
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: input,
        subject: "Verification otp",
        html: `<p>Hi ${name},</p><p>Your verification code is ${otp}.</p><p>Thanks,<br/>Baby Ai Team</p>
                `,
      };
      await sendOtpOnEmail(mailOptions);
    } else if (channel === "phone") {
      const phoneStr = req.body.input.toString();
      // if (!phoneStr.startsWith("+")) {
      //   throw new CoustomError(
      //     "Phone number must start with a country code (e.g., +91)",
      //     400,
      //   );
      // }
      const digitsOnly = phoneStr.replace(/\D/g, "");
      // if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      //   throw new CoustomError("Invalid phone number length", 400);
      // }
    }
    console.log(`OTP for ${input}: ${otp}`);
    return sendResponse(res, "OTP sent! Valid for 30 seconds.", 200, {
      token: expiryToken,
      otp: otp,
    });
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { input, otp, token, device_type, fcm_token } = req.body;
    if (!token || !input || !otp || !device_type || !fcm_token)
      throw new CoustomError("All fields are required", 400);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(new CoustomError("OTP has expired (30s limit)", 200));
      }
      return next(new CoustomError("Invalid or corrupted token", 200));
    }

    if (decoded.input !== input || decoded.otp !== otp) {
      return next(new CoustomError("Invalid OTP", 200));
    }

    let user;
    const whereCondition =
      decoded.channel === "email"
        ? { email: input.toLowerCase(), is_delete: 0 }
        : { phone: input, is_delete: 0, country_code: decoded.country_code };

    user = await User.findOne({ where: whereCondition });

    if (!user) {
      const createData = {
        name: decoded.name,
        fcm_token: fcm_token,
        ...whereCondition,
      };
      user = await User.create(createData);
    } else {
      if (user.is_active === 0 || user.is_delete === 1) {
        return next(
          new CoustomError(
            "Your account is inactive or deleted. Please contact support.",
            200,
          ),
        );
      }
    }
    let BabyProfileData;
    if (user.is_profile_complete === 0) {
      BabyProfileData = await BabyProfile.findAll({
        where: {
          user_id: user.id,
        },
      });
    }
    const userInfo = {
      id: user.id,
      contact: user.email || user.phone,
      name: user.name,
    };

    const accessToken = jwt.sign(userInfo, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    return sendResponse(res, "Verified successfully!", 200, {
      user: user,
      ...(BabyProfileData && { baby_profile: BabyProfileData }),
      access_token: accessToken,
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    next(error);
  }
};

const sendOtpForUpdatePhoneEmail = async (req, res, next) => {
  try {
    const { name } = req.user;
    const { input, channel, country_code } = req.body;
    if (!input || !channel)
      throw new CoustomError("Email Or Phone is required", 400);
    const { otp, expiryToken } = await genrateOtpAndToken(
      input,
      name,
      channel,
      country_code,
    );
    const isAlreadyExist = await User.findOne({
      where:
        channel === "email"
          ? { email: input, is_delete: 0 }
          : { phone: input, is_delete: 0, country_code: country_code },
    });
    if (isAlreadyExist)
      throw new CoustomError(`This ${channel} is already registered.`, 404);

    if (channel === "email") {
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: input,
        subject: "Verification otp",
        html: `<p>Hi ${name},</p><p>Your verification code is ${otp}.</p><p>Thanks,<br/>Baby Ai Team</p>
                `,
      };
      await sendOtpOnEmail(mailOptions);
    } else if (channel === "phone") {
      const phoneStr = req.body.input.toString();
    }
    console.log(`OTP for ${input}: ${otp}`);
    return sendResponse(res, "OTP sent! Valid for 30 seconds.", 200, {
      token: expiryToken,
      otp: otp,
    });
  } catch (error) {
    next(error);
  }
};

const verifyPhoneEmailForUpdate = async (req, res, next) => {
  try {
    const { otp, token } = req.body;
    const { id } = req.user;
    if (!otp || !token)
      throw new CoustomError("OTP and token are required", 400);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(new CoustomError("OTP has expired (30s limit)", 400));
      }
      return next(new CoustomError("Invalid or corrupted token", 400));
    }
    if (decoded.otp !== otp) {
      return next(new CoustomError("Invalid OTP", 400));
    }
    let user;
    let input = decoded.input;
    let country_code = decoded.country_code;
    user = await User.findOne({
      where: {
        id,
        is_delete: 0,
      },
    });
    if (!user) throw new CoustomError(`User not found.`, 404);
    const updateData =
      decoded.channel === "email"
        ? { email: input.toLowerCase() }
        : { phone: input, country_code: country_code };
    await user.update(updateData);

    return sendResponse(res, `${decoded.channel} updated successfully!`, 200, {
      user: user,
    });
  } catch (error) {
    next(error);
  }
};

const fabricList = async (req, res, next) => {
  try {
    const allFabricList = await Fabric.findAll();
    if (!allFabricList) throw new CoustomError("Fabric list not found", 404);
    sendResponse(res, "Fetching all Fabric", 200, {
      allFabricList,
    });
  } catch (error) {
    next(error);
  }
};

const colorsPreferenceList = async (req, res, next) => {
  try {
    const allColorList = await Color.findAll();

    if (!allColorList)
      throw new CoustomError("Color preference not found!", 404);

    let uniqueColors = new Set();
    let finalColors = [];

    allColorList.forEach((item) => {
      const splitNames = item.name.includes("/")
        ? item.name.split("/")
        : [item.name];

      splitNames.forEach((name) => {
        const trimmedName = name.trim();
        if (
          !uniqueColors.has(trimmedName.toLowerCase()) &&
          isNaN(trimmedName)
        ) {
          uniqueColors.add(trimmedName.toLowerCase());
          finalColors.push({
            id: item.id,
            name: trimmedName,
          });
        }
      });
    });

    sendResponse(res, "Fetching all color list", 200, {
      allColorList: finalColors,
    });
  } catch (error) {
    next(error);
  }
};

const getAllPreferencesData = async (req, res, next) => {
  try {
    const [colorsData, sizes, febrics] = await Promise.all([
      Color.findAll({ attributes: { exclude: ["createdAt", "updatedAt"] } }),
      Size.findAll({ attributes: { exclude: ["createdAt", "updatedAt"] } }),
      Fabric.findAll({ attributes: { exclude: ["createdAt", "updatedAt"] } }),
    ]);

    let uniqueColors = new Set();
    let finalColors = [];

    colorsData.forEach((item) => {
      const splitNames = item.name.includes("/")
        ? item.name.split("/")
        : [item.name];

      splitNames.forEach((name) => {
        const trimmedName = name.trim();
        if (
          !uniqueColors.has(trimmedName.toLowerCase()) &&
          isNaN(trimmedName)
        ) {
          uniqueColors.add(trimmedName.toLowerCase());
          finalColors.push({
            id: item.id,
            name: trimmedName,
          });
        }
      });
    });

    sendResponse(res, "Fetching all preferences data", 200, {
      colors: finalColors,
      sizes,
      fabrics: febrics,
    });
  } catch (error) {
    next(error);
  }
};

const getAllSizes = async (req, res, next) => {
  try {
    const allSizeList = await Size.findAll();
    if (!allSizeList)
      throw new CoustomError("Color preference not found!", 404);
    sendResponse(res, "Fetching all color list", 200, {
      allSizeList,
    });
  } catch (error) {
    next(error);
  }
};

const userProfile = async (req, res, next) => {
  try {
    const { id } = req.user;
    const userData = await User.findOne({
      where: {
        id,
        is_delete: 0,
      },
      attributes: {
        include: [
          [
            Sequelize.literal(`(
          SELECT COUNT(*)
          FROM user_wishlist AS wishlist
          WHERE
            wishlist.user_id = User.id
        )`),
            "wishlistCount",
          ],
        ],
      },
      include: [
        {
          model: BabyProfile,
          as: "babies",
          required: false,
        },
      ],
    });
    if (!userData) {
      throw new CoustomError("User not found!", 404);
    }
    const user = await processBabyData(userData);

    sendResponse(res, "User and all baby profiles fetched successfully", 200, {
      user: user,
    });
  } catch (error) {
    next(error);
  }
};

const updateBabyProfileWithStep = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const {
      step,
      id,
      baby_nikname,
      age_range,
      baby_gender,
      fabric_preferences,
      preferred_colors,
      user_name,
    } = req.body;

    let baby_profile_image;
    console.log("req.body", req.body);
    if (req.file) {
      baby_profile_image = req.file.filename;
      console.log("baby_profile_image in side if", baby_profile_image);
    } else {
      console.log("req.file in side else", req.file);
      baby_profile_image = null;
    }
    let newBaby;
    if (!step && id) {
      const babyDataWithUser = await BabyProfile.findOne({
        where: {
          id,
          user_id,
        },
      });
      const userData = await User.findOne({
        where: {
          id: user_id,
        },
      });

      if (babyDataWithUser) {
        const parsedFabrics =
          typeof fabric_preferences === "string"
            ? JSON.parse(fabric_preferences)
            : fabric_preferences;

        const parsedColors =
          typeof preferred_colors === "string"
            ? JSON.parse(preferred_colors)
            : preferred_colors;

        await babyDataWithUser.update({
          baby_nikname: baby_nikname
            ? baby_nikname
            : babyDataWithUser.baby_nikname,

          age_range: age_range ? age_range : babyDataWithUser.age_range,
          baby_gender: baby_gender ? baby_gender : babyDataWithUser.baby_gender,

          fabric_preferences:
            parsedFabrics && parsedFabrics.length >= 0
              ? parsedFabrics
              : babyDataWithUser.fabric_preferences,

          preferred_colors:
            parsedColors && parsedColors.length >= 0
              ? parsedColors
              : babyDataWithUser.preferred_colors,

          baby_profile_image: baby_profile_image
            ? baby_profile_image
            : babyDataWithUser.baby_profile_image,
        });

        await userData.update({
          name: user_name ? user_name : userData.name,
        });

        return sendResponse(
          res,
          "Baby profile has been updated succesfully",
          200,
          babyDataWithUser,
        );
      } else {
        throw new CoustomError("Baby profile not found", 404);
      }
    } else if (!step && !id) {
      const existingBabyProfile = await BabyProfile.findAll({
        where: {
          user_id,
        },
      });
      console.log("existingBabyProfile.length", existingBabyProfile.length);
      if (existingBabyProfile.length >= 3)
        throw new CoustomError("You can only add 3 baby profiles", 400);

      if (
        !baby_nikname ||
        !age_range ||
        !baby_gender ||
        !fabric_preferences ||
        !preferred_colors
      ) {
        if (req.file) {
          await fs.unlink(req.file.path);
        }
        throw new CoustomError("All fields are required", 400);
      }
      const parsedFabrics =
        typeof fabric_preferences === "string"
          ? JSON.parse(fabric_preferences)
          : fabric_preferences;
      const parsedColors =
        typeof preferred_colors === "string"
          ? JSON.parse(preferred_colors)
          : preferred_colors;
      await BabyProfile.create({
        baby_nikname,
        age_range,
        baby_gender,
        fabric_preferences: parsedFabrics,
        preferred_colors: parsedColors,
        baby_profile_image,
        user_id,
      });
      const userData = await User.findOne({
        where: {
          id: user_id,
          is_delete: 0,
        },
      });
      await userData.update({
        is_profile_complete: 1,
        is_new_user: 0,
        current_step: 4,
      });
      return sendResponse(
        res,
        "Baby profile has beed created successfully",
        200,
      );
    }
    switch (step) {
      case "1":
        if (!baby_nikname || !age_range)
          throw new CoustomError("Nickname and Age are required!", 400);
        if (id) {
          const is_baby = await BabyProfile.findOne({
            where: {
              id,
              user_id,
            },
          });
          if (is_baby) {
            newBaby = await is_baby.update({
              baby_nikname: baby_nikname ? baby_nikname : is_baby.baby_nikname,
              age_range: age_range ? age_range : is_baby.age_range,
            });
          } else {
            throw new CoustomError("Your baby id is wrong", 400);
          }
        } else {
          newBaby = await BabyProfile.create({
            baby_nikname,
            age_range,
            user_id,
          });
        }
        return sendResponse(
          res,
          "Step 1 is complated now go to step 2",
          200,
          newBaby,
        );
      case "2":
        if (!baby_gender || !id) {
          // throw new CoustomError("Gender is required!", 400);
          const missingField = !baby_gender ? "Gender" : "ID";
          throw new CoustomError(`${missingField} is required!`, 400);
        }

        const baby = await BabyProfile.findOne({
          where: {
            id,
            user_id,
          },
        });
        if (!baby) throw new CoustomError("Baby not found", 404);
        console.log("baby_profile_image here", baby_profile_image);
        await baby.update({
          baby_gender,
          baby_profile_image: baby_profile_image
            ? baby_profile_image
            : BabyProfile.baby_profile_image,
        });
        return sendResponse(
          res,
          "Step 2 is complated now go to step 3",
          200,
          baby,
        );

      case "3":
        // console.log("fabric_preferences",fabric_preferences)
        if (!fabric_preferences || !id) {
          const missingField = !fabric_preferences
            ? "Fabric preferences"
            : "ID";
          throw new CoustomError(`${missingField} is required!`, 400);
          // throw new CoustomError("Fabric preferences are required!", 400);
        }

        const parsedFabrics =
          typeof fabric_preferences === "string"
            ? JSON.parse(fabric_preferences)
            : fabric_preferences;

        const babyProfileData = await BabyProfile.findOne({
          where: {
            id,
            user_id,
          },
        });
        if (!babyProfileData) throw new CoustomError("Baby not found", 404);
        await babyProfileData.update({
          fabric_preferences: parsedFabrics,
        });

        return sendResponse(
          res,
          "Step 3 is complated now go to step 4",
          200,
          babyProfileData,
        );
      case "4":
        if (!preferred_colors || !id) {
          // throw CoustomError("Preferred colors are required!", 400);
          const missingField = !preferred_colors ? "Preferred colors" : "ID";
          throw new CoustomError(`${missingField} is required!`, 400);
        }
        const parsedColors =
          typeof preferred_colors === "string"
            ? JSON.parse(preferred_colors)
            : preferred_colors;
        const babyPro = await BabyProfile.findOne({
          where: {
            id,
            user_id,
          },
        });
        if (!babyPro) throw new CoustomError("Baby not found", 404);
        await babyPro.update({
          preferred_colors: parsedColors,
        });
        const userData = await User.findOne({
          where: {
            id: user_id,
            is_delete: 0,
          },
        });
        await userData.update({
          is_profile_complete: 1,
          is_new_user: 0,
          current_step: 4,
        });
        let responseData = babyPro.toJSON();
        if (responseData.fabric_preferences) {
          try {
            responseData.fabric_preferences =
              typeof responseData.fabric_preferences === "string"
                ? JSON.parse(responseData.fabric_preferences)
                : responseData.fabric_preferences;
          } catch (e) {
            console.error("Fabric preferences parsing error:", e);
            responseData.fabric_preferences = [];
          }
        }
        return sendResponse(
          res,
          "All steps are completed now",
          200,
          responseData,
        );
      default:
        throw CoustomError("Invalid step provided!", 400);
    }
  } catch (error) {
    if (req.file) {
      await fs.unlink(req.file.path);
    }
    console.log("baby-profile-update-step error", error);
    next(error);
  }
};

const homeData = async (req, res, next) => {
  try {
    const { id } = req.user;
    const homeAllData = await BabyProfile.findAll({
      where: {
        user_id: id,
      },
      attributes: ["id", "baby_profile_image"],
      raw: true,
    });

    const formattedBabyData = homeAllData.map((baby) => {
      return {
        ...baby,
        baby_profile_image: baby.baby_profile_image
          ? baby.baby_profile_image.startsWith("http")
            ? baby.baby_profile_image
            : `${process.env.BACKEND_URL}/baby-image/${baby.baby_profile_image}`
          : null,
      };
    });
    // const tryOnData=await
    const bannersData = await Banner.findAll({
      where: {
        is_active: 1,
      },
    });

    // const categoryShop = await Category.findAll();
    const categoryShop = await Category.findAll({
      where: {
        is_active: 1,
      },
      include: [
        {
          model: Product,
          as: "categories",
          attributes: ["product_images"],
          limit: 1,
          order: [["id", "ASC"]],
        },
      ],
    });
    const finalResponse = categoryShop.map((cat) => {
      const item = cat.toJSON();
      let firstImage = null;
      if (item.categories && item.categories.length > 0) {
        const productImages = item.categories[0].product_images;

        const imagesArray =
          typeof productImages === "string"
            ? JSON.parse(productImages)
            : productImages;

        firstImage =
          imagesArray && imagesArray.length > 0 ? imagesArray[0] : null;
      }
      return {
        id: item.id,
        name: item.name,
        category_image: firstImage,
        is_active: item.is_active,
        price_range: item.price_range,
        discount_percentage: item.discount_percentage,
        total_margin: item.total_margin,
        addon_percentage: item.addon_percentage,
        is_retailor_price_active: item.is_retailor_price_active,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    const allBanners = bannersData.map((banner) => {
      const bannerJson = banner.toJSON();
      if (bannerJson.banner_url) {
        bannerJson.banner_url = `${process.env.BACKEND_URL}/banners/${bannerJson.banner_url}`;
      }
      return bannerJson;
    });
    sendResponse(res, "data fetched", 200, {
      formattedBabyData,
      allBanners,
      categoryShop: finalResponse,
      tryOn: [],
    });
  } catch (error) {
    next(error);
  }
};

const allWishlistData = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { page, size } = req.query;

    const { limit, offset } = getPagination(page, size);
    const wishlistEntries = await Wishlist.findAndCountAll({
      where: {
        user_id: id,
        is_delete: 0,
      },
      limit,
      offset,
      attributes: ["product_id", "createdAt"],
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    if (wishlistEntries.rows.length === 0) {
      return sendResponse(
        res,
        "Wishlist is empty",
        200,
        getPagingData(wishlistEntries, page, limit),
      );
    }

    const productIds = wishlistEntries.rows.map((item) => item.product_id);
    const productsWithPrices = await Promise.all(
      productIds.map(async (pId) => {
        return await getCalculatedProducts({
          product_id: pId,
          user_id: id,
        });
      }),
    );

    // const securedProducts = productsWithPrices.map((product) => ({
    //   ...product,
    //   product_images: ensureHttps(product.product_images),
    // }));

    const formattedRows = wishlistEntries.rows.map((item, index) => {
      return {
        wishlist_added_at: item.createdAt,
        ...productsWithPrices[index],
      };
    });

    // const finalData = {
    //   count: wishlistEntries.count,
    //   rows: formattedRows,
    // };

    // const formattedResponse = getPagingData(finalData, page, limit);

    // console.log("formattedResponse", formattedResponse);
    sendResponse(
      res,
      "Wishlist fetched successfully with updated prices",
      200,
      { items: formattedRows },
    );
  } catch (error) {
    next(error);
  }
};

const addToWishlist = async (req, res, next) => {
  try {
    const { id } = req.user;
    const { product_id } = req.body;
    const product = await Product.findOne({
      where: {
        id: product_id,
      },
    });
    if (!product) throw new CoustomError("Product not found", 404);

    const isInWishlist = await Wishlist.findOne({
      where: {
        user_id: id,
        product_id: product_id,
      },
    });
    if (isInWishlist) {
      await isInWishlist.destroy();
    } else {
      await Wishlist.create({
        user_id: id,
        product_id: product_id,
      });
    }
    sendResponse(
      res,
      `${isInWishlist ? "Deleted from" : "Added to"} wishlist`,
      200,
    );
  } catch (error) {
    next(error);
  }
};

const deleteFromWishlist = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const isInWishlist = await Wishlist.findOne({
      where: {
        user_id: user_id,
        id: id,
      },
    });
    if (!isInWishlist)
      throw new CoustomError("There is no data in wishlist", 404);

    await isInWishlist.destroy();

    sendResponse(res, "The product is removed from wishlist", 200);
  } catch (error) {
    next(error);
  }
};

const babyCategoryData = async (req, res, next) => {
  try {
    // const categories = await Category.findAll({
    //   where: {
    //     is_active: 1,
    //   },
    // });

    const categoryShop = await Category.findAll({
      where: {
        is_active: 1,
      },
      include: [
        {
          model: Product,
          as: "categories",
          attributes: ["product_images"],
          limit: 1,
          order: [["id", "ASC"]],
        },
      ],
    });

    const finalResponse = categoryShop.map((cat) => {
      const item = cat.toJSON();
      let firstImage = null;
      if (item.categories && item.categories.length > 0) {
        const productImages = item.categories[0].product_images;
        const imagesArray =
          typeof productImages === "string"
            ? JSON.parse(productImages)
            : productImages;

        firstImage =
          imagesArray && imagesArray.length > 0 ? imagesArray[0] : null;
      }

      return {
        id: item.id,
        name: item.name,
        category_image: firstImage,
        is_active: item.is_active,
        price_range: item.price_range,
        discount_percentage: item.discount_percentage,
        total_margin: item.total_margin,
        addon_percentage: item.addon_percentage,
        is_retailor_price_active: item.is_retailor_price_active,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    if (!finalResponse) throw new CoustomError("Category not found", 404);
    sendResponse(res, "Baby category data fetched successfully", 200, {
      categories: finalResponse,
      count: finalResponse.length,
    });
  } catch (error) {
    next(error);
  }
};

// const productCategoryWiseData = async (req, res, next) => {
//   try {
//     const { category_id } = req.body;
//     const user_id = req.user.id;
//     // const category = await Category.findByPk(category_id);
//     const categoryData = await Category.findOne({
//       where: {
//         id: category_id,
//         is_active: 1,
//       },
//       include: [
//         {
//           model: Retailer,
//           as: "retailers",
//           attributes: ["addon_percentage", "discount","selected_categories"],
//           through: { attributes: [] },
//           where: {
//             is_active: 1,
//           },
//           required: false,
//         },
//       ],
//     });

//     if (!categoryData) {
//       throw new CoustomError("Category not found", 404);
//     }

//     const category = categoryData.get({ plain: true });

//     const firstRetailer =
//       category.retailers && category.retailers.length > 0
//         ? category.retailers[0]
//         : null;

//     console.log("category", category);

//     const categoryAddon = parseFloat(category.addon_percentage);
//     const retailerAddon = firstRetailer
//       ? parseFloat(firstRetailer.addon_percentage)
//       : 0;

//     const addonPct = categoryAddon > 0 ? categoryAddon : retailerAddon;
//     const categoryDiscount = parseFloat(category.discount_percentage);
//     const retailerDiscount = firstRetailer
//       ? parseFloat(firstRetailer.discount)
//       : 0;
//     const discountPct =
//       categoryDiscount > 0 ? categoryDiscount : retailerDiscount;

//     console.log(`Final Addon: ${addonPct}, Final Discount: ${discountPct}`);

//     const products = await Product.findAll({
//       where: {
//         category_id: category_id,
//         sale_price: {
//           [Op.gt]: 0,
//         },
//       },
//       include: [
//         {
//           model: Wishlist,
//           as: "wishlists",
//           where: { user_id: user_id },
//           required: false,
//         },
//       ],
//     });

//     const updatedProducts = products.map((product) => {
//       const p = product.toJSON();

//       let formattedImages = [];
//       try {
//         formattedImages =
//           typeof p.product_images === "string"
//             ? JSON.parse(p.product_images)
//             : p.product_images;
//       } catch (e) {
//         formattedImages = [];
//       }

//       const cost = parseFloat(p.sale_price) || 0;
//       let finalPrice;
//       if (addonPct == 0 && discountPct == 0) {
//         finalPrice = cost;
//       } else {
//         const markedPrice = cost + cost * (addonPct / 100);
//         finalPrice = markedPrice - markedPrice * (discountPct / 100);
//       }
//       if (finalPrice <= 0) {
//         finalPrice = parseFloat(p.sale_price) || 0;
//       }
//       const is_fav = p.wishlists && p.wishlists.length > 0 ? true : false;
//       delete p.wishlists;
//       delete p.product_url;
//       return {
//         ...p,
//         product_images: formattedImages,
//         sale_price: finalPrice.toFixed(2),
//         is_fav: is_fav,
//       };
//     });
//     sendResponse(
//       res,
//       "Products fetched and prices calculated successfully",
//       200,
//       {
//         category_name: category.category_name,
//         discount_applied: `${discountPct}%`,
//         count: updatedProducts.length,
//         products: updatedProducts,
//       },
//     );
//   } catch (error) {
//     next(error);
//   }
// };

// const fetchProductDetails = async (req, res, next) => {
//   try {
//     const { id } = req.body;
//     const productData = await Product.findOne({
//       where: {
//         id,
//         sale_price: {
//           [Op.gt]: 0,
//         },
//       },
//       include: [
//         {
//           model: Category,
//           as: "category",
//           attributes: ["id", "name", "addon_percentage", "discount_percentage"],
//         },
//       ],
//     });

//     if (!productData) {
//       throw new CoustomError("Product not found", 404);
//     }

//     const product = productData.toJSON();
//     const cost = parseFloat(product.sale_price) || 0;
//     const addonPct = parseFloat(product.category?.addon_percentage) || 0;
//     const discountPct = parseFloat(product.category?.discount_percentage) || 0;
//     const markedPrice = cost + cost * (addonPct / 100);
//     const finalSalePrice = markedPrice - markedPrice * (discountPct / 100);

//     delete product.category;
//     const responseData = {
//       ...product,
//       sale_price: finalSalePrice.toFixed(2),
//     };
//     sendResponse(res, "Product detail fetched successfully", 200, {
//       productDetails: responseData,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

const productCategoryWiseData = async (req, res, next) => {
  try {
    const { category_id } = req.body;
    const user_id = req.user.id;

    // const categoryData = await Category.findOne({
    //   where: { id: category_id, is_active: 1 },
    //   include: [
    //     {
    //       model: Retailer,
    //       as: "retailers",
    //       attributes: ["addon_percentage", "discount", "selected_categories"], // selected_categories fetch kiya
    //       through: { attributes: [] },
    //       where: { is_active: 1 },
    //       required: false,
    //     },
    //   ],
    // });

    // if (!categoryData) {
    //   throw new CoustomError("Category not found", 404);
    // }

    // const category = categoryData.get({ plain: true });

    // console.log("category", category);

    // const firstRetailer = category.retailers?.[0] || null;

    // let addonPct = parseFloat(category.addon_percentage) || 0;
    // let discountPct = parseFloat(category.discount_percentage) || 0;

    // if (firstRetailer) {
    //   const selectedCats = firstRetailer.selected_categories || [];

    //   const isEligibleForRetailerDiscount = selectedCats.includes(
    //     Number(category_id),
    //   );

    //   if (isEligibleForRetailerDiscount) {
    //     if (addonPct === 0)
    //       addonPct = parseFloat(firstRetailer.addon_percentage) || 0;
    //     if (discountPct === 0)
    //       discountPct = parseFloat(firstRetailer.discount) || 0;
    //     console.log("Retailer Discount Applied for this category");
    //   } else {
    //     console.log(
    //       "Retailer found but Category not in selected_categories. Using Category defaults.",
    //     );
    //   }
    // }

    // console.log(`Final Addon: ${addonPct}, Final Discount: ${discountPct}`);

    // const products = await Product.findAll({
    //   where: {
    //     category_id: category_id,
    //     sale_price: { [Op.gt]: 0 },
    //   },
    //   include: [
    //     {
    //       model: Wishlist,
    //       as: "wishlists",
    //       where: { user_id: user_id },
    //       required: false,
    //     },
    //   ],
    // });

    // const updatedProducts = products.map((product) => {
    //   const p = product.toJSON();

    //   let formattedImages = [];
    //   try {
    //     formattedImages =
    //       typeof p.product_images === "string"
    //         ? JSON.parse(p.product_images)
    //         : p.product_images;
    //   } catch (e) {
    //     formattedImages = [];
    //   }

    //   const cost = parseFloat(p.sale_price) || 0;
    //   let finalPrice = cost;

    //   if (addonPct > 0 || discountPct > 0) {
    //     const markedPrice = cost + cost * (addonPct / 100);
    //     finalPrice = markedPrice - markedPrice * (discountPct / 100);
    //   }

    //   if (finalPrice <= 0) finalPrice = cost;

    //   const is_fav = p.wishlists && p.wishlists.length > 0;
    //   delete p.wishlists;
    //   delete p.product_url;

    //   return {
    //     ...p,
    //     product_images: formattedImages,
    //     sale_price: finalPrice.toFixed(2),
    //     is_fav: is_fav,
    //   };
    // });

    // const products = await getCalculatedProductsWithSuffling({
    //   category_id,
    //   user_id: user_id,
    // });
    const products = await getCalculatedProducts({
      category_id,
      user_id: user_id,
    });

    const securedProducts = products.map((product) => ({
      ...product,
    }));

    sendResponse(res, "Products fetched successfully", 200, {
      count: products.length,
      products: securedProducts,
    });
  } catch (error) {
    next(error);
  }
};

const fetchProductDetails = async (req, res, next) => {
  try {
    const { id } = req.body;
    const user_id = req.user.id;
    const is_admin = req.user.is_admin;
    // const productData = await Product.findOne({
    //   where: {
    //     id,
    //     sale_price: { [Op.gt]: 0 },
    //   },
    //   include: [
    //     {
    //       model: Category,
    //       as: "category",
    //       attributes: ["id", "name", "addon_percentage", "discount_percentage"],
    //       where: {
    //         is_active: 1,
    //       },
    //       required: false,
    //       include: [
    //         {
    //           model: Retailer,
    //           as: "retailers",
    //           attributes: ["addon_percentage", "discount"],
    //           through: { attributes: [] },
    //           where: { is_active: 1 },
    //           required: false,
    //         },
    //       ],
    //     },
    //   ],
    // });
    // if (!productData) {
    //   throw new CoustomError("Product not found", 404);
    // }
    // const product = productData.toJSON();
    // const category = product.category;
    // const firstRetailer = category?.retailers?.[0] || {};
    // const cost = parseFloat(product.sale_price) || 0;

    // // --- Priority Logic for Addon ---
    // const catAddon = parseFloat(category?.addon_percentage) || 0;
    // const retAddon = parseFloat(firstRetailer.addon_percentage) || 0;
    // const addonPct = catAddon > 0 ? catAddon : retAddon;

    // const catDiscount = parseFloat(category?.discount_percentage) || 0;
    // const retDiscount = parseFloat(firstRetailer.discount) || 0;
    // const discountPct = catDiscount > 0 ? catDiscount : retDiscount;

    // const markedPrice = cost + cost * (addonPct / 100);
    // const finalSalePrice = markedPrice - markedPrice * (discountPct / 100);

    // delete product.category;

    // let formattedImages = [];
    // try {
    //   formattedImages =
    //     typeof productData.product_images === "string"
    //       ? JSON.parse(productData.product_images)
    //       : productData.product_images;
    // } catch (e) {
    //   formattedImages = [];
    // }

    // const responseData = {
    //   ...product,
    //   product_images: formattedImages,
    //   sale_price: finalSalePrice.toFixed(2),
    //   applied_discount: discountPct,
    // };
    const babyProfile = await BabyProfile.findAll({
      where: {
        user_id,
      },
    });
    const babies = await processBabyData(babyProfile);
    const productDetails = await getCalculatedProducts({
      product_id: id,
      user_id: user_id,
    });
    const babyInfo =
      is_admin == 1
        ? babies
        : babies.map((b) => ({ baby_profile_image: b.baby_profile_image }));

    console.log("babyInfo to be sent:", babyInfo);

    sendResponse(res, "Product detail fetched successfully", 200, {
      productDetails: productDetails,
      babies: babyInfo,
    });
  } catch (error) {
    next(error);
  }
};

const fetchBabyProfileData = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const isBabyProfile = await BabyProfile.findOne({
      where: {
        id,
        user_id,
      },
    });
    if (!isBabyProfile)
      throw new CoustomError("Your baby details not found", 404);

    if (isBabyProfile.baby_profile_image) {
      isBabyProfile.baby_profile_image = `${process.env.BACKEND_URL}/baby-image/${isBabyProfile.baby_profile_image}`;
    }

    sendResponse(res, "Baby detail fetched successfully", 200, isBabyProfile);
  } catch (error) {
    next(error);
  }
};

const deleteBabyProfile = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const isBabyProfile = await BabyProfile.findOne({
      where: {
        user_id,
        id,
      },
    });
    if (!isBabyProfile)
      throw new CoustomError("You don't have baby profile", 404);
    if (isBabyProfile.baby_profile_image) {
      const imagePath = path.join(
        __dirname,
        "../../BabyProfileImage",
        isBabyProfile.baby_profile_image,
      );
      await fs
        .unlink(imagePath)
        .catch(() => console.log("File not found, skipping unlink"));
    }
    await isBabyProfile.destroy();
    const remainingCount = await BabyProfile.count({
      where: { user_id },
    });
    if (remainingCount === 0) {
      await User.update(
        {
          is_profile_complete: 0,
          current_step: 1,
          is_new_user: 1,
        },
        { where: { id: user_id } },
      );
    }
    sendResponse(res, "Your baby profile deleted successfully", 200);
  } catch (error) {
    next(error);
  }
};

const deleteMyProfile = async (req, res, next) => {
  try {
    const { id } = req.user;
    const user = await User.findOne({
      where: {
        id,
        is_delete: 0,
      },
    });
    if (!user) throw new CoustomError("User not found", 404);
    await user.update({
      is_delete: 1,
    });

    const babyProfiles = await BabyProfile.findAll({
      where: { user_id: id },
    });

    if (babyProfiles.length > 0) {
      for (const profile of babyProfiles) {
        if (profile.baby_profile_image) {
          const imagePath = path.join(
            __dirname,
            "../../BabyProfiles",
            profile.baby_profile_image,
          );

          await fs
            .access(imagePath)
            .then(() => fs.unlink(imagePath))
            .catch((err) =>
              console.log(
                `Image not found for profile ${profile.id}, skipping...`,
              ),
            );
        }
      }
      const deletedCount = await BabyProfile.destroy({
        where: { user_id: id },
      });
      console.log(`${deletedCount} baby profiles and their images deleted.`);
    }
    sendResponse(res, "Your profile has been deleted successfully", 200);
  } catch (error) {
    next(error);
  }
};

const addNewUserAddress = async (req, res, next) => {
  try {
    const { id } = req.user;
    const {
      address_type,
      street_address,
      city,
      state,
      lat,
      long,
      apartment,
      post_code,
      country_id,
      state_id,
    } = req.body;

    const isAnyAddress = await Address.findAll({
      where: {
        user_id: id,
      },
    });
    let is_default = 0;
    if (isAnyAddress.length === 0) {
      is_default = 1;
    } else {
      is_default = 0;
    }

    await Address.create({
      user_id: id,
      address_type,
      street_address,
      city,
      state,
      post_code,
      lat,
      long,
      apartment,
      is_default,
      country_id,
      state_id,
    });

    sendResponse(res, "Address added successfully", 200);
  } catch (error) {
    next(error);
  }
};

const allSavedAddress = async (req, res, next) => {
  try {
    const { id } = req.user;
    const allAddress = await Address.findAll({
      where: {
        user_id: id,
      },
    });

    sendResponse(res, "Address list here", 200, { address: allAddress });
  } catch (error) {
    next(error);
  }
};

const updateUserAddress = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    console.log("reqBody", req.body);
    const {
      id,
      address_type,
      street_address,
      city,
      state,
      post_code,
      lat,
      long,
      apartment,
      state_id,
      country_id,
    } = req.body;

    const isAddress = await Address.findOne({
      where: {
        id,
        user_id,
      },
    });

    if (!isAddress) throw new CoustomError("No Address found", 404);

    await isAddress.update({
      address_type: address_type ? address_type : isAddress.address_type,
      street_address: street_address
        ? street_address
        : isAddress.street_address,
      city: city ? city : isAddress.city,
      state: state ? state : isAddress.state,
      post_code: post_code ? post_code : isAddress.post_code,
      lat: lat ? lat : isAddress.lat,
      long: long ? long : isAddress.long,
      apartment: apartment ? apartment : isAddress.apartment,
      state_id: state_id ? state_id : isAddress.state_id,
      country_id: country_id ? country_id : isAddress.country_id,
    });

    sendResponse(res, "Your address has been updated", 200, isAddress);
  } catch (error) {
    next(error);
  }
};

const addressDetails = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const isAddress = await Address.findOne({
      where: {
        id,
        user_id,
      },
    });
    if (!isAddress) throw new CoustomError("No address found", 404);
    sendResponse(res, "Geting address details", 200, isAddress);
  } catch (error) {
    next(error);
  }
};

const deleteAddress = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const addressToDelete = await Address.findOne({
      where: { id, user_id },
    });
    console.log("addressToDelete", addressToDelete);
    if (!addressToDelete) {
      throw new CoustomError("Address not found", 404);
    }
    const wasDefault = addressToDelete.is_default === 1;
    await addressToDelete.destroy();
    if (wasDefault) {
      const nextAddress = await Address.findOne({
        where: { user_id },
        order: [["createdAt", "DESC"]],
      });

      if (nextAddress) {
        await nextAddress.update({ is_default: 1 });
      }
    }

    sendResponse(res, "Your address has beed deleted", 200, addressToDelete);
  } catch (error) {
    next(error);
  }
};

const setAsIsDefault = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    await Address.update(
      { is_default: 0 },
      {
        where: { user_id: user_id },
      },
    );

    const updatedAddress = await Address.update(
      { is_default: 1 },
      {
        where: {
          id: id,
          user_id: user_id,
        },
      },
    );

    if (updatedAddress[0] === 0) {
      throw new CoustomError("Address not found", 404);
    }

    sendResponse(res, "Address set as default successfully!", 200);
  } catch (error) {
    next(error);
  }
};

const addToCart = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id, quantity } = req.body;
    const productData = await Product.findOne({
      where: {
        id,
      },
    });
    if (!productData) throw new CoustomError("Product not found", 404);

    const existingCartItem = await Cart.findOne({
      where: { user_id, product_id: id },
    });

    const productDetails = await getCalculatedProducts({
      product_id: id,
      user_id: user_id,
    });

    if (existingCartItem) {
      const updatedQuantity = existingCartItem.quantity + quantity;
      if (updatedQuantity > 10) {
        throw new CoustomError(
          "You cannot add more than 10 units of this product",
          400,
        );
      }
      if (updatedQuantity <= 0) {
        await existingCartItem.destroy();
        return sendResponse(res, "Product removed from cart successfully", 200);
      }

      existingCartItem.quantity = updatedQuantity;
      existingCartItem.total_price =
        updatedQuantity * productDetails.sale_price;

      await existingCartItem.save();

      const plainCartItem = existingCartItem.get({ plain: true });
      let resData = {
        ...plainCartItem,
        total_price: parseFloat(plainCartItem.total_price).toFixed(2),
      };

      return sendResponse(
        res,
        "Your product has been updated in the cart successfully",
        200,
        resData,
      );
    } else {
      if (quantity <= 0) {
        throw new CoustomError("Invalid quantity for new item", 400);
      }
      if (quantity > 10) {
        throw new CoustomError(
          "You cannot add more than 10 units of this product",
          400,
        );
      }
      const newCartItem = await Cart.create({
        user_id,
        product_id: id,
        retailer_id: productDetails.retailer_id || null,
        quantity,
        total_price: quantity * productDetails.sale_price,
      });

      const plainCartItem = newCartItem.get({ plain: true });
      let resData = {
        ...plainCartItem,
        total_price: parseFloat(plainCartItem.total_price).toFixed(2),
      };

      return sendResponse(
        res,
        "Product added to cart successfully",
        200,
        resData,
      );
    }
  } catch (error) {
    next(error);
  }
};

const updatedQuantityInCart = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id, quantity } = req.body;

    if (quantity < 1 || quantity > 10) {
      throw new CoustomError("Quantity must be between 1 and 10", 400);
    }

    const cartItem = await Cart.findOne({
      where: { user_id, id },
    });
    if (!cartItem) throw new CoustomError("Cart item not found", 404);

    const productDetails = await getCalculatedProducts({
      product_id: cartItem.product_id,
      user_id: user_id,
    });

    if (!productDetails)
      throw new CoustomError("Product details not found", 404);

    cartItem.quantity = quantity;
    const salePrice = parseFloat(productDetails.sale_price) || 0;
    const actualPrice = parseFloat(productDetails.actual_price) || 0;
    cartItem.total_price = (quantity * salePrice).toFixed(2);
    cartItem.actual_total_price = (quantity * actualPrice).toFixed(2);
    await cartItem.save();
    const plainCartItem = cartItem.get({ plain: true });

    return sendResponse(res, "Cart item quantity updated successfully", 200, {
      ...plainCartItem,
      max_quantity: 10,
    });
  } catch (error) {
    next(error);
  }
};

const removeFromCart = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const cartItem = await Cart.findOne({
      where: { user_id, id },
    });
    if (!cartItem) throw new CoustomError("Cart item not found", 404);
    await cartItem.destroy();
    return sendResponse(res, "Product removed from cart successfully", 200);
  } catch (error) {
    next(error);
  }
};

// const fetchAllCartItems = async (req, res, next) => {
//   try {
//     const { id } = req.user;
//     const cartItems = await Cart.findAll({
//       where: { user_id: id },
//     });
//     const productsFilePath = path.join(__dirname, "../../../productsData.json");
//     const productsRaw = await fs.readFile(productsFilePath, "utf-8");
//     const productsList = JSON.parse(productsRaw);
//     const cartItemsWithDetails = cartItems.map((item) => {
//       const productDetail = productsList.find(
//         (p) => p.product_id == item.product_id,
//       );
//       return {
//         ...item.toJSON(),
//         product: productDetail || null,
//         max_quantity: 10,
//       };
//     });
//     sendResponse(res, "Cart items fetched successfully", 200, {
//       cart_item: cartItemsWithDetails,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

const fetchAllCartItems = async (req, res, next) => {
  try {
    const { id: user_id } = req.user;

    const [cartItems, savedAddress] = await Promise.all([
      Cart.findAll({
        where: { user_id },
        attributes: {
          exclude: ["createdAt", "updatedAt", "user_id", "category_name"],
        },
        raw: true,
      }),
      Address.findOne({
        where: { user_id, is_default: 1 },
      }),
    ]);

    if (!cartItems || cartItems.length === 0) {
      return sendResponse(res, "Cart is empty", 200, {
        saved_address: savedAddress,
        cart_item: [],
        related_outfits: [],
      });
    }
    const productIds = cartItems.map((item) => item.product_id);
    const productDetailsList = await getCalculatedProducts({
      user_id,
      product_id: productIds,
    });

    const detailsArray = Array.isArray(productDetailsList)
      ? productDetailsList
      : [productDetailsList];
    const productMap = new Map(detailsArray.map((p) => [p.id.toString(), p]));

    const categoryIds = [
      ...new Set(detailsArray.map((p) => p.category_id).filter((id) => id)),
    ];

    let relatedOutfits = [];

    if (categoryIds.length > 0) {
      const rawRelated = await getCalculatedProducts({
        user_id,
        category_id: categoryIds,
        limit: 10,
      });

      relatedOutfits = (
        Array.isArray(rawRelated) ? rawRelated : [rawRelated]
      ).filter((p) => !productIds.includes(p.id));
    }

    const cartItemsWithDetails = cartItems.map((item) => {
      const details = productMap.get(item.product_id.toString()) || null;
      const finalSalePrice = details ? parseFloat(details.sale_price) || 0 : 0;
      const finalActualPrice = details
        ? parseFloat(details.actual_price) || 0
        : 0;
      const qty = item.quantity || 0;

      return {
        ...item,
        actual_total_price: (qty * finalActualPrice).toFixed(2),
        total_price: (qty * finalSalePrice).toFixed(2),
        product: details,
        max_quantity: 10,
      };
    });

    sendResponse(res, "Cart items fetched successfully", 200, {
      saved_address: savedAddress,
      cart_item: cartItemsWithDetails,
      related_outfits: relatedOutfits,
    });
  } catch (error) {
    console.error("Error in fetchAllCartItems:", error);
    next(error);
  }
};

const fetchAllOrderedItems = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const orders = await Order.findAll({
      // where: { user_id: user_id, order_status: "Placed", is_returned: 0 },
      where: { user_id: user_id, order_status: "Placed" },
      limit: 10,
      order: [["order_date", "DESC"]],
      exclude: ["createdAt", "updatedAt", "user_id", "order_date"],
      raw: true,
    });
    console.log("orders", orders);
    let allProductIds = [];
    let categories = [];
    orders.forEach((order) => {
      const items =
        typeof order.items === "string" ? JSON.parse(order.items) : order.items;
      items.forEach((item) => {
        allProductIds.push(item.product_id);
      });
    });
    const uniqueProductIds = [...new Set(allProductIds)];
    const productsDetails = await Product.findAll({
      where: {
        id: uniqueProductIds,
      },
    });

    productsDetails.forEach((p) => {
      if (p.category_id) categories.push(p.category_id);
    });
    const uniqueCategories = [...new Set(categories)];

    const suggestedOutfits = await Product.findAll({
      where: {
        category_id: uniqueCategories,
        id: { [Op.notIn]: uniqueProductIds },
      },
      limit: 15,
    });

    const formattedSuggestions = await Promise.all(
      suggestedOutfits.map(async (p) => {
        const finalPriceDetails = await getCalculatedProducts({
          user_id,
          product_id: p.id,
        });

        return finalPriceDetails;
      }),
    );

    console.log("formattedSuggestions", formattedSuggestions.length);

    const formattedResponse = orders.map((order) => {
      const items =
        typeof order.items === "string" ? JSON.parse(order.items) : order.items;

      const detail = productsDetails.find((p) => p.id === items[0].product_id);
      let formattedImages = [];
      try {
        formattedImages =
          typeof detail.product_images === "string"
            ? JSON.parse(detail.product_images || "[]")
            : detail.product_images || [];
      } catch (e) {
        formattedImages = [];
      }

      return {
        order_id: order.id,
        total_amount: `${order.total_amount}`,
        products_name: items[0].product_name,
        product_images: formattedImages,
        product_id: items[0].product_id,
      };
    });
    sendResponse(res, "Ordered items fetched successfully", 200, {
      orders: formattedResponse,
      suggestedOutfits: formattedSuggestions,
    });
  } catch (error) {
    next(error);
  }
};

const allFilterData = async (req, res, next) => {
  try {
    // const [brands, colorsData, genders, sizes, febrics] = await Promise.all([
    const [colorsData, genders, sizes, febrics] = await Promise.all([
      // Brand.findAll({ attributes: { exclude: ["createdAt", "updatedAt"] } }),
      Color.findAll({ attributes: { exclude: ["createdAt", "updatedAt"] } }),
      Gender.findAll({ attributes: { exclude: ["createdAt", "updatedAt"] } }),
      Size.findAll({ attributes: { exclude: ["createdAt", "updatedAt"] } }),
      Fabric.findAll({ attributes: { exclude: ["createdAt", "updatedAt"] } }),
    ]);

    let uniqueColors = new Set();
    let finalColors = [];

    colorsData.forEach((item) => {
      const splitNames = item.name.includes("/")
        ? item.name.split("/")
        : [item.name];

      splitNames.forEach((name) => {
        const trimmedName = name.trim();
        if (
          !uniqueColors.has(trimmedName.toLowerCase()) &&
          isNaN(trimmedName)
        ) {
          uniqueColors.add(trimmedName.toLowerCase());
          finalColors.push({
            id: item.id,
            name: trimmedName,
          });
        }
      });
    });

    const priceOptions = [
      { id: 1, label: "$0 - $99", min_price: 0, max_price: 99 },
      { id: 2, label: "$100 - $199", min_price: 100, max_price: 199 },
      { id: 3, label: "$200 - $299", min_price: 200, max_price: 299 },
      { id: 4, label: "$300 and above", min_price: 300, max_price: null },
    ];
    const filters = [
      {
        filter_key: "price",
        filter_name: "Price",
        options: priceOptions,
      },
      // {
      //   filter_key: "brand",
      //   filter_name: "Brand",
      //   options: brands,
      // },
      {
        filter_key: "gender",
        filter_name: "Gender",
        options: genders,
      },
      {
        filter_key: "color",
        filter_name: "Color",
        options: finalColors,
      },
      {
        filter_key: "size",
        filter_name: "Size",
        options: sizes,
      },
      {
        filter_key: "fabric",
        filter_name: "Fabric",
        options: febrics,
      },
    ];
    sendResponse(res, "Filters fetched successfully", 200, { filters });
  } catch (error) {
    console.error("Filter Fetch Error:", error);
    next(error);
  }
};

const applayFilters = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    // const { price, brand, gender, color, size, fabric, category_id } = req.body;
    const { price, gender, color, size, fabric, category_id } = req.body;
    let productWhere = { sale_price: { [Op.gt]: 0 } };
    if (category_id) productWhere.category_id = category_id;
    // if (brand?.length) productWhere.brand_id = { [Op.in]: brand };
    if (gender?.length) productWhere.gender_id = { [Op.in]: gender };
    if (color?.length) productWhere.color_id = { [Op.in]: color };
    if (size?.length) productWhere.size_id = { [Op.in]: size };

    let products = await getCalculatedProducts({
      category_id,
      user_id,
      productWhereData: productWhere,
    });

    if (price) {
      const min = parseFloat(price.min_price) || 0;
      const max =
        price.max_price !== null ? parseFloat(price.max_price) : Infinity;

      let filteredResults = [];
      for (let i = 0; i < products.length; i++) {
        const sPrice = parseFloat(products[i].sale_price);
        if (sPrice >= min && sPrice <= max) {
          filteredResults.push(products[i]);
        }
      }
      products = filteredResults;
    }

    return sendResponse(res, "Filters applied successfully", 200, {
      count: products.length,
      products,
    });
  } catch (error) {
    next(error);
  }
};

const selectBabyProfile = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const babyProfile = await BabyProfile.findOne({
      where: {
        id: id,
        user_id,
      },
    });
    if (!babyProfile) {
      throw new CoustomError("Baby profile not found", 404);
    }

    const useExist = await User.findOne({
      where: {
        id: user_id,
        is_delete: 0,
      },
    });
    if (useExist) {
      await useExist.update({
        selected_baby: id,
      });
    }

    sendResponse(res, "Baby profile selected successfully", 200, {
      babyProfile,
    });
  } catch (error) {
    next(error);
  }
};

const helpAndSupport = async (req, res, next) => {
  try {
    const { name, phone, country_code, email, message, subject } = req.body;

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.SUPPORT_EMAIL,
      subject: `[URGENT SUPPORT] - ${subject}`,
      html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
            .card { background: #fff; border-radius: 10px; padding: 20px; border-top: 5px solid #00cccc; }
            .header { color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .info-table { width: 100%; margin-top: 20px; border-collapse: collapse; }
            .info-table td { padding: 10px; border-bottom: 1px solid #f9f9f9; }
            .label { font-weight: bold; color: #666; width: 150px; }
            .msg-box { background: #fff5f5; padding: 15px; border-radius: 5px; margin-top: 15px; border: 1px solid #ffebeb; }
            .footer { margin-top: 20px; font-size: 12px; color: #999; text-align: center; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <h2>New Support Ticket: Baby AI</h2>
                <p>A user is facing an issue and needs assistance.</p>
            </div>
            
            <table class="info-table">
                <tr>
                    <td class="label">User Name:</td>
                    <td>${name}</td>
                </tr>
                <tr>
                    <td class="label">User Email:</td>
                    <td>${email}</td>
                </tr>
                <tr>
                    <td class="label">Phone Number:</td>
                    <td>${country_code} ${phone}</td>
                </tr>
                <tr>
                    <td class="label">Issue Subject:</td>
                    <td><strong>${subject}</strong></td>
                </tr>
            </table>

            <div class="label" style="margin-top:20px;">User Message:</div>
            <div class="msg-box">
                ${message || "No specific message provided."}
            </div>

            <p style="margin-top:25px; color: #ff4d4d;"><strong>Action:</strong> Please reach out to the user via email or phone to resolve this query.</p>
        </div>
        <div class="footer">
            Admin Dashboard | Baby AI System Alert
        </div>
    </body>
    </html>
  `,
    };

    await sendOtpOnEmail(mailOptions);
    sendResponse(res, "Your query has been submitted successfully", 200);
  } catch (error) {
    next(error);
  }
};

const staticPageDetails = async (req, res, next) => {
  try {
    const { id } = req.body;
    const staticPage = await StaticPage.findOne({
      where: {
        id,
        is_active: 1,
      },
      attributes: ["id", "title", "content"],
    });
    console.log("id", id);
    if (!staticPage) {
      throw new CoustomError("Page not found", 404);
    }
    sendResponse(res, "Page details fetched successfully", 200, {
      staticPage,
    });
  } catch (error) {
    next(error);
  }
};

const placeOrder = async (req, res, next) => {
  try {
    const { id, shipping_address, payment_method } = req.body;
    const userId = req.user.id;

    const cartItems = await Cart.findAll({
      where: { id: id, user_id: userId },
      include: ["product"],
    });

    if (cartItems.length === 0) throw new CoustomError("Cart is empty", 404);

    const productDetailsList = await getCalculatedProducts({
      user_id: userId,
      product_id: cartItems.map((item) => item.product_id),
    });

    const itemsList = cartItems.map((item) => {
      const calculatedData = productDetailsList.find(
        (p) => p.id === item.product_id,
      );
      return {
        product_id: item.product_id,
        product_name: item.product.name,
        quantity: item.quantity,
        price: calculatedData
          ? calculatedData.sale_price
          : item.product.sale_price,
        subtotal:
          (calculatedData
            ? calculatedData.sale_price
            : item.product.sale_price) * item.quantity,
      };
    });

    const totalOrderAmount = itemsList.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );

    const totalOrderQty = itemsList.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    const newOrder = await Order.create({
      user_id: userId,
      order_id: `ORD-${Date.now()}`,
      items: itemsList,
      total_amount: totalOrderAmount,
      quantity: totalOrderQty,
      shipping_address: shipping_address,
      payment_method: payment_method,
      order_status: "Placed",
    });

    await Cart.destroy({ where: { id: id, user_id: userId } });
    return sendResponse(res, "Order Placed Successfully", 201, {
      newOrder,
    });
  } catch (error) {
    next(error);
  }
};

const createPaymentIntent = async (req, res, next) => {
  try {
    const { id, shipping_address } = req.body;
    const userId = req.user.id;

    const cartItems = await Cart.findAll({
      where: { id: id, user_id: userId },
      include: ["product"],
    });

    if (cartItems.length === 0) throw new CoustomError("Cart is empty", 404);

    const productDetailsList = await getCalculatedProducts({
      user_id: userId,
      product_id: cartItems.map((item) => item.product_id),
    });

    const itemsList = cartItems.map((item) => {
      const calculatedData = productDetailsList.find(
        (p) => p.id === item.product_id,
      );
      return {
        product_id: item.product_id,
        product_name: item.product.name,
        quantity: item.quantity,
        price: calculatedData
          ? calculatedData.sale_price
          : item.product.sale_price,
        subtotal:
          (calculatedData
            ? calculatedData.sale_price
            : item.product.sale_price) * item.quantity,
      };
    });

    const totalOrderAmount = itemsList.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );
    console.log("Total Order Amount:", Math.round(totalOrderAmount));
    const amountInPaise = Math.round(totalOrderAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPaise,
      currency: "inr",
      description: `Payment for Order by User ${userId}`,
      metadata: {
        cart_id: JSON.stringify(id),
        shipping_address: JSON.stringify(shipping_address),
        customer_name: req.user?.name || "Guest",
      },
      automatic_payment_methods: { enabled: true },
    });

    res.status(200).send({
      clientSecret: paymentIntent.client_secret,
      amount: amountInPaise,
    });
  } catch (error) {
    next(error);
  }
};

const createCheckoutSession = async (req, res, next) => {
  try {
    const { id, shipping_address_id } = req.body;
    const userId = req.user.id;

    const cartItems = await Cart.findAll({
      where: { id: id, user_id: userId },
      include: ["product"],
    });
    // console.log("cartItems", cartItems);
    if (cartItems.length === 0) throw new Error("Cart is empty");

    const productDetailsList = await getCalculatedProducts({
      user_id: userId,
      product_id: cartItems.map((item) => item.product_id),
    });

    const itemsList = cartItems.map((item) => {
      const calculatedData = productDetailsList.find(
        (p) => p.id === item.product_id,
      );
      const finalPrice = calculatedData
        ? calculatedData.sale_price
        : item.product.sale_price;

      return {
        product_id: item.product_id,
        product_name: item.product.product_name,
        quantity: item.quantity,
        price: finalPrice,
        subtotal: finalPrice * item.quantity,
      };
    });

    const totalOrderQty = itemsList.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const totalAmount = itemsList.reduce((sum, item) => sum + item.subtotal, 0);

    const addressData = await Address.findOne({
      where: {
        id: shipping_address_id,
        is_delete: 0,
      },
      raw: true,
    });

    const fullAddressText = formatFullAddress(addressData);

    const newOrder = await Order.create({
      user_id: userId,
      order_id: `ORD-${Date.now()}`,
      items: itemsList,
      quantity: totalOrderQty,
      total_amount: totalAmount,
      shipping_address: fullAddressText,
      order_status: "Pending",
      order_date: new Date(),
      shippingAddress_id: addressData.id,
    });

    // console.log("itemsList", itemsList);
    const line_items = itemsList.map((item) => {
      return {
        price_data: {
          currency: "USD",
          product_data: {
            name: item.product_name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      line_items: line_items,
      mode: "payment",
      invoice_creation: { enabled: true },
      success_url: `https://mern.yilstaging.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://mern.yilstaging.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        order_id: newOrder.id,
        cart_id: JSON.stringify(id),
        user_id: userId,
        shipping_address: JSON.stringify(fullAddressText),
      },
    });

    sendResponse(res, "Checkout session created successfully", 200, {
      url: session.url,
    });
  } catch (error) {
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) throw new CoustomError("Session ID is required", 400);

    const existingTx = await Transaction.findOne({
      where: { stripe_session_id: sessionId },
    });
    if (existingTx)
      throw new CoustomError(
        "This transaction has already been processed.",
        400,
      );

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["invoice"],
      });
    } catch (err) {
      throw new CoustomError("Invalid Session ID", 400);
    }

    const orderId = session.metadata.order_id;
    const userId = session.metadata.user_id;
    // const cartIds = JSON.parse(session.metadata.cart_id);
    const metadata = session.metadata;

    let cartIds = null;
    let isReorder = metadata.is_reorder === "true";

    if (isReorder) {
      const oldOrderId = metadata.order_id;
      console.log("Processing Reorder for Order ID:", oldOrderId);
      cartIds = [];
    } else {
      try {
        cartIds = metadata.cart_id ? JSON.parse(metadata.cart_id) : [];
      } catch (e) {
        cartIds = [];
      }
    }

    const order = await Order.findByPk(orderId);
    if (!order) throw new CoustomError("Order not found", 404);

    const invoiceUrl = session.invoice
      ? session.invoice.hosted_invoice_url
      : null;
    const invoiceId =
      session.invoice?.id ||
      (typeof session.invoice === "string" ? session.invoice : null);

    if (session.payment_status === "paid") {
      await order.update({
        order_status: "Placed",
        payment_method: session.payment_method_types[0],
      });

      await Transaction.create({
        user_id: userId,
        order_id: order.id,
        stripe_session_id: sessionId,
        payment_intent_id: session.payment_intent,
        transaction_id: session.payment_intent,
        amount: session.amount_total / 100,
        status: session.payment_status,
        invoice_id: invoiceId,
        invoice_url: invoiceUrl,
        payment_method: session.payment_method_types[0],
      });

      const userData = await User.findByPk(userId);
      if (userData) await userData.increment("orders", { by: 1 });

      if (!isReorder && cartIds.length > 0) {
        await Cart.destroy({ where: { id: cartIds, user_id: userId } });
      }

      try {
        const bambiniResponse = await createOrder(orderId, userData);

        if (bambiniResponse.status) {
          await order.update({
            retailer_order_id: bambiniResponse.order_id,
            retailer_status: "Success",
          });
          console.log("Bambini Order Placed:", bambiniResponse.order_id);
        } else {
          await order.update({
            retailer_status: "Failed",
            retailer_error_log: JSON.stringify(
              bambiniResponse.errors || bambiniResponse.message,
            ),
          });

          console.error(
            "Bambini Rejected Order but Payment is Done:",
            bambiniResponse.errors,
          );
        }
      } catch (bambiniErr) {
        await order.update({
          retailer_status: "Failed",
          retailer_error_log: bambiniErr.message,
        });
        console.error("Bambini API Error:", bambiniErr);
      }

      return sendResponse(res, "Order placed successfully", 200, {
        orderId: order.order_id,
      });
    } else {
      await order.update({ order_status: "Failed" });

      await Transaction.create({
        user_id: userId,
        order_id: order.id,
        stripe_session_id: sessionId,
        payment_intent_id: session.payment_intent,
        transaction_id: session.payment_intent,
        amount: session.amount_total / 100,
        // status: session.payment_status,
        status: "failed",
        invoice_url: null,
        invoice_id: invoiceId,
        payment_method: session.payment_method_types[0] || "n/a",
      });

      return res.status(200).json({
        success: false,
        message:
          "Payment was not successful. Your order has been marked as failed.",
        orderId: order.order_id,
      });
    }
  } catch (error) {
    console.error("Verification Error:", error);
    next(error);
  }
};

const generateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload an image file." });
    }

    const width = 250;
    const radius = width / 2;

    const circleMask = Buffer.from(
      `<svg width="${width}" height="${width}">
        <circle cx="${radius}" cy="${radius}" r="${radius}" fill="black" />
      </svg>`,
    );
    console.log("circleMask", circleMask);
    const processedImageBuffer = await sharp(req.file.buffer)
      .resize(width, width, {
        fit: "cover",
        position: "center",
      })
      .composite([
        {
          input: circleMask,
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();
    console.log("processedImageBuffer", processedImageBuffer);
    const base64Avatar = processedImageBuffer.toString("base64");
    const imageData = `data:image/png;base64,${base64Avatar}`;
    res.status(200).json({
      success: true,
      message: "Avatar generated successfully",
      avatar: imageData,
    });
  } catch (error) {
    console.error("Avatar Generation Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process image. Make sure the file is a valid image.",
    });
    next(error);
  }
};

// const buyAgain = async (req, res, next) => {
//   try {
//     const user_id = req.user.id;
//     const id = req.body.id;
//     const type = req.body.type;

//     let orderData;
//     if (type == "order") {
//       orderData = await Order.findOne({
//         where: {
//           id: id,
//           user_id: user_id,
//           order_status: "Placed",
//         },
//         include: [
//           {
//             model: Address,
//             as: "order_address",
//             attributes: { exclude: ["createdAt", "updatedAt"] },
//           },
//         ],
//       });
//     }

//     if (!orderData) {
//       throw new CoustomError("Order not found or cannot be reordered", 404);
//     }

//     const address = await Address.findOne({
//       where: {
//         is_default: 1,
//       },
//     });

//     const fullAddressText = formatFullAddress(
//       orderData.order_address || address,
//     );
//     const items =
//       (orderData ?? typeof orderData.items === "string")
//         ? JSON.parse(orderData.items)
//         : orderData.items;

//     const productIds = items.map((item) => item.product_id) || id;
//     const products = await Product.findAll({
//       where: {
//         id: productIds,
//       },
//     });
//     // console.log("products", products);
//     const formattedProducts = await Promise.all(
//       products.map(async (p) => {
//         const priceDetails = await getCalculatedProducts({
//           user_id,
//           product_id: p.id,
//         });
//         return priceDetails;
//       }),
//     );
//     const formatedOderData = {
//       ...orderData.toJSON(),
//       items: undefined,
//       order_id: undefined,
//       total_amount: `${orderData.total_amount}`,
//       payment_method: undefined,
//       return_reason: undefined,
//       createdAt: undefined,
//       updatedAt: undefined,
//       user_id: undefined,
//       shipping_tax: "0.00",
//       estimated_tax: "0.00",
//       shipping_address: fullAddressText,
//       order_address: undefined,
//     };
//     sendResponse(res, "Products fetched successfully", 200, {
//       orders: formatedOderData,
//       products: formattedProducts,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

const buyAgain = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id, type } = req.body;

    let productIds = [];
    let baseOrderData = null;

    if (type === "order") {
      const orderData = await Order.findOne({
        where: { id: id, user_id: user_id },
        include: [
          {
            model: Address,
            as: "order_address",
            attributes: { exclude: ["createdAt", "updatedAt"] },
          },
        ],
      });

      if (!orderData) throw new CoustomError("Order not found", 404);

      const items =
        typeof orderData.items === "string"
          ? JSON.parse(orderData.items)
          : orderData.items;
      productIds = items.map((item) => item.product_id);
      baseOrderData = orderData;
    } else if (type === "product") {
      productIds = [id];
    } else {
      throw new CoustomError("Invalid type provided", 400);
    }
    if (productIds.length === 0)
      throw new CoustomError("No products found to buy", 400);

    const products = await Product.findAll({ where: { id: productIds } });

    const formattedProducts = await Promise.all(
      products.map((p) => getCalculatedProducts({ user_id, product_id: p.id })),
    );
    console.log("formattedProducts", formattedProducts);
    const defaultAddress = await Address.findOne({
      where: { user_id, is_default: 1 },
    });
    const addressToUse =
      type === "order" && baseOrderData?.order_address
        ? baseOrderData.order_address
        : defaultAddress;
    const fullAddressText = addressToUse
      ? formatFullAddress(addressToUse)
      : "Address not found";

    const formattedOrderData = baseOrderData
      ? {
          ...baseOrderData.toJSON(),
          items: undefined,
          order_id: undefined,
          total_amount: `${baseOrderData.total_amount}`,
          payment_method: undefined,
          shipping_address: fullAddressText,
          order_address: undefined,
          shipping_address_id:
            baseOrderData?.order_address.id || defaultAddress.id,
        }
      : {
          shipping_address: fullAddressText,
          total_amount: `${formattedProducts[0].sale_price}`,
          shipping_address_id:
            baseOrderData?.order_address.id || defaultAddress.id,
        };

    sendResponse(res, "Data fetched successfully", 200, {
      orders: formattedOrderData,
      products: formattedProducts,
    });
  } catch (error) {
    next(error);
  }
};

// const createReorderCheckoutSession = async (req, res, next) => {
//   try {
//     const { id, shipping_address_id, products } = req.body;
//     const userId = req.user.id;

//     const oldOrder = await Order.findOne({
//       where: { id: id, user_id: userId },
//       include: [
//         {
//           model: Address,
//           as: "order_address",
//           attributes: { exclude: ["createdAt", "updatedAt"] },
//         },
//       ],
//     });

//     if (!oldOrder) {
//       throw new CoustomError("Original order not found", 404);
//     }

//     const itemsToProcess =
//       products && products.length > 0
//         ? products
//         : typeof oldOrder.items === "string"
//           ? JSON.parse(oldOrder.items)
//           : oldOrder.items;

//     const productIds = itemsToProcess.map((item) => item.id || item.product_id);

//     const productDetailsList = await getCalculatedProducts({
//       user_id: userId,
//       product_id: productIds,
//     });

//     const itemsList = itemsToProcess.map((item) => {
//       const pId = item.id || item.product_id;
//       const latestData = productDetailsList.find((p) => p.id === pId);

//       if (!latestData) {
//         throw new CoustomError(
//           `Product with ID ${pId} is no longer available`,
//           400,
//         );
//       }

//       return {
//         product_id: pId,
//         product_name: latestData.product_name,
//         quantity: item.quantity,
//         price: latestData.sale_price,
//         subtotal: latestData.sale_price * item.quantity,
//       };
//     });

//     let fullAddressText = null;
//     if (shipping_address_id) {
//       const addressData = await Address.findOne({
//         where: {
//           user_id: userId,
//           id: shipping_address_id,
//         },
//       });
//       if (addressData) {
//         const addr = addressData;
//         fullAddressText = `${addr.street_address}, ${addr.apartment ? addr.apartment + ", " : ""}${addr.city}, ${addr.state} - ${addr.zip_code}`;
//       }
//     } else {
//       if (oldOrder && oldOrder.order_address) {
//         const addr = oldOrder.order_address;
//         fullAddressText = `${addr.street_address}, ${addr.apartment ? addr.apartment + ", " : ""}${addr.city}, ${addr.state} - ${addr.zip_code}`;
//       }
//     }

//     const totalAmount = itemsList.reduce((sum, item) => sum + item.subtotal, 0);
//     const totalQty = itemsList.reduce((sum, item) => sum + item.quantity, 0);

//     if (totalAmount < 0.5) {
//       throw new CoustomError("Minimum order amount is $0.50 USD", 400);
//     }

//     const newOrder = await Order.create({
//       user_id: userId,
//       order_id: `RE-ORD-${Date.now()}`,
//       items: itemsList,
//       quantity: totalQty,
//       total_amount: totalAmount,
//       shipping_address: fullAddressText,
//       order_status: "Pending",
//       order_date: new Date(),
//       shippingAddress_id: shipping_address_id || oldOrder.order_address.id,
//     });

//     const line_items = itemsList.map((item) => ({
//       price_data: {
//         currency: "USD",
//         product_data: { name: item.product_name },
//         unit_amount: Math.round(item.price * 100),
//       },
//       quantity: item.quantity,
//     }));

//     const session = await stripe.checkout.sessions.create({
//       line_items: line_items,
//       mode: "payment",
//       metadata: {
//         order_id: newOrder.id,
//         user_id: userId,
//         old_order_id: id,
//         is_reorder: "true",
//         shipping_address: JSON.stringify(fullAddressText),
//       },
//       success_url: `https://mern.yilstaging.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
//       cancel_url: `https://mern.yilstaging.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
//     });

//     sendResponse(res, "Re-order session created successfully", 200, {
//       url: session.url,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

const createReorderCheckoutSession = async (req, res, next) => {
  try {
    const { id, shipping_address_id, productList } = req.body;
    const userId = req.user.id;
    let products = productList;
    // console.log("products", products);
    let itemsToProcess = [];
    let oldOrder = null;

    if (id && Number(id) > 0) {
      oldOrder = await Order.findOne({
        where: { id: id, user_id: userId },
        include: [{ model: Address, as: "order_address" }],
      });

      if (!oldOrder) throw new CoustomError("Original order not found", 404);

      itemsToProcess =
        products && products.length > 0
          ? products
          : typeof oldOrder.items === "string"
            ? JSON.parse(oldOrder.items)
            : oldOrder.items;
    } else if (products && products.length > 0) {
      itemsToProcess = products;
    } else {
      throw new CoustomError(
        "Please provide an Order ID or Products to checkout",
        400,
      );
    }

    // --- Price Calculation (Generic for both cases) ---
    const productIds = itemsToProcess.map((item) => item.id || item.product_id);
    const productDetailsList = await getCalculatedProducts({
      user_id: userId,
      product_id: productIds,
    });

    const itemsList = itemsToProcess.map((item) => {
      const pId = item.id || item.product_id;
      const latestData = productDetailsList.find((p) => p.id === pId);
      if (!latestData)
        throw new CoustomError(`Product ${pId} is not available`, 400);
      return {
        product_id: pId,
        product_name: latestData.product_name,
        quantity: item.quantity || 1,
        price: latestData.sale_price,
        subtotal: latestData.sale_price * (item.quantity || 1),
      };
    });

    // --- Address Handling ---
    let fullAddressText = null;
    let finalAddressId = shipping_address_id;

    if (shipping_address_id) {
      const addressData = await Address.findOne({
        where: { user_id: userId, id: shipping_address_id },
      });
      if (addressData) {
        fullAddressText = `${addressData.street_address}, ${addressData.apartment ? addressData.apartment + ", " : ""}${addressData.city}, ${addressData.state} - ${addressData.zip_code}`;
      }
    } else if (oldOrder && oldOrder.order_address) {
      const addr = oldOrder.order_address;
      fullAddressText = `${addr.street_address}, ${addr.apartment ? addr.apartment + ", " : ""}${addr.city}, ${addr.state} - ${addr.zip_code}`;
      finalAddressId = oldOrder.order_address.id;
    } else {
      const defaultAddr = await Address.findOne({
        where: { user_id: userId, is_default: 1 },
      });
      if (defaultAddr) {
        fullAddressText = `${defaultAddr.street_address}, ${defaultAddr.city} - ${defaultAddr.zip_code}`;
        finalAddressId = defaultAddr.id;
      }
    }
    if (!fullAddressText)
      throw new CoustomError("Shipping address is required", 400);
    const totalAmount = itemsList.reduce((sum, item) => sum + item.subtotal, 0);
    const totalQty = itemsList.reduce((sum, item) => sum + item.quantity, 0);
    if (totalAmount < 0.5)
      throw new CoustomError("Minimum amount is $0.50", 400);

    const newOrder = await Order.create({
      user_id: userId,
      order_id: `ORD-${id ? "RE-" : ""}${Date.now()}`,
      items: itemsList,
      quantity: totalQty,
      total_amount: totalAmount,
      shipping_address: fullAddressText,
      order_status: "Pending",
      order_date: new Date(),
      shippingAddress_id: finalAddressId,
    });

    const line_items = itemsList.map((item) => ({
      price_data: {
        currency: "USD",
        product_data: { name: item.product_name },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: "payment",
      metadata: {
        order_id: newOrder.id,
        user_id: userId,
        is_reorder: id ? "true" : "false",
        shipping_address: JSON.stringify(fullAddressText),
      },
      success_url: `https://mern.yilstaging.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://mern.yilstaging.com/payment-failed?session_id={CHECKOUT_SESSION_ID}`,
    });

    sendResponse(res, "Checkout session created", 200, { url: session.url });
  } catch (error) {
    next(error);
  }
};

const getAllOrders = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const orders = await Order.findAll({
      where: { user_id },
      order: [["order_date", "DESC"]],
      attributes: {
        exclude: [
          "createdAt",
          "updatedAt",
          "user_id",
          "shipping_address",
          "payment_method",
          "return_reason",
          // "order_id",
        ],
      },
      raw: true,
    });
    const formattedOrders = orders.map((order) => {
      return {
        ...order,
        total_amount: `${order.total_amount}`,
        items: undefined,
      };
    });
    sendResponse(res, "Orders fetched successfully", 200, {
      orders: formattedOrders,
    });
  } catch (error) {
    next(error);
  }
};

const fetchOrderDetails = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;

    const order = await Order.findOne({
      where: { id, user_id },
      attributes: {
        exclude: ["createdAt", "updatedAt", "user_id"],
      },
      include: [
        {
          model: Transaction,
          as: "transaction",
          attributes: ["invoice_url"],
        },
        {
          model: Address,
          as: "order_address",
          attributes: { exclude: ["createdAt", "updatedAt"] },
        },
      ],

      raw: true,
      nest: true,
    });
    if (!order) {
      throw new CoustomError("Order not found", 404);
    }
    const items =
      typeof order.items === "string" ? JSON.parse(order.items) : order.items;

    const productIds = items.map((item) => item.product_id);
    const products = await getCalculatedProducts({
      user_id,
      product_id: productIds,
    });
    console.log("products", products);
    const formattedProducts = items.map((item) => {
      const pData = products.find((p) => p.id === item.product_id);
      // console.log("pData", pData);
      return {
        product_name: pData?.product_name || "Product",
        color: pData.color || "N/A",
        size: pData.size || "N/A",
        sale_price: `${parseFloat(item.price || 0)}`,
        quantity: item.quntaty || item.quantity || 1,
        product_images: pData?.product_images || "",
        discount_percentage: pData.discount_applied,
      };
    });

    const totalItemsCount = formattedProducts.reduce(
      (acc, curr) => acc + curr.quantity,
      0,
    );
    const totalItemsPrice = formattedProducts.reduce(
      (acc, curr) => acc + curr.sale_price * curr.quantity,
      0,
    );

    const addr = order.order_address;
    const delivery_address = {
      name: addr?.name || req.user.name,
      phone: addr?.phone || req.user.phone,
      address: addr
        ? `${addr.street_address}, ${addr.apartment ? addr.apartment + ", " : ""}${addr.city}, ${addr.state} - ${addr.post_code}`
        : "N/A",
    };

    const orderDateObj = new Date(order.createdAt || new Date());

    const action_flags = {
      can_cancel: order.status === "Pending" || order.status === "Processing",
      can_return: order.status === "Delivered",
      can_reorder: true,
    };

    console.log("order", order);

    const finalData = {
      id: order.id,
      order_id: order.order_id,
      status: order.order_status,
      invoice_url: order.transaction.invoice_url,
      order_date: orderDateObj.toISOString().split("T")[0],
      order_time: orderDateObj.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),

      products: formattedProducts,

      items_summary: {
        total_items: totalItemsCount,
        total_price: `${totalItemsPrice}`,
      },

      price_breakdown: {
        subtotal: `${totalItemsPrice}`,
        discount: `${parseFloat(formattedProducts[0].discount_percentage || 0)}%`,
        delivery_charges: parseFloat(order.delivery_charges || 0),
        final_amount: `${parseFloat(order.total_amount)}`,
        currency: "USD",
      },

      delivery_address: delivery_address,

      // tracking_details: {
      //   tracking_id: order.tracking_id || "N/A",
      //   estimated_delivery_date: order.estimated_delivery_date || "N/A"
      // },

      // action_flags: action_flags
    };

    sendResponse(res, "Order summary fetched successfully", 200, finalData);

    // let fullAddressText;
    // if (order && order.order_address) {
    //   const addr = order.order_address;
    //   fullAddressText = `${addr.street_address}, ${addr.apartment ? addr.apartment + ", " : ""}${addr.city}, ${addr.state} - ${addr.post_code}`;
    // }

    // const productsWithQuantities = items.map((item) => {
    //   const calculatedData = products.find((p) => p.id === item.product_id);

    //   const unitPrice = calculatedData ? calculatedData.sale_price : item.price;
    //   const quantity = item.quntaty || item.quantity || 1;

    //   return {
    //     ...calculatedData,

    //     item_total: (unitPrice * quantity).toFixed(2),
    //     quantity: quantity,
    //   };
    // });

    // const formattedOrder = {
    //   ...order,
    //   items: undefined,
    //   total_amount: `${order.total_amount}`,
    //   invoice_url: order.transaction ? order.transaction.invoice_url : null,
    //   transaction: undefined,
    //   shipping_tax: "0.00",
    //   estimated_tax: "0.00",
    //   shipping_address: fullAddressText,
    //   order_address: undefined,
    // };
    // const price_breakdown = {};

    // sendResponse(res, "Order details fetched successfully", 200, {
    //   order: formattedOrder,
    //   products: productsWithQuantities,
    // });
  } catch (error) {
    next(error);
  }
};

const cancelMyOrder = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { id, reason } = req.body;
    const order = await Order.findOne({
      where: {
        id,
        user_id,
        order_status: "Placed",
      },
    });
    if (!order) {
      throw new CoustomError("Order not found or cannot be cancelled", 404);
    }
    await order.update({
      is_cancelled: 1,
      order_status: "Cancelled",
      reason: reason || "No reason provided",
    });
    sendResponse(res, "Order cancelled successfully", 200);
  } catch (error) {
    next(error);
  }
};

const getAllCountryCode = async (req, res, next) => {
  try {
    const countries = Country.getAllCountries().map((c) => ({
      name: c.name,
      isoCode: c.isoCode,
    }));

    sendResponse(res, "Fetching all country list", 200, {
      countries,
    });
  } catch (error) {
    next(error);
  }
};

const getAllStateCode = async (req, res, next) => {
  try {
    const { country_code } = req.body; // Example: "IN", "US"
    // console.log("country_code", country_code);
    if (!country_code) {
      return res.status(400).json({ message: "Country Code is required" });
    }

    const states = State.getStatesOfCountry(country_code).map((s) => ({
      name: s.name,
      isoCode: s.isoCode,
    }));
    // console.log("states", states);
    sendResponse(res, "Order cancelled successfully", 200, {
      states: states,
    });
  } catch (error) {
    next(error);
  }
};

const allProduct = async (req, res, next) => {
  try {
    const allPro = await Product.findAll({
      where: {
        sale_price: {
          [Op.gt]: 0,
        },
      },
    });
    sendResponse(res, "", 200, allPro);
  } catch (error) {
    next(error);
  }
};

const getRecommendedProduct = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { image_width, image_height, landmarks } = req.body;
    const allProduct = await Product.findAll({
      where: {
        sale_price: {
          [Op.gt]: 0,
        },
      },
    });
    const allSize = await Size.findAll();

    const predictedProduct = await axios.post(
      "http://localhost:5000/api/predict-size",
      {
        image_width,
        image_height,
        landmarks,
        products: allProduct,
        productSize: allSize,
      },
    );
    if (!predictedProduct) {
      throw new CoustomError("there is an error through ai", 400);
    }

    // console.log("predictedProduct", predictedProduct.data.data.products);
    const productData = predictedProduct.data.data.products;
    const productIds = [...new Set(productData.map((item) => item.id))];
    const productsWithPrices = await getCalculatedProducts({
      product_id: productIds,
      user_id,
    });

    sendResponse(res, "Featched all the product", 200, productsWithPrices);
  } catch (error) {
    next(error);
  }
};

const generateBabyTryOn = async (req, res, next) => {
  try {
    const { baby_img_url, garment_url } = req.body;

    const getBase64FromUrl = async (url, customHeaders = {}) => {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        headers: customHeaders,
      });
      const buffer = Buffer.from(response.data, "binary");
      const mimeType = response.headers["content-type"];
      return `data:${mimeType};base64,${buffer.toString("base64")}`;
    };
    console.log("Downloading and converting images...");

    const [babyBase64, garmentBase64] = await Promise.all([
      getBase64FromUrl(baby_img_url),
      getBase64FromUrl(garment_url, {
        "x-app-id": "BabyAiApp-Frontend-v1",
      }),
    ]);

    const BASE_URL = "https://api.fashn.ai/v1";

    const inputData = {
      model_name: "tryon-max",
      inputs: {
        model_image: babyBase64,
        product_image: garmentBase64,
        generation_mode: "balanced",
        // resolution: "4k",
        // return_base64: true
      },
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FASHN_API_KEY}`,
    };
    let outputimage;
    try {
      const runResponse = await fetch(`${BASE_URL}/run`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(inputData),
      });
      const runData = await runResponse.json();
      console.log("runData", runData);
      const predictionId = runData.id;
      console.log("Prediction started, ID:", predictionId);
      while (true) {
        const statusResponse = await fetch(
          `${BASE_URL}/status/${predictionId}`,
          {
            headers: headers,
          },
        );
        const statusData = await statusResponse.json();
        outputimage = statusData;
        if (statusData.status === "completed") {
          console.log("Prediction completed.");
          console.log(statusData.output);
          outputimage = statusData;
          break;
        } else if (
          ["starting", "in_queue", "processing"].includes(statusData.status)
        ) {
          console.log("Prediction status:", statusData.status);
          // outputimage = statusData;
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } else {
          console.log("Prediction failed:", statusData.error);
          outputimage = statusData;
          break;
        }
        console.log("statusData", statusData);
      }
    } catch (error) {
      console.error("Error:", error.message);
    }
    sendResponse(res, "genrated image", 200, outputimage);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOtpForLogin,
  verifyOtp,
  sendOtpForUpdatePhoneEmail,
  verifyPhoneEmailForUpdate,
  fabricList,
  colorsPreferenceList,
  getAllSizes,
  userProfile,
  updateBabyProfileWithStep,
  homeData,
  allWishlistData,
  addToWishlist,
  deleteFromWishlist,
  babyCategoryData,
  productCategoryWiseData,
  fetchProductDetails,
  fetchBabyProfileData,
  deleteBabyProfile,
  deleteMyProfile,
  addNewUserAddress,
  allSavedAddress,
  updateUserAddress,
  addressDetails,
  deleteAddress,
  setAsIsDefault,
  addToCart,
  updatedQuantityInCart,
  removeFromCart,
  fetchAllCartItems,
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
  fetchAllOrderedItems,
  buyAgain,
  createReorderCheckoutSession,
  getAllOrders,
  fetchOrderDetails,
  cancelMyOrder,
  getAllCountryCode,
  getAllStateCode,
  allProduct,
  getRecommendedProduct,
  generateBabyTryOn,
};
