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
const { Op } = require("sequelize");
const Retailer = require("../../modals/ProductModal/retailer");
const { getCalculatedProducts } = require("../../utils/PriceHelper");
const Color = require("../../modals/ProductModal/color");
const Size = require("../../modals/ProductModal/size");
const { processBabyData } = require("../AdminControllers/controllers");

const genrateOtpAndToken = async (input, name, channel) => {
  const otp = crypto.randomInt(10000, 99999).toString();
  console.log("otp", otp);
  const expiryToken = await jwt.sign(
    { input, otp, channel, name },
    process.env.JWT_SECRET,
    { expiresIn: "1m" },
  );
  return { otp, expiryToken };
};

const sendOtpForLogin = async (req, res, next) => {
  try {
    const { input, name, channel } = req.body;
    if (!input || !name || !channel)
      throw new CoustomError("Email Or Phone is required");
    const { otp, expiryToken } = await genrateOtpAndToken(input, name, channel);
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
      if (!phoneStr.startsWith("+")) {
        throw new CoustomError(
          "Phone number must start with a country code (e.g., +91)",
          400,
        );
      }
      const digitsOnly = phoneStr.replace(/\D/g, "");
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        throw new CoustomError("Invalid phone number length", 400);
      }
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
        return next(new CoustomError("OTP has expired (30s limit)", 401));
      }
      return next(new CoustomError("Invalid or corrupted token", 401));
    }

    if (decoded.input !== input || decoded.otp !== otp) {
      return next(new CoustomError("Invalid OTP", 401));
    }

    let user;
    const whereCondition =
      decoded.channel === "email"
        ? { email: input, is_delete: 0 }
        : { phone: input, is_delete: 0 };

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
            403,
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
      baby_profile: BabyProfileData,
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
    const { input, channel } = req.body;
    if (!input || !channel)
      throw new CoustomError("Email Or Phone is required", 400);
    const { otp, expiryToken } = await genrateOtpAndToken(input, name, channel);
    const isAlreadyExist = await User.findOne({
      where:
        channel === "email"
          ? { email: input, is_delete: 0 }
          : { phone: input, is_delete: 0 },
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
    user = await User.findOne({
      where: {
        id,
        is_delete: 0,
      },
    });
    if (!user) throw new CoustomError(`User not found.`, 404);
    const updateData =
      decoded.channel === "email" ? { email: input } : { phone: input };
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

    sendResponse(res, "Fetching all color list", 200, {
      allColorList,
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
    } = req.body;
    let baby_profile_image;
    if (req.file) {
      baby_profile_image = req.file.filename;
      console.log("baby_profile_image", baby_profile_image);
    } else {
      baby_profile_image = null;
    }
    let newBaby;
    if (!step && id) {
      const babyDataWithUser = await BabyProfile.findOne({
        id,
        user_id,
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
            parsedFabrics.length >= 0
              ? parsedFabrics
              : babyDataWithUser.fabric_preferences,

          preferred_colors:
            parsedColors.length >= 0
              ? parsedColors
              : babyDataWithUser.preferred_colors,

          baby_profile_image: baby_profile_image
            ? baby_profile_image
            : babyDataWithUser.baby_profile_image,
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

    const categoryShop = await Category.findAll();

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
      categoryShop,
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

    const formattedRows = wishlistEntries.rows.map((item, index) => {
      return {
        wishlist_added_at: item.createdAt,
        ...productsWithPrices[index],
      };
    });

    const finalData = {
      count: wishlistEntries.count,
      rows: formattedRows,
    };

    const formattedResponse = getPagingData(finalData, page, limit);

    sendResponse(
      res,
      "Wishlist fetched successfully with updated prices",
      200,
      formattedResponse,
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
    if (isInWishlist)
      throw new CoustomError("Already added in your wishlist", 400);

    await Wishlist.create({
      user_id: id,
      product_id: product_id,
    });
    sendResponse(res, "Added to wishlist", 200);
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
    const categories = await Category.findAll({
      where: {
        is_active: 1,
      },
    });
    if (!categories) throw new CoustomError("Category not found", 404);
    sendResponse(res, "Baby category data fetched successfully", 200, {
      categories,
      count: categories.length,
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

    const products = await getCalculatedProducts({
      category_id,
      user_id: user_id,
    });
    sendResponse(res, "Products fetched successfully", 200, {
      count: products.length,
      products: products,
    });
  } catch (error) {
    next(error);
  }
};

const fetchProductDetails = async (req, res, next) => {
  try {
    const { id } = req.body;
    const user_id = req.user.id;
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

    const productDetails = await getCalculatedProducts({
      product_id: id,
      user_id: user_id,
    });

    sendResponse(res, "Product detail fetched successfully", 200, {
      // productDetails: responseData,
      productDetails: productDetails,
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
      zip_code,
      lat,
      long,
      apartment,
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
      zip_code,
      lat,
      long,
      apartment,
      is_default,
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
    const {
      id,
      address_type,
      street_address,
      city,
      state,
      zip_code,
      lat,
      long,
      apartment,
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
      zip_code: zip_code ? zip_code : isAddress.zip_code,
      lat: lat ? lat : isAddress.lat,
      long: long ? long : isAddress.long,
      apartment: apartment ? apartment : isAddress.apartment,
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
    const cartItem = await Cart.findOne({
      where: { user_id, id },
    });
    if (!cartItem) throw new CoustomError("Cart item not found", 404);
    const productData = await Product.findOne({
      where: {
        id,
      },
    });
    if (!productData) throw new CoustomError("Product not found", 404);

    const productDetails = await getCalculatedProducts({
      product_id: id,
      user_id: user_id,
    });

    const updatedQuantity = cartItem.quantity + quantity;

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

    cartItem.quantity = updatedQuantity;
    cartItem.total_price = updatedQuantity * productDetails.sale_price;
    await cartItem.save();

    const plainCartItem = cartItem.get({ plain: true });
    let resData = {
      ...plainCartItem,
      total_price: parseFloat(plainCartItem.total_price).toFixed(2),
    };

    return sendResponse(res, "Cart item quantity updated successfully", 200, {
      resData,
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
    const cartItems = await Cart.findAll({
      where: { user_id },
    });

    if (!cartItems.length) {
      return sendResponse(res, "Cart is empty", 200, { cart_item: [] });
    }
    const productIds = cartItems.map((item) => item.product_id);
    const productDetailsList = await getCalculatedProducts({
      user_id,
      product_id: productIds,
    });

    const productMap = new Map(
      (Array.isArray(productDetailsList)
        ? productDetailsList
        : [productDetailsList]
      ).map((p) => [p.id.toString(), p]),
    );

    const cartItemsWithDetails = cartItems.map((item) => {
      const plainItem = item.get({ plain: true });
      const details = productMap.get(plainItem.product_id.toString()) || null;

      const finalSalePrice = details ? parseFloat(details.sale_price) : 0;

      return {
        ...plainItem,
        product: details,
        total_price: (plainItem.quantity * finalSalePrice).toFixed(2),
        max_quantity: 10,
      };
    });

    sendResponse(res, "Cart items fetched successfully", 200, {
      cart_item: cartItemsWithDetails,
    });
  } catch (error) {
    console.error("Error in fetchAllCartItems:", error);
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
};
