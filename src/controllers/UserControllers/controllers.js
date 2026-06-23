const FASHN_API_KEY = process.env.FASHN_API_KEY;
const FASHN_BASE_URL = process.env.FASHN_AI_BASE_URL;
const User = require("../../modals/userModal");
const fs = require("fs").promises;
const fs1 = require("fs");
const { OpenAI } = require("openai");
const CoustomError = require("../../utils/CoustomError");
const jwt = require("jsonwebtoken");
const { sendResponse } = require("../../utils/coustomResponse");
const crypto = require("crypto");
const { sendOtpOnEmail } = require("../../utils/sendMailServices");
const BabyProfile = require("../../modals/babyProfileModal");
const Banner = require("../../modals/bannerModal");
const { Wishlist } = require("../../modals/userWishlistModal");
const { getPagination,getPagingData } = require("../../utils/pagination");
const Product = require("../../modals/ProductModal/product");
const Address = require("../../modals/addressModal");
const path = require("path");
const Cart = require("../../modals/cartModal");
const Category = require("../../modals/ProductModal/category");
const Fabric = require("../../modals/ProductModal/fabric");
const { Op,Sequelize } = require("sequelize");
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
const { Country,State } = require("country-state-city");
const { formatFullAddress } = require("../../utils/getFullAddress");
const { createOrder,trackOrder } = require("../../utils/bambiniService");
const {
  getCalculatedProductsWithSuffling,
} = require("../../utils/calclutePricewithSuffaling");
const { paginateArray } = require("../../utils/paginateArray");
const Plan = require("../../modals/planModal");
const Subscriber = require("../../modals/subscriberModal");
const { sortProductsByBabyPreference } = require("../../utils/preferenceSorter");
const { saveOutputImage } = require("../../utils/saveOutputImage");
const { BabyTRYON } = require("../../modals/babyTryOn");
const ProductAIImage = require("../../modals/ProductModal/productGenratedImage");
const recentSearch = require("../../modals/ProductModal/recentlySearch");

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY,
});

const getBase64FromUrl = async (url,customHeaders = {}) => {
  const response = await axios.get(url,{
    responseType: "arraybuffer",
    headers: customHeaders,
  });
  const buffer = Buffer.from(response.data,"binary");
  const mimeType = response.headers["content-type"];
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
};

const createStripeCustomer = async (user_id,name,email) => {
  try {
  
    const customer = await stripe.customers.create({
      name: name,
      email: email,
      metadata: {
        user_id: user_id,
      },
    });
    if(customer) {
      return customer.id;
    }
  } catch(error) {
    throw new error("Helper error at createStripeCustomer: " + error.message);
  }
};

const genrateOtpAndToken = async (input,name,channel,country_code) => {
  const otp = crypto.randomInt(10000,99999).toString();
  const expiryToken = await jwt.sign(
    { input,otp,channel,name,country_code },
    process.env.JWT_SECRET,
    { expiresIn: "1m" },
  );
  return { otp,expiryToken };
};

const ALLOWED_IMAGE_HOSTS = [
  "www.bambinilayette.com",
  "bambinilayette.com",
  "cdn.shopify.com",
];

const proxyImage = async (req,res) => {
  try {
    const { url } = req.query;
    if(!url) return res.status(400).send("URL missing");

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).send("Invalid URL");
    }

    if(parsedUrl.protocol !== "https:") {
      return res.status(400).send("Only HTTPS URLs are allowed");
    }

    if(!ALLOWED_IMAGE_HOSTS.includes(parsedUrl.hostname)) {
      return res.status(403).send("Host not allowed");
    }

    const response = await axios({
      method: "get",
      url: url,
      headers: {
        "X-App-ID": "BabyAiApp-Frontend-v1",
      },
      maxRedirects: 2,
      timeout: 10000,
    });
    res.setHeader(
      "Content-Type",
      response.headers["content-type"] || "image/jpeg",
    );
    response.data.pipe(res);
  } catch(error) {
    console.error("Proxy Error:",error.message);
    res.status(500).send("Image fetch failed");
  }
};

const ensureHttps = (data) => {
  if(!data) return data;
  const proxyBaseUrl =
    "https://bridgeable-erinn-overluxuriously.ngrok-free.dev/proxy-image?url=";
  const getProxyUrl = (originalUrl) => {
    return `${proxyBaseUrl}${encodeURIComponent(originalUrl)}`;
  };
  if(Array.isArray(data)) {
    return data.map((url) => getProxyUrl(url));
  }
  return getProxyUrl(data);
};

// User Subscription and payment related controllers
const createCheckoutSessionForSubscription = async (req,res,next) => {
  try {
    const { id } = req.body;
    const user_id = req.user.id;

    const existingSubscription = await Subscriber.findOne({
      where: {
        user_id,
        status: "active"
      },
    });
    const subbscriptionPlan = await Plan.findOne({
      where: { id },
    });

    const existingPlansCount = await Subscriber.count({
      where: {
        user_id,
        status: ['active','scheduled']
      }
    });
    if(existingPlansCount >= 2) {
      throw new CoustomError(
        "You already have an active plan and a scheduled plan in queue. You cannot add more plans until the current one expires.",
        400
      );
    }

    if(!subbscriptionPlan || !subbscriptionPlan.stripe_price_id) {
      throw new CoustomError("Plan not found",400);
    }
    const planDuration = subbscriptionPlan.interval || (subbscriptionPlan.plan_name?.toLowerCase().includes('year') ? 'year' : 'month');

    const now = new Date();

    const activeSub = await Subscriber.findOne({
      where: { user_id,status: 'active' }
    });


    let checkoutAction = "purchase_subscription";
    if(activeSub) {
      console.log(`User ${user_id} has 1 active plan. Setting action to schedule the next one.`);
      checkoutAction = "upgrade_to_yearly_scheduled";
    }

    const customer = await User.findOne({
      where: {
        id: user_id,
      },
    });
    // console.log("customer", customer)
    let stripe_customer_id = null;
    if(!customer || customer.length <= 0) {
      throw new CoustomError("User not found",404);
    }

    if(customer.stripe_customer_id) {
      stripe_customer_id = customer.stripe_customer_id;
    } else {
      stripe_customer_id = await createStripeCustomer(
        customer.id,
        customer.name,
        customer.email,
      );

      if(!stripe_customer_id) {
        throw new CoustomError("Stripe customer id not found",400);
      }

      await User.update(
        { stripe_customer_id },
        {
          where: {
            id: user_id,
          },
        },
      );
    }

    // const isFirstTimeUser = !existingSubscription;
    // const session = await stripe.checkout.sessions.create({
    //   customer: stripe_customer_id,
    //   payment_method_types: ["card"],
    //   mode: "subscription",
    //   line_items: [
    //     {
    //       price: subbscriptionPlan.stripe_price_id,
    //       quantity: 1,
    //     },
    //   ],

    //   metadata: {
    //     userId: customer.id.toString(),
    //     userName: customer.name,
    //     planId: subbscriptionPlan.id.toString(),
    //     isSubscription: "true",
    //   },
    //   success_url: `https://mern.yilstaging.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: `https://mern.yilstaging.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    // });

    const priceDetails = await stripe.prices.retrieve(subbscriptionPlan.stripe_price_id);
    const session = await stripe.checkout.sessions.create({
      customer: stripe_customer_id,
      payment_method_types: ["card"],
      mode: "payment",
      // line_items: [{ price: subbscriptionPlan.stripe_price_id, quantity: 1 }],
      line_items: [
        {
          price_data: {
            currency: priceDetails.currency,
            product: priceDetails.product,
            unit_amount: priceDetails.unit_amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: customer.id.toString(),
        userName: customer.name,
        planId: subbscriptionPlan.id.toString(),
        planDuration: planDuration,
        action: checkoutAction,
        isSubscription: "true",
      },
      success_url: `https://mern.yilstaging.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://mern.yilstaging.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    });
    return sendResponse(res,"Checkout session created successfully",200,{
      session: session.url,
    });
  } catch(error) {
    next(error);
  }
};

const sendOtpForLogin = async (req,res,next) => {
  try {
    const { input,name,channel,country_code } = req.body;
    if(!input || !name || !channel)
      throw new CoustomError("Email Or Phone is required");
    const { otp,expiryToken } = await genrateOtpAndToken(
      input,
      name,
      channel,
      country_code,
    );
    if(channel === "email") {
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: input,
        subject: "Verification otp",
        html: `<p>Hi ${name},</p><p>Your verification code is ${otp}.</p><p>Thanks,<br/>Baby Ai Team</p>
                `,
      };
      await sendOtpOnEmail(mailOptions);
    } else if(channel === "phone") {
      const phoneStr = req.body.input.toString();
      // if (!phoneStr.startsWith("+")) {
      //   throw new CoustomError(
      //     "Phone number must start with a country code (e.g., +91)",
      //     400,
      //   );
      // }
      const digitsOnly = phoneStr.replace(/\D/g,"");
      // if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      //   throw new CoustomError("Invalid phone number length", 400);
      // }
    }
    return sendResponse(res,"OTP sent! Valid for 30 seconds.",200,{
      token: expiryToken,
    });
  } catch(error) {
    next(error);
  }
};

const verifyOtp = async (req,res,next) => {
  try {
    const { input,otp,token,device_type,fcm_token } = req.body;
    if(!token || !input || !otp || !device_type || !fcm_token)
      throw new CoustomError("All fields are required",400);
    let decoded;
    try {
      decoded = jwt.verify(token,process.env.JWT_SECRET);
    } catch(err) {
      if(err.name === "TokenExpiredError") {
        return next(new CoustomError("OTP has expired (30s limit)",200));
      }
      return next(new CoustomError("Invalid or corrupted token",200));
    }

    if(decoded.input !== input || decoded.otp !== otp) {
      return next(new CoustomError("Invalid OTP",200));
    }

    let user;
    const whereCondition =
      decoded.channel === "email"
        ? { email: input.toLowerCase(),is_delete: 0 }
        : { phone: input,is_delete: 0,country_code: decoded.country_code };

    user = await User.findOne({ where: whereCondition });

    if(!user) {
      const createData = {
        name: decoded.name,
        fcm_token: fcm_token,
        ...whereCondition,
      };
      user = await User.create(createData);
    } else {
      if(user.is_active === 0 || user.is_delete === 1) {
        return next(
          new CoustomError(
            "Your account is inactive or deleted. Please contact support.",
            200,
          ),
        );
      }
    }
    let BabyProfileData;
    if(user.is_profile_complete === 0) {
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

    const accessToken = jwt.sign(userInfo,process.env.JWT_SECRET,{
      expiresIn: "24h",
    });

    return sendResponse(res,"Verified successfully!",200,{
      user: user,
      ...(BabyProfileData && { baby_profile: BabyProfileData }),
      access_token: accessToken,
    });
  } catch(error) {
    console.error("Error verifying OTP:",error);
    next(error);
  }
};

const sendOtpForUpdatePhoneEmail = async (req,res,next) => {
  try {
    const { name } = req.user;
    const { input,channel,country_code } = req.body;
    if(!input || !channel)
      throw new CoustomError("Email Or Phone is required",400);
    const { otp,expiryToken } = await genrateOtpAndToken(
      input,
      name,
      channel,
      country_code,
    );
    const isAlreadyExist = await User.findOne({
      where:
        channel === "email"
          ? { email: input,is_delete: 0 }
          : { phone: input,is_delete: 0,country_code: country_code },
    });
    if(isAlreadyExist)
      throw new CoustomError(`This ${channel} is already registered.`,404);

    if(channel === "email") {
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: input,
        subject: "Verification otp",
        html: `<p>Hi ${name},</p><p>Your verification code is ${otp}.</p><p>Thanks,<br/>Baby Ai Team</p>
                `,
      };
      await sendOtpOnEmail(mailOptions);
    } else if(channel === "phone") {
      const phoneStr = req.body.input.toString();
    }
    return sendResponse(res,"OTP sent! Valid for 30 seconds.",200,{
      token: expiryToken,
    });
  } catch(error) {
    next(error);
  }
};

const verifyPhoneEmailForUpdate = async (req,res,next) => {
  try {
    const { otp,token } = req.body;
    const { id } = req.user;
    if(!otp || !token)
      throw new CoustomError("OTP and token are required",400);
    let decoded;
    try {
      decoded = jwt.verify(token,process.env.JWT_SECRET);
    } catch(err) {
      if(err.name === "TokenExpiredError") {
        return next(new CoustomError("OTP has expired (30s limit)",400));
      }
      return next(new CoustomError("Invalid or corrupted token",400));
    }
    if(decoded.otp !== otp) {
      return next(new CoustomError("Invalid OTP",400));
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
    if(!user) throw new CoustomError(`User not found.`,404);
    const updateData =
      decoded.channel === "email"
        ? { email: input.toLowerCase() }
        : { phone: input,country_code: country_code };
    await user.update(updateData);

    return sendResponse(res,`${decoded.channel} updated successfully!`,200,{
      user: user,
    });
  } catch(error) {
    next(error);
  }
};

const fabricList = async (req,res,next) => {
  try {
    const allFabricList = await Fabric.findAll();
    if(!allFabricList) throw new CoustomError("Fabric list not found",404);
    sendResponse(res,"Fetching all Fabric",200,{
      allFabricList,
    });
  } catch(error) {
    next(error);
  }
};

const colorsPreferenceList = async (req,res,next) => {
  try {
    const allColorList = await Color.findAll();

    if(!allColorList)
      throw new CoustomError("Color preference not found!",404);

    let uniqueColors = new Set();
    let finalColors = [];

    allColorList.forEach((item) => {
      const splitNames = item.name.includes("/")
        ? item.name.split("/")
        : [item.name];

      splitNames.forEach((name) => {
        const trimmedName = name.trim();
        if(
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

    sendResponse(res,"Fetching all color list",200,{
      allColorList: finalColors,
    });
  } catch(error) {
    next(error);
  }
};

const getAllPreferencesData = async (req,res,next) => {
  try {
    const [colorsData,sizes,febrics] = await Promise.all([
      Color.findAll({ attributes: { exclude: ["createdAt","updatedAt"] } }),
      Size.findAll({ attributes: { exclude: ["createdAt","updatedAt"] } }),
      Fabric.findAll({ attributes: { exclude: ["createdAt","updatedAt"] } }),
    ]);

    let uniqueColors = new Set();
    let finalColors = [];

    colorsData.forEach((item) => {
      const splitNames = item.name.includes("/")
        ? item.name.split("/")
        : [item.name];

      splitNames.forEach((name) => {
        const trimmedName = name.trim();
        if(
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

    sendResponse(res,"Fetching all preferences data",200,{
      colors: finalColors,
      sizes,
      fabrics: febrics,
    });
  } catch(error) {
    next(error);
  }
};

const getAllSizes = async (req,res,next) => {
  try {
    const allSizeList = await Size.findAll();
    if(!allSizeList)
      throw new CoustomError("Color preference not found!",404);
    sendResponse(res,"Fetching all color list",200,{
      allSizeList,
    });
  } catch(error) {
    next(error);
  }
};

const userProfile = async (req,res,next) => {
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
        {
          model: Subscriber,
          as: 'subscribers',
          attributes: ["start_date","status","end_date"],
          required: false,
        }
      ],
    });
    if(!userData) {
      throw new CoustomError("User not found!",404);
    }


    const userSub = userData.get({ plain: true });
    const { subscribers,...restUserData } = userSub;
    const sub = Array.isArray(subscribers) ? subscribers[0] : subscribers;

    const user = await processBabyData(restUserData);

    const userDetails = {
      ...user,
      subscription: sub?.status ? {
        status: sub.status,
        start_date: sub.start_date,
        end_date: sub.end_date
      } : null
    };

    sendResponse(res,"User and all baby profiles fetched successfully",200,{
      user: userDetails,
    });
  } catch(error) {
    next(error);
  }
};

const updateBabyProfileWithStep = async (req,res,next) => {
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

    if(req.file) {
      baby_profile_image = req.file.filename;
      console.log("baby_profile_image in side if",baby_profile_image);
    } else {
      baby_profile_image = null;
    }
    let newBaby;
    if(!step && id) {
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

      if(babyDataWithUser) {
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
        throw new CoustomError("Baby profile not found",404);
      }
    } else if(!step && !id) {
      const existingBabyProfile = await BabyProfile.findAll({
        where: {
          user_id,
        },
      });
      console.log("existingBabyProfile.length",existingBabyProfile.length);
      if(existingBabyProfile.length >= 3)
        throw new CoustomError("You can add only 3 baby profiles",400);

      if(
        !baby_nikname ||
        !age_range ||
        !baby_gender ||
        !fabric_preferences ||
        !preferred_colors
      ) {
        if(req.file) {
          await fs.unlink(req.file.path);
        }
        throw new CoustomError("All fields are required",400);
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

      if(userData.selected_baby === 0) {
        const totalBabyCount = await BabyProfile.count({ where: { user_id } });
        if(totalBabyCount === 1) {
          const singleBaby = await BabyProfile.findOne({
            where: { user_id },
            attributes: ['id']
          });
          await userData.update({ selected_baby: singleBaby.id });
        }
      }

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
    switch(step) {
    case "1":
      if(!baby_nikname || !age_range)
        throw new CoustomError("Nickname and Age are required!",400);
      if(id) {
        const is_baby = await BabyProfile.findOne({
          where: {
            id,
            user_id,
          },
        });
        if(is_baby) {
          newBaby = await is_baby.update({
            baby_nikname: baby_nikname ? baby_nikname : is_baby.baby_nikname,
            age_range: age_range ? age_range : is_baby.age_range,
          });
        } else {
          throw new CoustomError("Your baby id is wrong",400);
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
      if(!baby_gender || !id) {
        const missingField = !baby_gender ? "Gender" : "ID";
        throw new CoustomError(`${missingField} is required!`,400);
      }

      const baby = await BabyProfile.findOne({
        where: {
          id,
          user_id,
        },
      });
      if(!baby) throw new CoustomError("Baby not found",404);
      console.log("baby_profile_image here",baby_profile_image);
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
      if(!fabric_preferences || !id) {
        const missingField = !fabric_preferences
          ? "Fabric preferences"
          : "ID";
        throw new CoustomError(`${missingField} is required!`,400);
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
      if(!babyProfileData) throw new CoustomError("Baby not found",404);
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
      if(!preferred_colors || !id) {
        // throw CoustomError("Preferred colors are required!", 400);
        const missingField = !preferred_colors ? "Preferred colors" : "ID";
        throw new CoustomError(`${missingField} is required!`,400);
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
      if(!babyPro) throw new CoustomError("Baby not found",404);
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
      if(responseData.fabric_preferences) {
        try {
          responseData.fabric_preferences =
            typeof responseData.fabric_preferences === "string"
              ? JSON.parse(responseData.fabric_preferences)
              : responseData.fabric_preferences;
        } catch(e) {
          console.error("Fabric preferences parsing error:",e);
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
      throw CoustomError("Invalid step provided!",400);
    }
  } catch(error) {
    if(req.file) {
      await fs.unlink(req.file.path);
    }
    console.log("baby-profile-update-step error",error);
    next(error);
  }
};

const homeData = async (req,res,next) => {
  try {
    const { id } = req.user;
    const userData = await User.findOne({
      where: { id },
      include: [{
        model: Subscriber,
        as: 'subscribers',
        attributes: ["start_date","status","end_date"],
        required: false,
      }],
      raw: true,
      nest: true,
    });

    if(!userData) {
      return res.status(404).json({ success: false,message: "User not found" });
    }

    const sub = Array.isArray(userData.subscribers) ? userData.subscribers[0] : userData.subscribers;
    const selectedBabyId = userData?.selected_baby;
    const userDetails = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      subscription: sub?.status ? {
        status: sub.status,
        start_date: sub.start_date,
        end_date: sub.end_date
      } : null
    };

    const homeAllData = await BabyProfile.findAll({
      where: {
        user_id: id,
      },
      attributes: ["id","baby_profile_image"],
      raw: true,
    });

    // const formattedBabyData = homeAllData.map((baby) => {
    //   return {
    //     ...baby,
    //     baby_profile_image: baby.baby_profile_image
    //       ? baby.baby_profile_image.startsWith("http")
    //         ? baby.baby_profile_image
    //         : `${process.env.BACKEND_URL}/baby-image/${baby.baby_profile_image}`
    //       : null,
    //   };
    // });
    // const tryOnData=await


    const formattedBabyData = homeAllData
      .map((baby) => {
        return {
          ...baby,
          baby_profile_image: baby.baby_profile_image
            ? baby.baby_profile_image.startsWith("http")
              ? baby.baby_profile_image
              : `${process.env.BACKEND_URL}/baby-image/${baby.baby_profile_image}`
            : null,
          id: baby.id,
          selected: String(baby.id) === String(selectedBabyId)
            ? true
            : false,
        };
      })
      .sort((a,b) => {
        if(a.id === selectedBabyId) return -1;
        if(b.id === selectedBabyId) return 1;
        return 0;
      });


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
          order: [["id","ASC"]],
        },
      ],
    });
    // const finalResponse = categoryShop.map((cat) => {
    //   const item = cat.toJSON();
    //   // console.log("item",item)
    //  return item.name !== "Onezies";

    //   let firstImage = null;
    //   if (item.categories && item.categories.length > 0) {
    //     const productImages = item.categories[0].product_images;

    //     const imagesArray =
    //       typeof productImages === "string"
    //         ? JSON.parse(productImages)
    //         : productImages;

    //     firstImage =
    //       imagesArray && imagesArray.length > 0 ? imagesArray[0] : null;
    //   }
    //   return {
    //     id: item.id,
    //     name: item.name,
    //     category_image: firstImage,
    //     is_active: item.is_active,
    //     price_range: item.price_range,
    //     discount_percentage: item.discount_percentage,
    //     total_margin: item.total_margin,
    //     addon_percentage: item.addon_percentage,
    //     is_retailor_price_active: item.is_retailor_price_active,
    //     createdAt: item.createdAt,
    //     updatedAt: item.updatedAt,
    //   };
    // });

    const finalResponse = categoryShop
      .filter((cat) => {
        // Pehle hi check kar lo, agar "Onezies" hai toh list se bahar nikaal do
        const item = cat.toJSON();
        return item.name !== "Onezies";
      })
      .map((cat) => {
        const item = cat.toJSON();
        let firstImage = null;

        if(item.categories && item.categories.length > 0) {
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

    if(finalResponse.length > 0) {
      for(let i = finalResponse.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalResponse[i],finalResponse[j]] = [
          finalResponse[j],
          finalResponse[i],
        ];
      }
    }

    // if (!finalResponse || finalResponse.length === 0) {
    //   throw new CoustomError("Category not found", 404);
    // }

    const allBanners = bannersData.map((banner) => {
      const bannerJson = banner.toJSON();
      if(bannerJson.banner_url) {
        bannerJson.banner_url = `${process.env.BACKEND_URL}/banners/${bannerJson.banner_url}`;
      }
      return bannerJson;
    });
    sendResponse(res,"data fetched",200,{
      userDetails,
      formattedBabyData,
      allBanners,
      categoryShop: finalResponse,
      tryOn: [],
    });
  } catch(error) {
    next(error);
  }
};

const allWishlistData = async (req,res,next) => {
  try {
    const { id } = req.user;
    const { page,size } = req.query;

    const { limit,offset } = getPagination(page,size);
    const wishlistEntries = await Wishlist.findAndCountAll({
      where: {
        user_id: id,
        is_delete: 0,
      },
      limit,
      offset,
      attributes: ["product_id","createdAt"],
      order: [["createdAt","DESC"]],
      raw: true,
    });

    if(wishlistEntries.rows.length === 0) {
      return sendResponse(
        res,
        "Wishlist is empty",
        200,
        getPagingData(wishlistEntries,page,limit),
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

    const formattedRows = wishlistEntries.rows.map((item,index) => {
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
  } catch(error) {
    next(error);
  }
};

const addToWishlist = async (req,res,next) => {
  try {
    const { id } = req.user;
    const { product_id } = req.body;
    const product = await Product.findOne({
      where: {
        id: product_id,
      },
    });
    if(!product) throw new CoustomError("Product not found",404);

    const isInWishlist = await Wishlist.findOne({
      where: {
        user_id: id,
        product_id: product_id,
      },
    });
    if(isInWishlist) {
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
  } catch(error) {
    next(error);
  }
};

const deleteFromWishlist = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const isInWishlist = await Wishlist.findOne({
      where: {
        user_id: user_id,
        id: id,
      },
    });
    if(!isInWishlist)
      throw new CoustomError("There is no data in wishlist",404);

    await isInWishlist.destroy();

    sendResponse(res,"The product is removed from wishlist",200);
  } catch(error) {
    next(error);
  }
};

const babyCategoryData = async (req,res,next) => {
  try {
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
          order: [["id","ASC"]],
        },
      ],
    });

    const finalResponse = categoryShop.map((cat) => {
      const item = cat.toJSON();
      let firstImage = null;
      if(item.categories && item.categories.length > 0) {
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

    if(finalResponse.length > 0) {
      for(let i = finalResponse.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalResponse[i],finalResponse[j]] = [
          finalResponse[j],
          finalResponse[i],
        ];
      }
    }

    if(!finalResponse || finalResponse.length === 0) {
      throw new CoustomError("Category not found",404);
    }

    sendResponse(res,"Baby category data fetched successfully",200,{
      categories: finalResponse,
      count: finalResponse.length,
    });
  } catch(error) {
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

const productCategoryWiseData = async (req,res,next) => {
  try {
    const { category_id } = req.body;
    const user_id = req.user.id;

    const categoryData = await Category.findOne({
      where: {
        id: category_id,
        is_active: 1,
      },
    });

    if(!categoryData) {
      throw new CoustomError("Category not found",404);
    }

    const products = await getCalculatedProductsWithSuffling({
      category_id,
      user_id: user_id,
    });

    // const products = await getCalculatedProducts({
    //   category_id,
    //   user_id: user_id,
    // });
    const babyId = await User.findOne({
      where: {
        id: user_id
      }
    })

    const updatedData = await sortProductsByBabyPreference(products,babyId.selected_baby)
    console.log("updatedData.length",updatedData.length)
    sendResponse(res,"Products fetched successfully",200,{
      count: updatedData.length,
      products: updatedData,

    });
  } catch(error) {
    next(error);
  }
};

const productCategoryWiseDataPagination = async (req,res,next) => {
  try {
    const { category_id,page,limit } = req.body;
    const user_id = req.user.id;

    const products = await getCalculatedProductsWithSuffling({
      category_id,
      user_id: user_id,
    });
    // const products = await getCalculatedProducts({
    //   category_id,
    //   user_id: user_id,
    // });

    const result = paginateArray(products,page,limit,products);

    console.log("result.paginatedItems",result.paginatedItems.length);

    sendResponse(res,"Products fetched successfully",200,{
      count: result.paginatedItems.length,
      products: result.paginatedItems,
    });
  } catch(error) {
    next(error);
  }
};

const fetchProductDetails = async (req,res,next) => {
  try {
    const { id,is_search } = req.body;
    const user_id = req.user.id;
    const is_admin = req.user.is_admin;
    const userData = await User.findOne({
      where: {
        id: user_id
      }
    })
    const babyProfile = await BabyProfile.findAll({
      where: {
        user_id,
      },
    });
    const babies = await processBabyData(babyProfile);
    const targetProduct = await Product.findByPk(id);

    if(is_search == 1) {
      const existingSearch = await recentSearch.findOne({
        where: { product_id: id,user_id }
      });

      if(existingSearch) {
        await existingSearch.changed('updatedAt',true);
        await existingSearch.save();
      } else {
        await recentSearch.create({
          product_id: id,
          user_id
        });
      }
    }

    if(!targetProduct) {
      return { message: "Product not found" };
    }

    const allSizeProducts = await Product.findAll({
      where: {
        product_name: targetProduct.product_name,
        sale_price: { [Op.gt]: 0 },
      },
      attributes: ["id"],
    });

    const allIds = allSizeProducts.map((p) => p.id);

    const productDetails = await getCalculatedProductsWithSuffling({
      product_id: allIds,
      user_id: user_id,
      requestedId: id,
    });



    const selectedBabyId = userData ? userData.selected_baby : null;

    let babyInfo =
      is_admin == 1
        ? babies
        : babies.map((b) => ({
          baby_profile_image: b.baby_profile_image,id: b.id,selected: String(b.id) === String(selectedBabyId)
            ? true
            : false,
        }));

    if(selectedBabyId) {
      const selectedBaby = babyInfo.find(b => b.id === selectedBabyId);
      if(selectedBaby) {
        const otherBabies = babyInfo.filter(b => b.id !== selectedBabyId);
        babyInfo = [selectedBaby,...otherBabies];
      }
    }

    sendResponse(res,"Product detail fetched successfully",200,{
      productDetails: productDetails,
      babies: babyInfo,
    });
  } catch(error) {
    next(error);
  }
};

const fetchBabyProfileData = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const isBabyProfile = await BabyProfile.findOne({
      where: {
        id,
        user_id,
      },
    });
    if(!isBabyProfile)
      throw new CoustomError("Your baby details not found",404);

    if(isBabyProfile.baby_profile_image) {
      isBabyProfile.baby_profile_image = `${process.env.BACKEND_URL}/baby-image/${isBabyProfile.baby_profile_image}`;
    }

    sendResponse(res,"Baby detail fetched successfully",200,isBabyProfile);
  } catch(error) {
    next(error);
  }
};

const deleteBabyProfile = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const isBabyProfile = await BabyProfile.findOne({
      where: {
        user_id,
        id,
      },
    });
    if(!isBabyProfile)
      throw new CoustomError("You don't have baby profile",404);

    const user = await User.findByPk(user_id);

    if(isBabyProfile.baby_profile_image) {
      const imagePath = path.join(
        __dirname,
        "../../../files/BabyProfileImage",
        isBabyProfile.baby_profile_image,
      );
      await fs
        .unlink(imagePath)
        .catch(() => console.log("File not found, skipping unlink"));
    }

    await isBabyProfile.destroy();

    if(user.selected_baby === id) {
      const nextBaby = await BabyProfile.findOne({
        where: { user_id },
        attributes: ['id']
      });
      
      await user.update({
        selected_baby: nextBaby ? nextBaby.id : 0
      });
    }

    const remainingCount = await BabyProfile.count({
      where: { user_id },
    });
    if(remainingCount === 0) {
      await User.update(
        {
          is_profile_complete: 0,
          current_step: 1,
          is_new_user: 1,
        },
        { where: { id: user_id } },
      );
    }
    sendResponse(res,"Your baby profile deleted successfully",200);
  } catch(error) {
    next(error);
  }
};

const deleteMyProfile = async (req,res,next) => {
  try {
    const { id } = req.user;
    const user = await User.findOne({
      where: {
        id,
        is_delete: 0,
      },
    });
    if(!user) throw new CoustomError("User not found",404);
    await user.update({
      is_delete: 1,
    });

    const babyProfiles = await BabyProfile.findAll({
      where: { user_id: id },
    });

    if(babyProfiles.length > 0) {
      for(const profile of babyProfiles) {
        if(profile.baby_profile_image) {
          const imagePath = path.join(
            __dirname,
            "../../../files/BabyProfiles",
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
    sendResponse(res,"Your profile has been deleted successfully",200);
  } catch(error) {
    next(error);
  }
};

const addNewUserAddress = async (req,res,next) => {
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
    if(isAnyAddress.length === 0) {
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

    sendResponse(res,"Address added successfully",200);
  } catch(error) {
    next(error);
  }
};

const allSavedAddress = async (req,res,next) => {
  try {
    const { id } = req.user;
    const allAddress = await Address.findAll({
      where: {
        user_id: id,
      },
    });

    sendResponse(res,"Address list here",200,{ address: allAddress });
  } catch(error) {
    next(error);
  }
};

const updateUserAddress = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    console.log("reqBody",req.body);
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

    if(!isAddress) throw new CoustomError("No Address found",404);

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

    sendResponse(res,"Your address has been updated",200,isAddress);
  } catch(error) {
    next(error);
  }
};

const addressDetails = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const isAddress = await Address.findOne({
      where: {
        id,
        user_id,
      },
    });
    if(!isAddress) throw new CoustomError("No address found",404);
    sendResponse(res,"Geting address details",200,isAddress);
  } catch(error) {
    next(error);
  }
};

const deleteAddress = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const addressToDelete = await Address.findOne({
      where: { id,user_id },
    });
    console.log("addressToDelete",addressToDelete);
    if(!addressToDelete) {
      throw new CoustomError("Address not found",404);
    }
    const wasDefault = addressToDelete.is_default === 1;
    await addressToDelete.destroy();
    if(wasDefault) {
      const nextAddress = await Address.findOne({
        where: { user_id },
        order: [["createdAt","DESC"]],
      });

      if(nextAddress) {
        await nextAddress.update({ is_default: 1 });
      }
    }

    sendResponse(res,"Your address has beed deleted",200,addressToDelete);
  } catch(error) {
    next(error);
  }
};

const setAsIsDefault = async (req,res,next) => {
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

    if(updatedAddress[0] === 0) {
      throw new CoustomError("Address not found",404);
    }

    sendResponse(res,"Address set as default successfully!",200);
  } catch(error) {
    next(error);
  }
};

const addToCart = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { id,quantity } = req.body;
    const productData = await Product.findOne({
      where: {
        id,
      },
    });
    if(!productData) throw new CoustomError("Product not found",404);

    const existingCartItem = await Cart.findOne({
      where: { user_id,product_id: id },
    });

    const productDetails = await getCalculatedProducts({
      product_id: id,
      user_id: user_id,
    });

    if(existingCartItem) {
      const updatedQuantity = existingCartItem.quantity + quantity;
      if(updatedQuantity > 10) {
        throw new CoustomError(
          "You cannot add more than 10 units of this product",
          400,
        );
      }
      if(updatedQuantity <= 0) {
        await existingCartItem.destroy();
        return sendResponse(res,"Product removed from cart successfully",200);
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
      if(quantity <= 0) {
        throw new CoustomError("Invalid quantity for new item",400);
      }
      if(quantity > 10) {
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
  } catch(error) {
    next(error);
  }
};

const updatedQuantityInCart = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { id,quantity } = req.body;

    if(quantity < 1 || quantity > 10) {
      throw new CoustomError("Quantity must be between 1 and 10",400);
    }

    const cartItem = await Cart.findOne({
      where: { user_id,id },
    });
    if(!cartItem) throw new CoustomError("Cart item not found",404);

    const productDetails = await getCalculatedProducts({
      product_id: cartItem.product_id,
      user_id: user_id,
    });

    if(!productDetails)
      throw new CoustomError("Product details not found",404);

    cartItem.quantity = quantity;
    const salePrice = parseFloat(productDetails.sale_price) || 0;
    const actualPrice = parseFloat(productDetails.actual_price) || 0;
    cartItem.total_price = (quantity * salePrice).toFixed(2);
    cartItem.actual_total_price = (quantity * actualPrice).toFixed(2);
    await cartItem.save();
    const plainCartItem = cartItem.get({ plain: true });

    return sendResponse(res,"Cart item quantity updated successfully",200,{
      ...plainCartItem,
      max_quantity: 10,
    });
  } catch(error) {
    next(error);
  }
};

const removeFromCart = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const cartItem = await Cart.findOne({
      where: { user_id,id },
    });
    if(!cartItem) throw new CoustomError("Cart item not found",404);
    await cartItem.destroy();
    return sendResponse(res,"Product removed from cart successfully",200);
  } catch(error) {
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

const fetchAllCartItems = async (req,res,next) => {
  try {
    const { id: user_id } = req.user;

    const [cartItems,savedAddress] = await Promise.all([
      Cart.findAll({
        where: { user_id },
        attributes: {
          exclude: ["createdAt","updatedAt","user_id","category_name"],
        },
        raw: true,
      }),
      Address.findOne({
        where: { user_id,is_default: 1 },
      }),
    ]);

    if(!cartItems || cartItems.length === 0) {
      return sendResponse(res,"Cart is empty",200,{
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
    const productMap = new Map(detailsArray.map((p) => [p.id.toString(),p]));

    const categoryIds = [
      ...new Set(detailsArray.map((p) => p.category_id).filter((id) => id)),
    ];

    let relatedOutfits = [];

    if(categoryIds.length > 0) {
      // const rawRelated = await getCalculatedProducts({
      //   user_id,
      //   category_id: categoryIds,
      //   limit: 10,
      // });
      const rawRelated = await getCalculatedProductsWithSuffling({
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

    sendResponse(res,"Cart items fetched successfully",200,{
      saved_address: savedAddress,
      cart_item: cartItemsWithDetails,
      related_outfits: relatedOutfits,
    });
  } catch(error) {
    console.error("Error in fetchAllCartItems:",error);
    next(error);
  }
};

const fetchAllOrderedItems = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const orders = await Order.findAll({
      // where: { user_id: user_id, order_status: "Placed", is_returned: 0 },
      where: { user_id: user_id,order_status: "Placed" },
      limit: 10,
      order: [["order_date","DESC"]],
      exclude: ["createdAt","updatedAt","user_id","order_date"],
      raw: true,
    });
    // console.log("orders", orders);
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
      if(p.category_id) categories.push(p.category_id);
    });
    const uniqueCategories = [...new Set(categories)];

    const suggestedOutfits = await Product.findAll({
      where: {
        category_id: uniqueCategories,
        id: { [Op.notIn]: uniqueProductIds },
      },
      limit: 15,
    });

    // const formattedSuggestions = await Promise.all(
    //   suggestedOutfits.map(async (p) => {
    //     // const finalPriceDetails = await getCalculatedProducts({
    //     //   user_id,
    //     //   product_id: p.id,
    //     // });

    //     const finalPriceDetails = await getCalculatedProductsWithSuffling({
    //       user_id,
    //       product_id: p.id,
    //     });

    //     return finalPriceDetails;
    //   }),
    // );

    const productIds = suggestedOutfits.map((p) => p.id);

    let formattedSuggestions = [];

    if(productIds.length > 0) {
      formattedSuggestions = await getCalculatedProductsWithSuffling({
        user_id,
        product_id: productIds,
      });
    }

    if(formattedSuggestions && !Array.isArray(formattedSuggestions)) {
      formattedSuggestions = [formattedSuggestions];
    }

    console.log("formattedSuggestions",formattedSuggestions);

    const formattedResponse = orders.map((order) => {
      const items =
        typeof order.items === "string" ? JSON.parse(order.items) : order.items;

      const detail = productsDetails.find(
        (p) => p.id === Number(items[0].product_id),
      );
      // if (order.id===102) {
      //   console.log("detail", detail);
      // }
      let formattedImages = [];
      try {
        formattedImages =
          typeof detail.product_images === "string"
            ? JSON.parse(detail.product_images || "[]")
            : detail.product_images || [];
      } catch(e) {
        formattedImages = [];
      }
      console.log("formattedImages",formattedImages);
      return {
        order_id: Number(order.id),
        total_amount: `${order.total_amount}`,
        products_name: items[0].product_name,
        product_images: formattedImages,
        product_id: Number(items[0].product_id),
      };
    });
    sendResponse(res,"Ordered items fetched successfully",200,{
      orders: formattedResponse,
      suggestedOutfits: formattedSuggestions,
    });
  } catch(error) {
    next(error);
  }
};

const allFilterData = async (req,res,next) => {
  try {
    // const [brands, colorsData, genders, sizes, febrics] = await Promise.all([
    const [colorsData,genders,sizes,febrics] = await Promise.all([
      // Brand.findAll({ attributes: { exclude: ["createdAt", "updatedAt"] } }),
      Color.findAll({ attributes: { exclude: ["createdAt","updatedAt"] } }),
      Gender.findAll({ attributes: { exclude: ["createdAt","updatedAt"] } }),
      Size.findAll({ attributes: { exclude: ["createdAt","updatedAt"] } }),
      Fabric.findAll({ attributes: { exclude: ["createdAt","updatedAt"] } }),
    ]);

    let uniqueColors = new Set();
    let finalColors = [];

    colorsData.forEach((item) => {
      const splitNames = item.name.includes("/")
        ? item.name.split("/")
        : [item.name];

      splitNames.forEach((name) => {
        const trimmedName = name.trim();
        if(
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
      { id: 1,label: "$0 - $99",min_price: 0,max_price: 99 },
      { id: 2,label: "$100 - $199",min_price: 100,max_price: 199 },
      { id: 3,label: "$200 - $299",min_price: 200,max_price: 299 },
      { id: 4,label: "$300 and above",min_price: 300,max_price: null },
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
    sendResponse(res,"Filters fetched successfully",200,{ filters });
  } catch(error) {
    console.error("Filter Fetch Error:",error);
    next(error);
  }
};

const applayFilters = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    // const { price, brand, gender, color, size, fabric, category_id } = req.body;
    const { price,gender,color,size,fabric,category_id } = req.body;
    let productWhere = { sale_price: { [Op.gt]: 0 } };
    if(category_id) productWhere.category_id = category_id;
    // if (brand?.length) productWhere.brand_id = { [Op.in]: brand };
    if(gender?.length) productWhere.gender_id = { [Op.in]: gender };
    if(color?.length) productWhere.color_id = { [Op.in]: color };
    if(size?.length) productWhere.size_id = { [Op.in]: size };

    let products = await getCalculatedProductsWithSuffling({
      category_id,
      user_id,
      productWhereData: productWhere,
    });

    if(price) {
      const min = parseFloat(price.min_price) || 0;
      const max =
        price.max_price !== null ? parseFloat(price.max_price) : Infinity;

      let filteredResults = [];
      for(let i = 0; i < products.length; i++) {
        const sPrice = parseFloat(products[i].sale_price);
        if(sPrice >= min && sPrice <= max) {
          filteredResults.push(products[i]);
        }
      }
      products = filteredResults;
    }

    return sendResponse(res,"Filters applied successfully",200,{
      count: products.length,
      products,
    });
  } catch(error) {
    next(error);
  }
};

const searchProduct = async (req,res,next) => {
  try {
    const user_id = req.user.id
    const searchItem = req.body.search_text;

    let productWhere = { sale_price: { [Op.gt]: 0 } };
    if(searchItem) productWhere.product_name = { [Op.like]: `%${searchItem}%` };

    let products = await getCalculatedProductsWithSuffling({
      user_id,
      productWhereData: productWhere,
    });
    const finalProducts = Array.isArray(products) ? products : [products];
    return sendResponse(res,"Searched applied successfully",200,{
      count: finalProducts.length,
      products: finalProducts,
    });
  } catch(error) {
    next(error)
  }
}

const getAllRecentlySearchedData = async (req,res,next) => {
  try {
    const user_id = req.user.id

    const count = await recentSearch.count({ where: { user_id } });
    if(count > 5) {
      const latestFive = await recentSearch.findAll({
        where: { user_id },
        order: [['updatedAt','DESC']],
        limit: 5,
        attributes: ['id']
      });

      const latestFiveIds = latestFive.map(item => item.id);
      await recentSearch.destroy({
        where: {
          user_id,
          id: { [Op.notIn]: latestFiveIds }
        }
      });
    }
    const recentlySearchData = await recentSearch.findAll({
      where: {
        user_id
      },
      include: [
        {
          model: Product,
          as: 'recentSearchProduct',
          attributes: ['id']
        }
      ],
      order: [['updatedAt','DESC']],
    })

    const finalProductIds = recentlySearchData.map(item => item.product_id);
    console.log(finalProductIds);

    let products = await getCalculatedProducts({
      user_id,
      product_id: finalProductIds,
    });


    const productArray = Array.isArray(products)
      ? products
      : (products ? [products] : []);

    const sortedProducts = finalProductIds
      .map(id => productArray.find(p => p.id === id))
      .filter(p => p !== undefined);

    const formattedProducts = sortedProducts.map(product => ({
      id: product.id,
      product_name: product.product_name,
      product_images: product.product_images
    }));

    return sendResponse(res,"Recently searched data fetched successfully",200,{
      count: formattedProducts.length,
      products: formattedProducts,
    });

  } catch(error) {
    next(error)
  }
}

const selectBabyProfile = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;
    const babyProfile = await BabyProfile.findOne({
      where: {
        id: id,
        user_id,
      },
    });
    if(!babyProfile) {
      throw new CoustomError("Baby profile not found",404);
    }

    const useExist = await User.findOne({
      where: {
        id: user_id,
        is_delete: 0,
      },
    });
    if(useExist) {
      await useExist.update({
        selected_baby: id,
      });
    }

    sendResponse(res,"Baby profile selected successfully",200,{
      babyProfile,
    });
  } catch(error) {
    next(error);
  }
};

const helpAndSupport = async (req,res,next) => {
  try {
    const { name,phone,country_code,email,message,subject } = req.body;

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
            Admin Dashboard | Baby AI System Alert | ${new Date().toLocaleDateString()}
        </div>
    </body>
    </html>
  `,
    };

    await sendOtpOnEmail(mailOptions);
    sendResponse(res,"Your query has been submitted successfully",200);
  } catch(error) {
    next(error);
  }
};

const staticPageDetails = async (req,res,next) => {
  try {
    const { id } = req.body;
    const staticPage = await StaticPage.findOne({
      where: {
        id,
        is_active: 1,
      },
      attributes: ["id","title","content"],
    });
    console.log("id",id);
    if(!staticPage) {
      throw new CoustomError("Page not found",404);
    }
    sendResponse(res,"Page details fetched successfully",200,{
      staticPage,
    });
  } catch(error) {
    next(error);
  }
};

const placeOrder = async (req,res,next) => {
  try {
    const { id,shipping_address,payment_method } = req.body;
    const userId = req.user.id;

    const cartItems = await Cart.findAll({
      where: { id: id,user_id: userId },
      include: ["product"],
    });

    if(cartItems.length === 0) throw new CoustomError("Cart is empty",404);

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
        actual_price: calculatedData
          ? calculatedData.actual_price
          : item.product.actual_price,
      };
    });

    const totalOrderAmount = itemsList.reduce(
      (sum,item) => sum + item.subtotal,
      0,
    );

    const totalOrderQty = itemsList.reduce(
      (sum,item) => sum + item.quantity,
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

    await Cart.destroy({ where: { id: id,user_id: userId } });
    return sendResponse(res,"Order Placed Successfully",201,{
      newOrder,
    });
  } catch(error) {
    next(error);
  }
};

const createPaymentIntent = async (req,res,next) => {
  try {
    const { id,shipping_address } = req.body;
    const userId = req.user.id;

    const cartItems = await Cart.findAll({
      where: { id: id,user_id: userId },
      include: ["product"],
    });

    if(cartItems.length === 0) throw new CoustomError("Cart is empty",404);

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
      (sum,item) => sum + item.subtotal,
      0,
    );
    console.log("Total Order Amount:",Math.round(totalOrderAmount));
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
  } catch(error) {
    next(error);
  }
};

const createCheckoutSession = async (req,res,next) => {
  try {
    const { id,shipping_address_id } = req.body;
    const userId = req.user.id;

    const cartItems = await Cart.findAll({
      where: { id: id,user_id: userId },
      include: ["product"],
    });
    // console.log("cartItems", cartItems);
    if(cartItems.length === 0) throw new Error("Cart is empty");

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
        actual_price: calculatedData
          ? calculatedData.actual_price
          : item.product.actual_price,
      };
    });

    const totalOrderQty = itemsList.reduce(
      (sum,item) => sum + item.quantity,
      0,
    );
    const totalAmount = itemsList.reduce((sum,item) => sum + item.subtotal,0);

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

    sendResponse(res,"Checkout session created successfully",200,{
      url: session.url,
    });
  } catch(error) {
    next(error);
  }
};

const verifyPayment = async (req,res,next) => {
  try {
    const { sessionId } = req.body;
    console.log("sessionId",sessionId);
    if(!sessionId) throw new CoustomError("Session ID is required",400);

    const existingTx = await Transaction.findOne({
      where: { stripe_session_id: sessionId },
    });
    if(existingTx)
      throw new CoustomError(
        "This transaction has already been processed.",
        400,
      );

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId,{
        expand: ["invoice","subscription","payment_intent","customer"],
      });
    } catch(err) {
      console.log("err",err);
      throw new CoustomError("Invalid Session ID",400);
    }
    const { metadata,payment_status,mode,subscription } = session;

    if(metadata && (metadata.action === 'purchase_subscription' || metadata.action === 'upgrade_to_yearly_scheduled')) {
      const isPaid = payment_status === "paid";
      if(!isPaid) {
        throw new CoustomError("Subscription payment failed.",400);
      }

      const userId = metadata.userId;
      const planId = metadata.planId || metadata.yearlyPlanId;
      const planDuration = metadata.planDuration;

      const currentActiveSub = await Subscriber.findOne({
        where: { user_id: userId,status: 'active' }
      });

      let startDate = new Date();
      let calculatedStatus = "active";
      if(currentActiveSub) {
        startDate = new Date(currentActiveSub.end_date);
        calculatedStatus = "scheduled";
      }
      let endDate = new Date(startDate);
      if(planDuration === 'year') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const subscriberRecord = await Subscriber.create({
        user_id: userId,
        plan_id: planId,
        stripe_subscription_id: null,
        status: calculatedStatus,
        start_date: startDate,
        end_date: endDate,
        stripe_invoice_url: session.invoice?.hosted_invoice_url || null,
        stripe_invoice_pdf: session.invoice?.invoice_pdf || null,
        payment_method: session.payment_method_types[0] || "card",
      });

      const transaction = await Transaction.create({
        user_id: userId,
        subscription_id: subscriberRecord.id,
        stripe_session_id: sessionId,
        transaction_id: session.payment_intent?.id || session.payment_intent || "n/a",
        payment_intent_id: session.payment_intent?.id || session.payment_intent || null,
        invoice_id: session.invoice?.id || null,
        invoice_url: session.invoice?.hosted_invoice_url || null,
        amount: session.amount_total / 100,
        status: "paid",
        payment_method: session.payment_method_types[0] || "card",
        subscription_plan_id: planId,
      });

      await subscriberRecord.update({ transaction_id: transaction.id });

      if(calculatedStatus === "active") {
        await User.update(
          {
            active_plan_id: planId,
            current_subscription_id: subscriberRecord.id,
            stripe_subscription_id: null
          },
          { where: { id: userId } }
        );

        return sendResponse(res,"Subscription activated successfully (Manual Loop)",200,{
          subscriptionId: subscriberRecord.id,
          status: "active"
        });
      } else {
        return sendResponse(res,"Next subscription plan scheduled in queue successfully",200,{
          subscriptionId: subscriberRecord.id,
          status: "scheduled",
          activationDate: startDate
        });
      }
    }


    const orderId = session.metadata.order_id;
    const userId = session.metadata.user_id;
    // const cartIds = JSON.parse(session.metadata.cart_id);
    // const metadata = session.metadata;

    let cartIds = null;
    let isReorder = metadata.is_reorder === "true";

    if(isReorder) {
      const oldOrderId = metadata.order_id;
      console.log("Processing Reorder for Order ID:",oldOrderId);
      cartIds = [];
    } else {
      try {
        cartIds = metadata.cart_id ? JSON.parse(metadata.cart_id) : [];
      } catch(e) {
        cartIds = [];
      }
    }

    const order = await Order.findByPk(orderId);
    if(!order) throw new CoustomError("Order not found",404);

    const invoiceUrl = session.invoice
      ? session.invoice.hosted_invoice_url
      : null;
    const invoiceId =
      session.invoice?.id ||
      (typeof session.invoice === "string" ? session.invoice : null);

    if(session.payment_status === "paid") {
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
      if(userData) await userData.increment("orders",{ by: 1 });

      if(!isReorder && cartIds.length > 0) {
        await Cart.destroy({ where: { id: cartIds,user_id: userId } });
      }

      try {
        const bambiniResponse = await createOrder(orderId,userData);

        if(bambiniResponse.status) {
          await order.update({
            retailer_order_id: bambiniResponse.order_id,
            retailer_status: "Success",
          });
          console.log("Bambini Order Placed:",bambiniResponse.order_id);
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
      } catch(bambiniErr) {
        await order.update({
          retailer_status: "Failed",
          retailer_error_log: bambiniErr.message,
        });
        console.error("Bambini API Error:",bambiniErr);
      }

      return sendResponse(res,"Order placed successfully",200,{
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
  } catch(error) {
    console.error("Verification Error:",error);
    next(error);
  }
};

const generateAvatar = async (req,res,next) => {
  try {
    if(!req.file) {
      return res.status(400).json({ message: "Please upload an image file." });
    }

    const width = 250;
    const radius = width / 2;

    const circleMask = Buffer.from(
      `<svg width="${width}" height="${width}">
        <circle cx="${radius}" cy="${radius}" r="${radius}" fill="black" />
      </svg>`,
    );
    console.log("circleMask",circleMask);
    const processedImageBuffer = await sharp(req.file.buffer)
      .resize(width,width,{
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
    console.log("processedImageBuffer",processedImageBuffer);
    const base64Avatar = processedImageBuffer.toString("base64");
    const imageData = `data:image/png;base64,${base64Avatar}`;
    res.status(200).json({
      success: true,
      message: "Avatar generated successfully",
      avatar: imageData,
    });
  } catch(error) {
    console.error("Avatar Generation Error:",error);
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

const buyAgain = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { id,type } = req.body;

    let productIds = [];
    let baseOrderData = null;

    if(type === "order") {
      const orderData = await Order.findOne({
        where: { id: id,user_id: user_id },
        include: [
          {
            model: Address,
            as: "order_address",
            attributes: { exclude: ["createdAt","updatedAt"] },
          },
        ],
      });

      if(!orderData) throw new CoustomError("Order not found",404);
      const items =
        typeof orderData.items === "string"
          ? JSON.parse(orderData.items)
          : orderData.items;
      productIds = items.map((item) => item.product_id);
      baseOrderData = orderData;
    } else if(type === "product") {
      productIds = [id];
    } else {
      throw new CoustomError("Invalid type provided",400);
    }
    if(productIds.length === 0)
      throw new CoustomError("No products found to buy",400);

    const products = await Product.findAll({ where: { id: productIds } });

    const formattedProducts = await Promise.all(
      products.map((p) => getCalculatedProducts({ user_id,product_id: p.id })),
    );

    const defaultAddress = await Address.findOne({
      where: { user_id,is_default: 1 },
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
          baseOrderData?.order_address?.id ?? defaultAddress?.id ?? null,
      }
      : {
        shipping_address: fullAddressText,
        total_amount: `${formattedProducts[0].sale_price}`,
        shipping_address_id:
          baseOrderData?.order_address?.id ?? defaultAddress?.id ?? null,
      };

    sendResponse(res,"Data fetched successfully",200,{
      orders: formattedOrderData,
      products: formattedProducts,
    });
  } catch(error) {
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

const createReorderCheckoutSession = async (req,res,next) => {
  try {
    const { id,shipping_address_id,productList } = req.body;
    const userId = req.user.id;
    let products = productList;
    // console.log("products", products);
    let itemsToProcess = [];
    let oldOrder = null;

    if(id && Number(id) > 0) {
      oldOrder = await Order.findOne({
        where: { id: id,user_id: userId },
        include: [{ model: Address,as: "order_address" }],
      });

      if(!oldOrder) throw new CoustomError("Original order not found",404);

      itemsToProcess =
        products && products.length > 0
          ? products
          : typeof oldOrder.items === "string"
            ? JSON.parse(oldOrder.items)
            : oldOrder.items;
    } else if(products && products.length > 0) {
      itemsToProcess = products;
    } else {
      throw new CoustomError(
        "Please provide an Order ID or Products to checkout",
        400,
      );
    }

    // --- Price Calculation (Generic for both cases) ---
    const productIds = itemsToProcess.map((item) => item.id || item.product_id);
    console.log("productIds",productIds);
    const productDetailsList = await getCalculatedProducts({
      user_id: userId,
      product_id: productIds,
    });

    const itemsList = itemsToProcess.map((item) => {
      const pId = item.id || item.product_id;
      // console.log(object)
      const latestData = productDetailsList.find((p) => p.id == pId);
      if(!latestData)
        throw new CoustomError(`Product ${pId} is not available`,400);
      return {
        product_id: pId,
        product_name: latestData.product_name,
        quantity: item.quantity || 1,
        price: latestData.sale_price,
        subtotal: latestData.sale_price * (item.quantity || 1),
        actual_price: latestData.actual_price,
      };
    });

    // --- Address Handling ---
    let fullAddressText = null;
    let finalAddressId = shipping_address_id;

    if(shipping_address_id) {
      const addressData = await Address.findOne({
        where: { user_id: userId,id: shipping_address_id },
      });
      if(!addressData)
        throw new CoustomError("This shipping address is not found",404);

      if(addressData) {
        fullAddressText = `${addressData.street_address}, ${addressData.apartment ? addressData.apartment + ", " : ""}${addressData.city}, ${addressData.state} - ${addressData.zip_code}`;
      }
    } else if(oldOrder && oldOrder.order_address) {
      const addr = oldOrder.order_address;
      fullAddressText = `${addr.street_address}, ${addr.apartment ? addr.apartment + ", " : ""}${addr.city}, ${addr.state} - ${addr.zip_code}`;
      finalAddressId = oldOrder.order_address.id;
    } else {
      const defaultAddr = await Address.findOne({
        where: { user_id: userId,is_default: 1 },
      });
      if(!defaultAddr)
        throw new CoustomError("Default shipping address is required",400);
      if(defaultAddr) {
        fullAddressText = `${defaultAddr.street_address}, ${defaultAddr.city} - ${defaultAddr.zip_code}`;
        finalAddressId = defaultAddr.id;
      }
    }
    if(!fullAddressText)
      throw new CoustomError("Shipping address is required",400);

    const totalAmount = itemsList.reduce((sum,item) => sum + item.subtotal,0);
    const totalQty = itemsList.reduce((sum,item) => sum + item.quantity,0);
    if(totalAmount < 0.5)
      throw new CoustomError("Minimum amount is $0.50",400);

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
      cancel_url: `https://mern.yilstaging.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    });

    sendResponse(res,"Checkout session created",200,{ url: session.url });
  } catch(error) {
    next(error);
  }
};

const getAllOrders = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const orders = await Order.findAll({
      where: { user_id },
      order: [["order_date","DESC"]],
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
    sendResponse(res,"Orders fetched successfully",200,{
      orders: formattedOrders,
    });
  } catch(error) {
    next(error);
  }
};

const fetchOrderDetails = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { id } = req.body;

    const order = await Order.findOne({
      where: { id,user_id },
      attributes: {
        exclude: ["createdAt","updatedAt","user_id"],
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
          attributes: { exclude: ["createdAt","updatedAt"] },
        },
      ],
      raw: true,
      nest: true,
    });
    if(!order) {
      throw new CoustomError("Order not found",404);
    }
    const items =
      typeof order.items === "string" ? JSON.parse(order.items) : order.items;

    const productIds = items.map((item) => item.product_id);
    const products = await getCalculatedProducts({
      user_id,
      product_id: productIds,
    });

    const formattedProducts = items.map((item) => {
      const pData = products.find((p) => p.id === item.product_id);
      // console.log("pData", pData);
      return {
        product_name: pData?.product_name || "Product",
        color: pData.color || "N/A",
        size: pData.size || "N/A",
        sale_price: `${parseFloat(item.price || 0)}`,
        actual_price: `${parseFloat(item?.actual_price || 0)}`,
        quantity: item.quntaty || item.quantity || 1,
        product_images: pData?.product_images || "",
        discount_percentage: pData.discount_applied,
      };
    });

    const totalItemsCount = formattedProducts.reduce(
      (acc,curr) => acc + curr.quantity,
      0,
    );
    const totalItemsPrice = formattedProducts.reduce(
      (acc,curr) => acc + curr.sale_price * curr.quantity,
      0,
    );

    const totalItemsPriceForDiscount = formattedProducts.reduce(
      (acc,curr) => acc + curr.actual_price * curr.quantity,
      0,
    );

    const formatedOrder = formattedProducts.map((p) => {
      return {
        ...p,
        product_name: p.product_name,
        actual_price: `${Number(p.actual_price) * p.quantity}`,
        color: undefined,
        size: undefined,
        product_images: undefined,
        discount_percentage: undefined,
        sale_price: undefined,
      };
    });

    const grandTotal = formatedOrder.reduce((acc,cur) => {
      return acc + Number(cur.actual_price);
    },0);

    const orderSummary = {
      item_sum: formatedOrder,
      item_total: `${grandTotal}`,
    };

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
    const finalData = {
      id: order.id,
      order_id: order.order_id,
      status: order.order_status,
      invoice_url: order.transaction.invoice_url,
      order_date: orderDateObj.toISOString().split("T")[0],
      order_time: orderDateObj.toLocaleTimeString([],{
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),

      products: formattedProducts,

      items_order: orderSummary,

      price_breakdown: {
        actual_amount: `${grandTotal}`,
        discount: `${parseFloat(formattedProducts[0].discount_percentage || 0)}%`,
        discount_amount: `${(
          totalItemsPriceForDiscount *
          (parseFloat(formattedProducts[0].discount_percentage || 0) / 100)
        ).toFixed(2)}`,
        // delivery_charges: parseFloat(order.delivery_charges || 0),
        final_amount: `${parseFloat(order.total_amount)}`,
        currency: "USD",
      },

      delivery_address: delivery_address,
      payment_method: order.payment_method || "N/A",
      tracking_url: "https://mern.yilstaging.com/" || null,
    };

    sendResponse(res,"Order summary fetched successfully",200,finalData);

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
  } catch(error) {
    next(error);
  }
};

const cancelMyOrder = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { id,reason,cancellation_comment } = req.body;
    const order = await Order.findOne({
      where: {
        id,
        user_id,
        order_status: "Placed",
      },
    });
    if(!order) {
      throw new CoustomError("Order not found or cannot be cancelled",404);
    }
    await order.update({
      is_cancelled: 1,
      order_status: "Cancelled",
      reason: reason || "No reason provided",
      cancellation_comment: cancellation_comment || "No comment provided",
    });
    sendResponse(res,"Order cancelled successfully",200);
  } catch(error) {
    next(error);
  }
};

const getAllCountryCode = async (req,res,next) => {
  try {
    const countries = Country.getAllCountries().map((c) => ({
      name: c.name,
      isoCode: c.isoCode,
    }));

    sendResponse(res,"Fetching all country list",200,{
      countries,
    });
  } catch(error) {
    next(error);
  }
};

const getAllStateCode = async (req,res,next) => {
  try {
    const { country_code } = req.body; // Example: "IN", "US"
    // console.log("country_code", country_code);
    if(!country_code) {
      return res.status(400).json({ message: "Country Code is required" });
    }

    const states = State.getStatesOfCountry(country_code).map((s) => ({
      name: s.name,
      isoCode: s.isoCode,
    }));
    // console.log("states", states);
    sendResponse(res,"Order cancelled successfully",200,{
      states: states,
    });
  } catch(error) {
    next(error);
  }
};

const allProduct = async (req,res,next) => {
  try {
    const allPro = await Product.findAll({
      where: {
        sale_price: {
          [Op.gt]: 0,
        },
      },
    });
    sendResponse(res,"",200,allPro);
  } catch(error) {
    next(error);
  }
};

const getRecommendedProduct = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const { image_width,image_height,landmarks } = req.body;
    const allProduct = await Product.findAll({
      where: {
        sale_price: {
          [Op.gt]: 0,
        },
      },
    });
    const allSize = await Size.findAll();

    const predictedProduct = await axios.post(
      // "http://localhost:5000/api/predict-size",
      process.env.SIZE_PREDICTION_SERVICE_URL,
      {
        image_width,
        image_height,
        landmarks,
        products: allProduct,
        productSize: allSize,
      },
    );
    if(!predictedProduct) {
      throw new CoustomError("there is an error through ai",400);
    }

    // console.log("predictedProduct", predictedProduct.data.data.products);
    const productData = predictedProduct.data.data.products;
    const productIds = [...new Set(productData.map((item) => item.id))];
    const productsWithPrices = await getCalculatedProducts({
      product_id: productIds,
      // user_id,
    });
    sendResponse(res,"Featched all the product",200,productsWithPrices);
  } catch(error) {
    console.log("Error ",error)
    next(error);
  }
};

const generateBabyTryOn = async (req,res,next) => {
  try {
    const product_id = req.body.id;
    const { id } = req.user;
    const isSubScribed = await Subscriber.findOne({
      where: {
        user_id: id
      }
    });

    if(!isSubScribed) throw new CoustomError("You don't have a subscription to use this features. Please subscribe first",400)
    const userData = await User.findOne({
      where: {
        id,
        is_active: 1,
        is_delete: 0
      }
    })

    if(userData.scan_token < 0) throw new CoustomError("You don't have enough token for scan or use this features!",400)

    let baby_img_url
    let BabyProfileData
    let garment_url
    if(userData) {
      if(userData.selected_baby) {
        BabyProfileData = await BabyProfile.findOne({
          where: {
            user_id: userData.id,
            id: userData.selected_baby
          }
        });
        if(!BabyProfileData) {
          throw new CoustomError(`You don't have the baby to applay this garment`,400)
        }
        if(!BabyProfileData?.baby_profile_image) {
          throw new CoustomError("You don't have a image of this baby",400)
        }
        baby_img_url = `${process.env.BACKEND_URL}/baby-image/${BabyProfileData.baby_profile_image}`
        const productData = await Product.findOne({
          where: {
            id: product_id
          }
        });
        let formattedImages = [];
        try {
          formattedImages =
            typeof productData.product_images === "string"
              ? JSON.parse(productData.product_images || "[]")
              : productData.product_images || [];
        } catch(e) {
          formattedImages = [];
        }
        if(formattedImages.length < 0) {
          throw new CoustomError('Product image not found',400)
        }
        garment_url = formattedImages[0]
      } else {
        throw new CoustomError('Please add or select the baby first for use try-on feature',400)
      }
    } else {
      throw new CoustomError('User not found!',404)
    }

    console.log("Downloading and converting images...");
    const [babyBase64,garmentBase64] = await Promise.all([
      getBase64FromUrl(baby_img_url),
      getBase64FromUrl(garment_url,{
        "x-app-id": "BabyAiApp-Frontend-v1",
      }),
    ]);

    // const BASE_URL = "https://api.fashn.ai/v1";
    const BASE_URL = process.env.FASHN_AI_BASE_URL;
    const inputData = {
      model_name: "tryon-max",
      inputs: {
        model_image: babyBase64,
        product_image: garmentBase64,
        generation_mode: "balanced",
        // resolution: "4k",
        return_base64: true
      },
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FASHN_API_KEY}`,
    };
    let outputimage;
    try {

      // const runResponse = await fetch(`${BASE_URL}/run`, {
      //   method: "POST",
      //   headers: headers,
      //   body: JSON.stringify(inputData),
      // });
      let runResponse = {};
      const runData = await runResponse.json();
      console.log("runData",runData);
      const predictionId = runData.id;
      console.log("Prediction started, ID:",predictionId);
      while(true) {
        const statusResponse = await fetch(
          `${BASE_URL}/status/${predictionId}`,
          {
            headers: headers,
          },
        );
        const statusData = await statusResponse.json();
        outputimage = statusData;
        if(statusData.status === "completed") {
          console.log("Prediction completed.");
          // console.log(statusData.output);
          outputimage = statusData;
          if(statusData.output && statusData.output[0]) {
            const savedFileName = saveOutputImage(statusData.output[0],'baby-tryon',userData.id,userData.selected_baby,product_id);
            if(savedFileName) {
              outputimage.saved_filename = savedFileName;
            }
          }
          break;
        } else if(
          ["starting","in_queue","processing"].includes(statusData.status)
        ) {
          console.log("Prediction status:",statusData.status);
          // outputimage = statusData;
          await new Promise((resolve) => setTimeout(resolve,3000));
        } else {
          console.log("Prediction failed:",statusData.error);
          outputimage = statusData;
          break;
        }
        console.log("statusData",statusData);
      }
    } catch(error) {
      console.error("Error:",error.message);
    }

    sendResponse(res,"Your try on is genrated now",200);
  } catch(error) {
    next(error);
  }
};

const allFitingRoomProduct = async (req,res,next) => {
  try {
    const { id } = req.user
    const userData = await User.findOne({
      where: {
        id
      },
      attributes: [
        "selected_baby"
      ]
    })
    if(userData.selected_baby == 0) {
      throw new CoustomError('Please select your baby first',400)
    }

    const BabyDataForRes = await BabyProfile.findAll({
      where: {
        user_id: id,
      },
      attributes: ["id","baby_profile_image"],
      raw: true,
    });

    const formattedBabyData = BabyDataForRes.map((baby) => {
      return {
        ...baby,
        baby_profile_image: baby.baby_profile_image
          ? baby.baby_profile_image.startsWith("http")
            ? baby.baby_profile_image
            : `${process.env.BACKEND_URL}/baby-image/${baby.baby_profile_image}`
          : null,

        selected: userData && userData.selected_baby && String(baby.id) === String(userData.selected_baby)
          ? true
          : false,
      };
    });

    const tryOnRecords = await BabyTRYON.findAll({
      where: {
        try_on_baby_id: userData.selected_baby,
      },
      include: [
        {
          model: Product,
          as: "tryOnProducts",
        }
      ],
      order: [['createdAt','DESC']],
    });

    const productIds = tryOnRecords.map((record) => {
      return record.try_on_product_id;
    });
    const productsWithPrices = await Promise.all(
      productIds.map(async (pId) => {
        return await getCalculatedProducts({
          product_id: pId,
          user_id: userData.id,
        });
      }),
    );

    const formattedTryOnProducts = tryOnRecords.map((record) => {
      const productPriceDetails = productsWithPrices.find(
        (p) => p && String(p.id) === String(record.try_on_product_id)
      );
      const isOutOfStock = !productPriceDetails || productPriceDetails.stock_count <= 0;
      const tryOnImage = record.try_on_avtar
        ? record.try_on_avtar.startsWith("http")
          ? record.try_on_avtar
          : `${process.env.BACKEND_URL}/baby-try-on-image/${record.try_on_avtar}`
        : null;

      return {
        ...(productPriceDetails || {}),
        try_on_product_avatar: tryOnImage,
        try_on_id: record.id,
        product_status: isOutOfStock ? "Item Out of Stock" : "In Stock",
        product_id: record.product_id,
      };
    });
    sendResponse(res,"Here is fiting room data",200,{
      formattedBabyData,
      formattedTryOnProducts,
    })
  } catch(error) {
    next(error)
  }
}

const removeFromFitingRoom = async (req,res,next) => {
  try {
    const { id } = req.user
    const { try_on_id } = req.body
    if(!try_on_id) throw new CoustomError('Please provide the id for remove',400)
    const record = await BabyTRYON.findOne({
      where: {
        id: try_on_id,
        try_on_user_id: id
      }
    });

    if(!record) throw new CoustomError('Baby avatar not found',400)
    await record.destroy();

    if(record.try_on_avtar) {
      const filePath = path.join(__dirname,'../../../files/uploads',record.try_on_avtar);
      try {
        await fs.unlink(filePath);
        console.log(`File deleted successfully: ${filePath}`);
      } catch(fileError) {
        console.error("Database record deleted, but failed to delete physical file:",fileError.message);
        next(fileError)
      }
    }

    sendResponse(res,"The baby avatar has been deleted now",200,1);
  } catch(error) {
    next(error)
  }
}

const getOrder = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const orderId = req.body.id;
    const userData = await User.findByPk(user_id);
    const order = await createOrder(orderId,userData);
    sendResponse(res,"Bambini order response",200,order);
  } catch(error) {
    next(error);
  }
};

const trackOrderC = async (req,res,next) => {
  try {
    const user_id = req.user.id;
    const orderId = req.body.id;
    const ordertracking = await trackOrder();
    sendResponse(res,"Bambini order tracking response",200,ordertracking);
  } catch(error) {
    next(error);
  }
};

const generateBabyTryOnModal = async (req,res,next) => {
  const tempDownloadedPath = `files/uploads/downloaded-${Date.now()}.jpg`;
  const compressedPath = `files/uploads/compressed-${Date.now()}.jpg`;

  try {
    const prompt = req.body.prompt;
    const productId = req.body.id;
    if(!productId) {
      throw new CoustomError("Product ID (productId) is required to fetch the garment image.",400)
    }

    const idCreated = await ProductAIImage.findOne({
      where: {
        product_id: productId
      }
    });

    if(idCreated) {
      throw new CoustomError("It's already created now",400)
    }
    const productData = await Product.findOne({
      where: { id: productId }
    });

    if(!productData) {
      return res.status(404).json({
        success: false,
        error: `Product with ID ${productId} not found.`
      });
    }

    let formattedImages = [];
    try {
      formattedImages = typeof productData.product_images === "string"
        ? JSON.parse(productData.product_images || "[]")
        : productData.product_images || [];
    } catch(e) {
      formattedImages = [];
    }

    if(formattedImages.length === 0) {
      throw new CoustomError("Product image URL not found in database records.",404)
    }

    const garment_url = formattedImages[0];
    const getImageData = await getBase64FromUrl(garment_url,{
      "x-app-id": "BabyAiApp-Frontend-v1",
    });

    if(!getImageData) {
      throw new Error("Failed to fetch image data from the third-party URL.");
    }

    const cleanBase64 = getImageData.replace(/^data:image\/\w+;base64,/,"");
    fs1.writeFileSync(tempDownloadedPath,cleanBase64,'base64');
    await sharp(tempDownloadedPath)
      .resize(1024,1024)
      .jpeg({ quality: 70 })
      .toFile(compressedPath);

    if(fs1.existsSync(tempDownloadedPath)) fs1.unlinkSync(tempDownloadedPath);

    const BABY_PROMPT = `
      Cute baby girl wearing uploaded dress.
      Standing pose.
      White background.
    `;

    const fileBuffer = fs1.readFileSync(compressedPath);
    const imageFile = await OpenAI.toFile(
      fileBuffer,
      "dress.jpg",
      { type: "image/jpeg" }
    );

    const result = await client.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: BABY_PROMPT || prompt,
      size: "1024x1024",
      n: 1,
    });

    if(fs1.existsSync(compressedPath)) fs1.unlinkSync(compressedPath);
    const b64Data = result.data[0].b64_json;
    if(!b64Data) {
      throw new Error("The result isn't generated now please try again");
    }

    const savedFileName = `output-${Date.now()}.png`;
    const savedFilePath = path.join(__dirname,'../../../files/avtarClothImage',savedFileName);
    fs1.writeFileSync(savedFilePath,b64Data,'base64');
    console.log("Image successfully saved at:",savedFilePath);
    const relativeImagePath = `${savedFileName}`;

    const newImg = await ProductAIImage.create({
      ai_image: relativeImagePath,
      prompt_used: BABY_PROMPT || prompt,
      product_id: productId
    });

    sendResponse(res,"Image has been created now",201,{
      imageName: savedFileName,
      savedPath: savedFilePath,
      dbRecord: newImg,
      response: result,
    })

  } catch(error) {
    console.error("Error inside generateBabyTryOnModal:",error);
    if(fs1.existsSync(tempDownloadedPath)) {
      try { fs1.unlinkSync(tempDownloadedPath); } catch(e) {}
    }
    if(fs1.existsSync(compressedPath)) {
      try { fs1.unlinkSync(compressedPath); } catch(e) {}
    }
    next(error)
  }
};

// const genrateSingleImage = async (req, res, next) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "Image is required",
//       });
//     }

//     console.log(req.file);

//     const imagePath = req.file.path;

//     const generatedFolder = path.join(
//       process.cwd(),
//       "uploads/generated"
//     );
//     if (!fs.existsSync(generatedFolder)) {
//       fs.mkdirSync(generatedFolder, {
//         recursive: true,
//       });
//     }
//     const outputFile = path.join(
//       generatedFolder,
//       `product_1_${Date.now()}.png`
//     );
//     const imageStream = fs.createReadStream(imagePath);

//     function saveBase64Image(base64String) {
//       const uploadDir = path.join(process.cwd(), "uploads");

//       if (!fs.existsSync(uploadDir)) {
//         fs.mkdirSync(uploadDir, { recursive: true });
//       }

//       const fileName = `image_${Date.now()}.png`;

//       const filePath = path.join(uploadDir, fileName);

//       const base64Data = base64String.replace(
//         /^data:image\/\w+;base64,/,
//         ""
//       );

//       fs.writeFileSync(filePath, base64Data, "base64");

//       return filePath;
//     }



//     const response = await client.chat.completions.create({
//       model: "gpt-4o",
//       messages: [
//         {
//           role: "user",
//           content: [
//             {
//               type: "text",
//               text: `
// Identify all products in this image.
// Return JSON only.

// Example:
// [
//  {
//    "name":"Pink Bodysuit",
//    "x":100,
//    "y":50,
//    "width":500,
//    "height":600
//  }
// ]
// `
//             },
//             {
//               type: "image_url",
//               image_url: {
//                 url: IMAGE_URL
//               }
//             }
//           ]
//         }
//       ]
//     });

//     console.log(response.choices[0].message.content);

//   } catch (error) {
//     next(error)
//   }
// }


// const genrateSingleImage = async (req, res, next) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "Image is required",
//       });
//     }


//     const imagePath = req.file.path;
//     console.log("imagePath", imagePath)
//     const generatedFolder = path.join(
//       process.cwd(),
//       "uploads/generated"
//     );

//     if (!fs1.existsSync(generatedFolder)) {
//       fs1.mkdirSync(generatedFolder, {
//         recursive: true,
//       });
//     }
//     console.log("generatedFolder", generatedFolder)
//     const imageBuffer = fs1.readFileSync(imagePath);
//     const base64Image = imageBuffer.toString("base64");

//     const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;
//     // console.log("dataUrl", dataUrl)
//     // STEP 1 - Detect products
//     const visionResponse =
//       await client.chat.completions.create({
//         model: "gpt-4o",
//         response_format: {
//           type: "json_object",
//         },
//         messages: [
//           {
//             role: "user",
//             content: [
//               {
//                 type: "text",
//                 text: `You are an ecommerce product detection system.

// Analyze the image and identify EVERY visible product separately.

// Rules:

// 1. Never group multiple products into a set, bundle, collection, or outfit.
// 2. Every visible clothing item must be returned as its own object.
// 3. If 3 products are visible, return exactly 3 objects.
// 4. If 4 products are visible, return exactly 4 objects.
// 5. Ignore packaging, labels, tags, shadows and background.
// 6. Focus only on actual wearable products.
// 7. Estimate bounding boxes that fully contain the product.
// 8. Include extra margin around sleeves, collars and edges.
// 9. Do not crop tightly.
// 10. Do not return overlapping products as a single object.

// Return JSON only.

// {
//   "products": [
//     {
//       "name": "Pink Bodysuit",
//       "color": "Pink",
//       "description": "Long sleeve baby bodysuit",
//       "x": 0,
//       "y": 0,
//       "width": 0,
//       "height": 0
//     }
//   ]
// }

// `,
//               },
//               {
//                 type: "image_url",
//                 image_url: {
//                   url: dataUrl,
//                 },
//               },
//             ],
//           },
//         ],
//       });

//     console.log("visionResponse", JSON.parse(visionResponse.choices[0].message.content))

//     const parsedData = JSON.parse(
//       visionResponse.choices[0].message.content
//     );

//     const generatedImages = [];

//     const metadata = await sharp(imagePath).metadata();
//     const width = metadata.width;
//     const height = metadata.height;

//     for (
//       let i = 0;
//       i < parsedData.products.length;
//       i++
//     ) {
//       const product =
//         parsedData.products[i];
//       console.log("parsedData", parsedData.products[i])
//       // STEP 2 - Crop Product
//       const croppedImagePath = path.join(
//         generatedFolder,
//         `crop_${i + 1}.png`
//       );

//       const left = Math.round((product.x / 1000) * width);
//       const top = Math.round((product.y / 1000) * height);
//       const cropWidth = Math.round((product.width / 1000) * width);
//       const cropHeight = Math.round((product.height / 1000) * height);

//       await sharp(imagePath)
//         .extract({ left, top, width: cropWidth, height: cropHeight })
//         .png()
//         .toFile(croppedImagePath);

//       const croppedBuffer =
//         fs1.readFileSync(croppedImagePath);

//       const imageFile = new File(
//         [croppedBuffer],
//         `crop_${i + 1}.png`,
//         {
//           type: "image/png",
//         }
//       );


//       // STEP 3 - Edit with OpenAI
//       // const imageResult =
//       //   await client.images.edit({
//       //     model: "gpt-image-1",
//       //     image: fs1.createReadStream(
//       //       croppedImagePath
//       //     ),
//       //     prompt: `Create a professional e- commerce product image.
//       //   Requirements:
//       // * Keep same product
//       // * White background
//       // * Center aligned
//       // * Studio lighting
//       // * High resolution
//       // * Amazon style
//       // * Product only
//       // * Remove all distractions
//       //   `,
//       //   });


//       const imageResult =
//         await client.images.edit({
//           model: "gpt-image-1",
//           image: imageFile,
//           prompt: `
// The uploaded image contains a partially occluded baby bodysuit.
// Reconstruct the hidden areas naturally.

// Use the same fabric texture.
// Use the same pink color.
// Maintain exact garment shape.
// Remove any overlapping garments.
// Create a complete standalone product image.
// White studio background.
// Amazon style ecommerce product photo.

// Create a professional ecommerce product image.

// Important reconstruction rules:

// - Preserve the exact product.
// - Preserve original colors.
// - Preserve original fabric texture.
// - Preserve original print and patterns.

// If any part of the product is hidden, cropped, or covered by another product:

// - Reconstruct the missing area naturally.
// - Continue the existing fabric.
// - Continue the dominant surrounding color.
// - Continue the surrounding pattern.
// - Do not invent a new design.
// - Do not add decorations.
// - Do not change garment shape.
// - Keep symmetry where appropriate.

// Background:
// - Pure white (#FFFFFF)

// Output:
// - Single product only
// - Center aligned
// - Entire product visible
// - Professional ecommerce photography
// - Amazon style
// `
//         });


//       const generatedImageBase64 =
//         imageResult.data[0].b64_json;

//       const finalImagePath = path.join(
//         generatedFolder,
//         `product_${i + 1}_${Date.now()}.png`
//       );

//       fs1.writeFileSync(
//         finalImagePath,
//         Buffer.from(
//           generatedImageBase64,
//           "base64"
//         )
//       );

//       generatedImages.push({
//         name: product.name,
//         image: finalImagePath,
//       });
//     }
//     console.log("generatedImages", generatedImages)
//     return res.status(200).json({
//       success: true,
//       totalProducts:
//         parsedData.products.length,
//       generatedImages,
//     });
//   } catch (error) {
//     console.log(error);
//     next(error);
//   }
// };


// const genrateSingleImage = async (req, res, next) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "Image is required",
//       });
//     }

//     const imagePath = req.file.path;
//     const generatedFolder = path.join(process.cwd(), "uploads/generated");

//     if (!fs1.existsSync(generatedFolder)) {
//       fs1.mkdirSync(generatedFolder, { recursive: true });
//     }

//     const imageBuffer = fs1.readFileSync(imagePath);

//     // Convert current file mimetype to correct Base64 image format
//     let mimeType;
//     if (req.file.mimetype === "image/jpeg" || req.file.mimetype === "image/jpg") {
//       mimeType = "image/jpeg";
//     } else if (req.file.mimetype === "image/png") {
//       mimeType = "image/png";
//     } else {
//       throw new Error("Unsupported image format");
//     }
//     const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

//     //     const visionResponse = await client.chat.completions.create({
//     //       model: "gpt-4o",
//     //       response_format: { type: "json_object" },
//     //       messages: [
//     //         {
//     //           role: "user",
//     //           content: [
//     //             {
//     //               type: "text",
//     //               text: `Detect all long-sleeve baby bodysuits separately.
//     // Ignore sets, bundles, labels, and hidden elements. Every physical garment is one object.
//     // Return JSON with 'products':
//     // [
//     //   {
//     //     "label": "Bodysuit Style",
//     //     "prompt_override": "Detailed description of THIS unique garment's style/pattern",
//     //     "norm_box_2d": [ymin, xmin, ymax, xmax] (0-1000 scale)
//     //   }
//     // ]`,
//     //             },
//     //             { type: "image_url", image_url: { url: dataUrl } },
//     //           ],
//     //         },
//     //       ],
//     //     });

//     const visionResponse = await client.chat.completions.create({
//       model: "gpt-4o",
//       messages: [
//         {
//           role: "user", content: [
//             { type: "text", text: "Identify every clothing item as a separate product. Return accurate normalized [ymin, xmin, ymax, xmax] coordinates." },
//             { type: "image_url", image_url: { url: dataUrl } }
//           ]
//         }
//       ],
//       response_format: { type: "json_object" }
//     });

//     const parsedData = JSON.parse(visionResponse.choices[0].message.content);
//     console.log("visionResponse normalized data:", parsedData.products);

//     const metadata = await sharp(imagePath).metadata();
//     const width = metadata.width;
//     const height = metadata.height;

//     const generatedImages = [];

//     for (let i = 0; i < parsedData.products.length; i++) {
//       const product = parsedData.products[i];
//       const [ymin, xmin, ymax, xmax] = product.norm_box_2d;
//       const left = Math.round((xmin / 1000) * width);
//       const top = Math.round((ymin / 1000) * height);
//       const cropWidth = Math.round(((xmax - xmin) / 1000) * width);
//       const cropHeight = Math.round(((ymax - ymin) / 1000) * height);
//       const safeLeft = Math.max(0, left);
//       const safeTop = Math.max(0, top);
//       const safeWidth = Math.min(cropWidth, width - safeLeft);
//       const safeHeight = Math.min(cropHeight, height - safeTop);

//       console.log(`Processing ${product.label}...`);

//       const croppedImagePath = path.join(generatedFolder, `raw_crop_${i + 1}.png`);

//       await sharp(imagePath)
//         .extract({
//           left: safeLeft,
//           top: safeTop,
//           width: safeWidth,
//           height: safeHeight,
//         })
//         .png()
//         .toFile(croppedImagePath);

//       const croppedBuffer =
//         fs1.readFileSync(croppedImagePath);

//       const imageFile = new File(
//         [croppedBuffer],
//         `raw_crop_${i + 1}.png`,
//         {
//           type: "image/png",
//         }
//       );
//       const imageResult = await client.images.generate({
//         model: "gpt-image-1",
//         // image: imageFile,
//         prompt: `
// Create a professional e-commerce product image for the single long-sleeved baby bodysuit shown partially in the uploaded image.
// Garment Style: ${product.prompt_override || product.label}
// Key Instructions:
// 1. Preserve the fabric texture and patterns of visible areas.
// 2. If any part is hidden (e.g., hidden sleeves, collar), reconstruct them naturally.
// 3. The final product MUST be a COMPLETE, standalone long-sleeved bodysuit.
// 4. Maintain exact color consistency.
// 5. Symmetrical garment shape.
// 6. Pure white background (#FFFFFF).
// 7. Center-aligned product photo.
// 8. Amazon style product photography.
// 9. No sets, other objects, packaging or other garments.`,
//       });

//       const generatedImageBase64 = imageResult.data[0].b64_json;

//       const finalImagePath = path.join(
//         generatedFolder,
//         `clean_product_${i + 1}_${Date.now()}.png`
//       );

//       fs1.writeFileSync(
//         finalImagePath,
//         Buffer.from(generatedImageBase64, "base64")
//       );

//       generatedImages.push({
//         label: product.label,
//         clean_image: finalImagePath,
//       });
//     }

//     console.log("Separation Complete:", generatedImages);
//     return res.status(200).json({
//       success: true,
//       totalProducts: parsedData.products.length,
//       generatedImages,
//     });
//   } catch (error) {
//     console.error("GENERATE SINGLE IMAGE ERROR:", error);
//     next(error);
//   }
// };

const genrateSingleImage = async (req,res,next) => {
  try {
    if(!req.file) {
      return res.status(400).json({ success: false,message: "Image is required" });
    }

    const imagePath = req.file.path;
    const generatedFolder = path.join(process.cwd(),"files/uploads/generated");
    await fs.mkdir(generatedFolder,{ recursive: true });

    const visionResponse = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",text: `Analyze the image. Detect all individual clothing items. 
            Return ONLY a JSON object in this format: 
            { "products": [ { "label": "string", "prompt_override": "string", "norm_box_2d": [ymin, xmin, ymax, xmax] } ] }
            Use 0-1000 scale for coordinates.` },
            { type: "image_url",image_url: { url: `data:${req.file.mimetype};base64,${(await fs.readFile(imagePath)).toString("base64")}` } }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    const parsedData = JSON.parse(visionResponse.choices[0].message.content);
    const metadata = await sharp(imagePath).metadata();
    const generatedImages = [];
    for(const [index,product] of parsedData.products.entries()) {
      try {
        const [ymin,xmin,ymax,xmax] = product.norm_box_2d;
        const croppedImagePath = path.join(generatedFolder,`crop_${Date.now()}_${index}.png`);
        const croppedBuffer = await sharp(imagePath)
          .extract({
            left: Math.round((xmin / 1000) * metadata.width),
            top: Math.round((ymin / 1000) * metadata.height),
            width: Math.round(((xmax - xmin) / 1000) * metadata.width),
            height: Math.round(((ymax - ymin) / 1000) * metadata.height),
          })
          .png()
          .toBuffer()

        await fs.writeFile(croppedImagePath,croppedBuffer);

        const croppedBuffer1 =
          fs1.readFileSync(croppedImagePath);

        const imageFile = new File(
          [croppedBuffer1],
          `crop_${Date.now()}_${index}.png`,
          {
            type: "image/png",
          }
        );

        // Image Generation
        // const imageResult = await client.images.generate({
        //   model: "dall-e-3", // Ensure correct model name
        //   prompt: `Professional e-commerce product photography of a ${product.label}. 
        //   Style: ${product.prompt_override}. 
        //   Isolated on a pure white background, centered, high resolution, studio lighting.`,
        //   size: "1024x1024"
        // });

        const imageResult = await client.images.edit({
          model: "gpt-image-1",
          image: imageFile,
          prompt: `
          Create a high-resolution, professional e-commerce studio photograph of ${product.label}. shown.
          Style: ${product.prompt_override}
          CORE INSTRUCTIONS (Crucial for Accuracy and Repair):
          1. HIGH FIDELITY: Maintain the exact original color, fabric texture, and specific pattern/design visible in the input image. Do NOT invent new colors or patterns.
          2. SMART COMPLETION: The original garment might be partially hidden, folded, or incomplete. Your primary task is to reconstruct and complete the full garment shape (e.g., extend sleeves, complete the collar, finish the torso, complete the crotch area). The final object must be a single, seamless, and symmetrical long-sleeve bodysuit.
          3. PERFECT REPAIR: Smooth out any unnatural folds, wrinkles, or partial obscurations to present the garment in a pristine, "new" condition.
          4. PRESENTATION: Isolate the complete bodysuit on a pure white background (#FFFFFF). Center the product. Use soft, symmetrical studio lighting.
          5. NO ALTERATIONS: The visible pattern must remain identical, just extended logically where the garment was completed.
          `,




          //           prompt: `Professional e-commerce product photograph of a ${product.label}. 
          // STYLE: ${product.prompt_override}.
          // STRICT REQUIREMENTS:
          // 1. CANVAS & FRAMING: The garment must be fully contained within the frame with significant padding (whitespace) on all four sides (top, bottom, left, right). Do NOT crop or cut off any part of the garment; ensure the entire bodysuit is visible with space around the edges.
          // 2. COLOR & TEXTURE FIDELITY: Use the exact color hex code and fabric texture from the source image. Do NOT change, enhance, or filter the colors. Maintain 100% material authenticity.
          // 3. REPAIR & COMPLETION: If the source is incomplete, extend the garment naturally to form a full, symmetrical, long-sleeved bodysuit. Maintain perfect symmetry in the collar, sleeves, and leg openings.
          // 4. BACKGROUND: Pure white (#FFFFFF) background. No shadows, no gradients, no artifacts.
          // 5. POSITIONING: Perfectly centered, eye-level studio shot.
          // 6. NO EXTRA ELEMENTS: Do not add logos, patterns, textures, or items not present in the original input. 
          // 7. HIGH RESOLUTION: Sharp, professional studio lighting with consistent depth of field.`,












          //           prompt: `Create a high-resolution, professional e-commerce studio photograph of ${product.label}.
          // Style: ${product.prompt_override}

          // CORE INSTRUCTIONS:

          // 1. HIGH FIDELITY:
          //    Maintain the exact original color, fabric texture, stitching, material appearance, and pattern/design visible in the source image. Do NOT invent, modify, enhance, replace, or reinterpret any colors, patterns, graphics, or textures.

          // 2. SMART COMPLETION:
          //    The garment may be partially hidden, folded, overlapped, cropped, or incomplete. Reconstruct and complete the full garment shape while preserving its original design. Complete all missing sleeves, shoulders, collar, neckline, torso, side seams, leg openings, cuffs, hems, and closure areas. The final garment must appear naturally manufactured, seamless, symmetrical, and fully finished.

          // 3. PERFECT REPAIR:
          //    Remove folds, wrinkles, distortions, obstructions, overlapping fabric, duplicate fabric sections, and incomplete areas. Present the garment in pristine, brand-new condition while preserving the original fabric characteristics.

          // 4. PRESENTATION:
          //    Isolate the garment on a pure white background (#FFFFFF). Use soft, balanced professional studio lighting. Center the product in a clean catalog-style composition suitable for premium e-commerce listings.

          // 5. PATTERN & FABRIC PRESERVATION:
          //    The visible pattern, print placement, stitching style, trim details, fabric texture, and garment construction must remain identical to the source image. Extend existing patterns naturally into reconstructed areas without introducing any new design elements.

          // COLOR PRESERVATION (CRITICAL):

          // * Preserve the exact original garment color from the source image.
          // * Do not brighten, darken, tint, recolor, saturate, desaturate, enhance, or color-correct the garment.
          // * Light blue must remain the exact same light blue.
          // * Light green must remain the exact same light green.
          // * White, cream, pink, yellow, beige, grey, and all other colors must remain exactly as shown.
          // * The garment must appear to be made from the same fabric and dye lot as the source image.
          // * Color accuracy is more important than visual enhancement.

          // FRAMING REQUIREMENTS (CRITICAL):

          // * The entire garment must be fully visible within the frame.
          // * Do not crop, trim, or cut off any portion of the garment.
          // * Leave consistent white space around all sides of the garment.
          // * Ensure the neckline, shoulders, sleeves, side edges, cuffs, hems, leg openings, and bottom closure areas are completely visible.
          // * Maintain approximately 10–15% padding around the garment.
          // * The garment should occupy approximately 75–85% of the image canvas while remaining fully inside the frame.
          // * Maintain a centered, symmetrical, catalog-style composition.

          // FINAL QUALITY REQUIREMENTS:

          // * Single garment only.
          // * No mannequin.
          // * No baby.
          // * No human model.
          // * No hanger.
          // * No props.
          // * No accessories.
          // * No watermark.
          // * No text overlays.
          // * No duplicate garments.
          // * No background objects.
          // * Clean edges and accurate silhouette.
          // * Professional premium e-commerce product photography quality.

          // CRITICAL FINAL RULE:

          // The generated image must look like the exact same garment shown in the source image, using the same color, fabric, texture, stitching, pattern, and construction details. Only reconstruct missing portions, repair imperfections, and improve presentation quality. Do not redesign, restyle, reinterpret, or recolor the garment under any circumstances.
          // `,



          n: 1,
          size: "1024x1024",
          // response_format: "b64_json",
        });

        const finalImagePath = path.join(generatedFolder,`clean_${Date.now()}_${index}.png`);
        const buffer = Buffer.from(imageResult.data[0].b64_json,"base64");
        await fs.writeFile(finalImagePath,buffer);

        generatedImages.push({ label: product.label,clean_image: finalImagePath });
      } catch(err) {
        console.error(`Error processing item ${index}:`,err);
      }
    }
    return res.status(200).json({ success: true,generatedImages });
  } catch(error) {
    console.error("GENERATE ERROR:",error);
    next(error);
  }
};

module.exports = {
  createCheckoutSessionForSubscription,
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
  searchProduct,
  getAllRecentlySearchedData,
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
  getOrder,
  trackOrderC,
  productCategoryWiseDataPagination,
  generateBabyTryOnModal,
  allFitingRoomProduct,
  removeFromFitingRoom,
  genrateSingleImage
};
