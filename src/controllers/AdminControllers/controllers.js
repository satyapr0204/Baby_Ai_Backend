const Admin = require("../../modals/adminsModal");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendResponse } = require("../../utils/coustomResponse");
const CoustomError = require("../../utils/CoustomError");
const User = require("../../modals/userModal");
const FAQ = require("../../modals/faqModal");
const StaticPage = require("../../modals/staticPageModal");
const BabyProfile = require("../../modals/babyProfileModal");
const { sequelize } = require("../../../dbConfig");
const Category = require("../../modals/ProductModal/category");
const Product = require("../../modals/ProductModal/product");
const Banner = require("../../modals/bannerModal");
const path = require("path");
const { formatDate } = require("../../utils/formatDateHelper");
const fs = require("fs").promises;
const { Op, QueryTypes } = require("sequelize");
const MinAndMax = require("../../modals/minAndMaxModal");
const FlashMessage = require("../../modals/flashMessageModal");
const FlashMessageEnable = require("../../modals/flashMessageEnableModa");
const { calculateSafeMargin } = require("../../utils/calculatePricing");
const Retailer = require("../../modals/ProductModal/retailer");
const Fabric = require("../../modals/ProductModal/fabric");
const Color = require("../../modals/ProductModal/color");
const Plan = require("../../modals/planModal");
const Order = require("../../modals/orderModal");
const Address = require("../../modals/addressModal");
const Transaction = require("../../modals/transactionModal");

const processBabyData = async (data) => {
  if (!data) return data;

  const isArray = Array.isArray(data);
  let rawData = isArray ? data : [data];

  rawData = rawData.map((d) =>
    typeof d.toJSON === "function" ? d.toJSON() : d,
  );

  const isDirectBabyArray =
    rawData.length > 0 && "fabric_preferences" in rawData[0];

  let babiesToProcess = [];
  if (isDirectBabyArray) {
    babiesToProcess = rawData;
  } else {
    rawData.forEach((user) => {
      if (user.babies) babiesToProcess.push(...user.babies);
    });
  }

  let fabricIds = new Set();
  let colorIds = new Set();

  const parseIds = (val) => {
    try {
      const p = typeof val === "string" ? JSON.parse(val || "[]") : val;
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  };

  babiesToProcess.forEach((baby) => {
    parseIds(baby.fabric_preferences).forEach((id) =>
      fabricIds.add(id.toString()),
    );

    parseIds(baby.preferred_colors).forEach((id) =>
      colorIds.add(id.toString()),
    );
  });

  const [fabrics, colors] = await Promise.all([
    fabricIds.size > 0
      ? Fabric.findAll({
          where: { id: Array.from(fabricIds) },
          attributes: ["id", "name"],
        })
      : [],
    colorIds.size > 0
      ? Color.findAll({
          where: { id: Array.from(colorIds) },
          attributes: ["id", "name"],
        })
      : [],
  ]);

  const fabricMap = Object.fromEntries(
    fabrics.map((f) => [f.id.toString(), { id: f.id, name: f.name }]),
  );

  // const colorMap = Object.fromEntries(
  //   colors.map((c) => [c.id.toString(), c.name]),
  // );

  // const colorMap = {};
  // colors.forEach((c) => {
  //   const id = c.id.toString();
  //   colorMap[id] = c.name.split("/").map((s) => s.trim());
  // });

  const colorMap = {};
  colors.forEach((c) => {
    const id = c.id.toString();
    colorMap[id] = c.name.split("/").map((s) => ({
      id: c.id,
      name: s.trim(),
    }));
  });

  babiesToProcess.forEach((baby) => {
    if (
      baby.baby_profile_image &&
      !baby.baby_profile_image.startsWith("http")
    ) {
      baby.baby_profile_image = `${process.env.BACKEND_URL}/baby-image/${baby.baby_profile_image}`;
    }

    const fIds = parseIds(baby.fabric_preferences);

    baby.fabric_preferences = fIds.map((id) => {
      const fabricData = fabricMap[id.toString()];
      return fabricData ? fabricData : { id: id, name: "Unknown" };
    });

    const cIds = parseIds(baby.preferred_colors);
    const allColors = cIds.flatMap((id) => colorMap[id.toString()] || id);
    baby.preferred_colors = [...new Set(allColors)];
  });

  return isArray ? rawData : rawData[0];
};

const adminLogin = async (req, res, next) => {
  try {
    const { email, password, is_login } = req.body;
    if (!email || !password) {
      throw new CoustomError("Email and password are required", 400);
    }
    if (is_login == "1") {
      const admin = await Admin.findOne({ where: { email } });
      if (!admin) throw new CoustomError("Invalid email or password", 401);
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (!admin || !passwordMatch)
        throw new CoustomError("Invalid email or password", 401);
      if (admin.is_delete === 1)
        throw new CoustomError(
          "Your account has been deleted. Please contact support.",
          403,
        );

      const adminInfo = {
        id: admin.id,
        email: admin.email,
        is_admin: admin.is_admin,
      };

      const accessToken = jwt.sign(adminInfo, process.env.JWT_SECRET, {
        expiresIn: "2h",
      });
      return sendResponse(res, "Login successful!", 200, {
        admin: adminInfo,
        accessToken,
      });
    } else {
      const existingAdmin = await Admin.findOne({ where: { email } });
      if (existingAdmin) {
        throw new CoustomError("Email already exists", 400);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const newAdmin = await Admin.create({ email, password: hashedPassword });
      sendResponse(res, "Admin registered successfully!", 201, {
        admin: { id: newAdmin.id, email: newAdmin.email },
      });
    }
  } catch (error) {
    next(error);
  }
};

const updateGlobalStatus = async (req, res, next) => {
  try {
    const { id, type } = req.body;
    const modelMap = {
      faq: FAQ,
      static_page: StaticPage,
      banner: Banner,
      category: Category,
      flash_message: FlashMessage,
      retailer: Retailer,
      plan: Plan,
    };
    const TargetModel = modelMap[type];
    if (!TargetModel) throw new CoustomError(`Invalid type: '${type}'`, 400);
    const record = await TargetModel.findOne({
      where: {
        id,
      },
    });
    if (!record) {
      throw new CoustomError(`${type} not found`, 404);
    }
    await record.update({
      is_active: record.is_active == 1 ? 0 : 1,
    });

    const formattedType = type
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    sendResponse(
      res,
      `${formattedType} has been ${record.is_active == 1 ? "Activted" : "Deactivated"} successfully!`,
      200,
    );
  } catch (error) {
    next(error);
  }
};

const globalDelete = async (req, res, next) => {
  try {
    const { id, type } = req.body;
    const modelMap = {
      faq: FAQ,
      static_page: StaticPage,
      banner: Banner,
      flash_message: FlashMessage,
    };

    const formattedType = type
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const imageFieldsMap = {
      banner: "banner_url",
    };
    const TargetModel = modelMap[type];
    if (!TargetModel) throw new CoustomError(`Invalid type: '${type}'`, 400);
    const record = await TargetModel.findOne({
      where: {
        id,
      },
    });

    if (!record) {
      throw new CoustomError(`${formattedType} not found`, 404);
    }

    if (imageFieldsMap[type]) {
      const columnName = imageFieldsMap[type];
      const imagePath = record[columnName];
      if (imagePath) {
        const fullPath = path.join(__dirname, "../../Banners", imagePath);
        try {
          await fs.access(fullPath);
          await fs.unlink(fullPath);
        } catch (err) {
          console.log("File nahi mili ya delete nahi ho saki", err.message);
        }
      }
    }
    await record.destroy();
    sendResponse(res, `${formattedType} deleted successfully!`, 200);
  } catch (error) {
    next(error);
  }
};

const globleFlashMessageEnable = async (req, res, next) => {
  try {
    const entryId = 1;
    let config = await FlashMessageEnable.findByPk(entryId);

    if (!config) {
      const firstEntry = await FlashMessageEnable.create({
        id: entryId,
        is_enabled: 1,
      });

      return sendResponse(
        res,
        "Flash message setting created and enabled",
        201,
        firstEntry,
      );
    }

    config.is_enabled = config.is_enabled == 1 ? 0 : 1;
    await config.save();

    const statusMsg = config.is_enabled == 1 ? "Enabled" : "Disabled";

    return sendResponse(
      res,
      `Flash message global status updated to: ${statusMsg}`,
      200,
      config,
    );
  } catch (error) {
    next(error);
  }
};

const globleFlashEnableStatus = async (req, res, next) => {
  try {
    const config = await FlashMessageEnable.findByPk(1);
    console.log("config", config);
    sendResponse(
      res,
      "Flash message enable status retrieved successfully!",
      200,
      {
        is_enabled: config.is_enabled ? config.is_enabled : 0,
      },
    );
  } catch (error) {
    next(error);
  }
};

const addAlertMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    const newMessage = await FlashMessage.create({
      message,
      type: "flash",
    });
    sendResponse(res, "Flash message added successfully!", 201, {
      message: newMessage,
    });
  } catch (error) {
    next(error);
  }
};

const fetchAllFlashMessages = async (req, res, next) => {
  try {
    const flashMessages = await FlashMessage.findAll();

    if (flashMessages.length === 0) {
      throw new CoustomError("No flash messages found", 404);
    }

    sendResponse(res, "Flash messages retrieved successfully!", 200, {
      flashMessages: flashMessages,
    });
  } catch (error) {
    next(error);
  }
};

const previewMessage = async (req, res, next) => {
  try {
    const message_id = req.body.id;
    if (!message_id) throw new CoustomError("Message id is required!", 400);
    const message = await FlashMessage.findOne({
      where: { id: message_id },
    });
    if (!message) throw new CoustomError("No message found", 404);
    const settingsMap = {};
    const minMaxSettings = await MinAndMax.findAll();
    minMaxSettings.forEach((s) => {
      settingsMap[s.type] = { min: s.min, max: s.max };
    });
    let messageText = message.message;
    const processedText = messageText.replace(/\{(\w+)\+\}/g, (match, type) => {
      const config = settingsMap[type];
      if (config) {
        const min = Number(config.min);
        const max = Number(config.max);
        const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
        return ` ${randomNum} `;
      }
      return match;
    });
    const finalMessage = {
      ...message.toJSON(),
      message: processedText.replace(/\s+/g, " ").trim(),
    };
    return res.status(200).json({
      status: true,
      data: finalMessage,
    });
  } catch (error) {
    next(error);
  }
};

const addMinMaxTimeCount = async (req, res, next) => {
  try {
    const { min, max, type } = req.body;
    if (!min || !max || !type)
      throw new CoustomError("Min, Max, and Type are required", 400);

    const existingConfig = await MinAndMax.findOne({ where: { type } });
    console.log("existingConfig", existingConfig);
    if (existingConfig) {
      throw new CoustomError(
        `Configuration for '${type}' already exists. Use update instead.`,
        400,
      );
    }

    if (type == "count") {
      if (max < 1 || min < 0 || max < min)
        throw new CoustomError(
          "Min count must be >= 0 and Max count must be >= 1",
          400,
        );
    } else if (type == "time") {
      const timeDifference = max - min;
      if (timeDifference <= 0) {
        throw new CoustomError(
          "Max time must be strictly greater than Min time",
          400,
        );
      }
    } else {
      throw new CoustomError(
        "Invalid type. Type must be either 'time' or 'count'",
        400,
      );
    }

    await MinAndMax.create({ min, max, type });
    sendResponse(res, "Min and Max time/count added successfully!", 200);
  } catch (error) {
    next(error);
  }
};

const updateMinMaxTimeCount = async (req, res, next) => {
  try {
    const { id, min, max, type } = req.body;

    const record = await MinAndMax.findOne({
      where: {
        id,
        type,
      },
    });
    if (!record) {
      throw new CoustomError("Record not found", 404);
    }

    if (min || max) {
      if (type == "count") {
        if (max < 1 || min < 0 || max < min)
          throw new CoustomError(
            "Min count must be >= 0 and Max count must be >= 1",
            400,
          );
      } else if (type == "time") {
        const timeDifference = max - min;
        if (timeDifference <= 0) {
          throw new CoustomError(
            "Max time must be strictly greater than Min time",
            400,
          );
        }
        // const MAX_ALLOWED_TIME = 86400; // seconds mein
        // if (max > MAX_ALLOWED_TIME) {
        //   throw new CoustomError(
        //     "Time duration exceeds maximum limit of 24 hours",
        //     400,
        //   );
        // }
      }
    }

    await record.update({
      min: min ? min : record.min,
      max: max ? max : record.max,
      type,
    });

    sendResponse(res, "Min and Max time/count updated successfully!", 200);
  } catch (error) {
    next(error);
  }
};

const getTimeCountConfig = async (req, res, next) => {
  try {
    const config = await MinAndMax.findAll();
    if (!config) {
      throw new CoustomError("Configuration not found", 404);
    }
    sendResponse(res, "Configuration retrieved successfully!", 200, { config });
  } catch (error) {
    next(error);
  }
};

const allUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      where: {
        is_delete: 0,
      },
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM baby_profiles AS baby
              WHERE
              baby.user_id = User.id
              )`),
            "total_babies_profile",
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
    if (users.length === 0) {
      throw new CoustomError("No users found", 404);
    }
    const userData = await processBabyData(users);
    sendResponse(res, "Users retrieved successfully!", 200, userData);
  } catch (error) {
    next(error);
  }
};

const userDetails = async (req, res, next) => {
  try {
    const { id } = req.body;
    const user = await User.findOne({
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
    if (!user) {
      throw new CoustomError("User not found", 404);
    }

    // const userJson = user.toJSON();
    const userData = await processBabyData(user);

    // if (userJson.babies && userJson.babies.length > 0) {
    //   let fabricIds = new Set();
    //   let colorIds = new Set();

    //   userJson.babies.forEach((baby) => {
    //     const parse = (val) => {
    //       try {
    //         const p = typeof val === "string" ? JSON.parse(val || "[]") : val;
    //         return Array.isArray(p) ? p : [];
    //       } catch (e) {
    //         return [];
    //       }
    //     };
    //     parse(baby.fabric_preferences).forEach((fid) =>
    //       fabricIds.add(fid.toString()),
    //     );
    //     parse(baby.preferred_colors).forEach((cid) =>
    //       colorIds.add(cid.toString()),
    //     );
    //   });

    //   const [fabrics, colors] = await Promise.all([
    //     Fabric.findAll({
    //       where: { id: Array.from(fabricIds) },
    //       attributes: ["id", "name"],
    //     }),
    //     Color.findAll({
    //       where: { id: Array.from(colorIds) },
    //       attributes: ["id", "name"],
    //     }),
    //   ]);

    //   const fabricMap = Object.fromEntries(
    //     fabrics.map((f) => [f.id.toString(), f.name]),
    //   );
    //   const colorMap = Object.fromEntries(
    //     colors.map((c) => [c.id.toString(), c.name]),
    //   );
    //   userJson.babies = userJson.babies.map((baby) => {
    //     if (baby.baby_profile_image) {
    //       baby.baby_profile_image = `${process.env.BACKEND_URL}/baby-image/${baby.baby_profile_image}`;
    //     }
    //     let fIds = [];
    //     try {
    //       fIds =
    //         typeof baby.fabric_preferences === "string"
    //           ? JSON.parse(baby.fabric_preferences || "[]")
    //           : baby.fabric_preferences || [];
    //     } catch (e) {}
    //     baby.fabric_preferences = fIds.map(
    //       (fid) => fabricMap[fid.toString()] || fid,
    //     );

    //     let cIds = [];
    //     try {
    //       cIds =
    //         typeof baby.preferred_colors === "string"
    //           ? JSON.parse(baby.preferred_colors || "[]")
    //           : baby.preferred_colors || [];
    //     } catch (e) {}
    //     baby.preferred_colors = cIds.map(
    //       (cid) => colorMap[cid.toString()] || cid,
    //     );

    //     return baby;
    //   });
    // }

    sendResponse(res, "User details retrieved successfully!", 200, {
      user: userData,
    });
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.body;
    const userData = await User.findOne({
      where: {
        id,
        is_delete: 0,
      },
    });
    if (!userData || userData.is_delete === 1) {
      throw new CoustomError("User not found", 404);
    }
    await userData.update({
      is_active: userData.is_active == 1 ? 0 : 1,
    });
    sendResponse(res, "User status updated successfully!", 200);
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.body;
    const userData = await User.findOne({
      where: {
        id,
        is_delete: 0,
      },
    });
    if (!userData || userData.is_delete === 1) {
      throw new CoustomError("User not found", 404);
    }
    await userData.update({
      is_delete: 1,
    });
    sendResponse(res, "User deleted successfully!", 200);
  } catch (error) {
    next(error);
  }
};

const addFaq = async (req, res, next) => {
  try {
    const { question, answer } = req.body;
    const newFaq = await FAQ.create({
      question,
      answer,
    });
    sendResponse(res, "FAQ added successfully!", 201, { faq: newFaq });
  } catch (error) {
    next(error);
  }
};

const getFaqs = async (req, res, next) => {
  try {
    const { is_admin } = req.user;
    let faqs;
    if (is_admin === 1) {
      faqs = await FAQ.findAll();
    } else {
      faqs = await FAQ.findAll({
        where: {
          is_active: 1,
        },
      });
    }
    if (faqs.length === 0) {
      throw new CoustomError("No FAQs found", 404);
    }
    sendResponse(res, "FAQs retrieved successfully!", 200, { faqs });
  } catch (error) {
    next(error);
  }
};

const faqDetails = async (req, res, next) => {
  try {
    const { id } = req.body;
    const faq = await FAQ.findOne({
      where: {
        id,
      },
    });
    if (!faq) {
      throw new CoustomError("FAQ not found", 404);
    }
    sendResponse(res, "FAQ retrieved successfully!", 200, { faq });
  } catch (error) {
    next(error);
  }
};

const updateFaq = async (req, res, next) => {
  try {
    const { id, question, answer } = req.body;
    const faq = await FAQ.findOne({
      where: {
        id,
      },
    });
    if (!faq) {
      throw new CoustomError("FAQ not found", 404);
    }
    await faq.update({
      question: question ? question : faq.question,
      answer: answer ? answer : faq.answer,
    });
    sendResponse(res, "FAQ updated successfully!", 200, { faq });
  } catch (error) {
    next(error);
  }
};

const deleteFaq = async (req, res, next) => {
  try {
    const { id } = req.body;
    const faq = await FAQ.findOne({
      where: {
        id,
      },
    });
    if (!faq) {
      throw new CoustomError("FAQ not found", 404);
    }
    await faq.destroy();
    sendResponse(res, "FAQ deleted successfully!", 200);
  } catch (error) {
    next(error);
  }
};

const createStaticPage = async (req, res, next) => {
  try {
    const { title, content, key } = req.body;
    const isExistingPage = await StaticPage.findOne({
      where: {
        title,
      },
    });
    if (isExistingPage)
      throw new CoustomError(
        "A static page with this title already exists",
        400,
      );

    const newPage = await StaticPage.create({
      title,
      content,
      key,
    });
    sendResponse(res, "Static page created successfully!", 201, {
      page: newPage,
    });
  } catch (error) {
    next(error);
  }
};

const updateStaticPageData = async (req, res, next) => {
  try {
    const { id, title, content, key } = req.body;
    const page = await StaticPage.findOne({
      where: {
        id,
      },
    });
    if (!page) {
      throw new CoustomError("Static page not found", 404);
    }
    await page.update({
      title: title ? title : page.title,
      content: content ? content : page.content,
      key: key ? key : page.key,
    });

    sendResponse(res, "Static page updated successfully!", 200, { page });
  } catch (error) {
    next(error);
  }
};

const allStaticPages = async (req, res, next) => {
  try {
    const pages = await StaticPage.findAll();
    if (pages.length === 0) {
      throw new CoustomError("No static pages found", 404);
    }
    sendResponse(res, "Static pages retrieved successfully!", 200, { pages });
  } catch (error) {
    next(error);
  }
};

const allCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      attributes: {
        include: [
          [
            sequelize.literal(
              `(SELECT COUNT(*) FROM products AS p WHERE p.category_id = Category.id AND p.sale_price > 0)`,
            ),
            "total_products",
          ],
          [
            sequelize.literal(
              `(SELECT IFNULL(SUM(p.sale_price), 0) FROM products AS p WHERE p.category_id = Category.id)`,
            ),
            "total_cost",
          ],
          [
            sequelize.literal(
              `(SELECT COUNT(*) FROM RetailerCategories AS rc WHERE rc.category_id = Category.id)`,
            ),
            "total_retailers",
          ],
        ],
      },
      include: [
        {
          model: Retailer,
          as: "retailers",
          where: { is_active: 1 },
          required: true,
          attributes: [
            "id",
            "name",
            "addon_percentage",
            "discount",
            "total_margin",
            "selected_categories",
          ],
          through: { attributes: [] },
        },
      ],
      order: [["id", "ASC"]],
    });

    if (!categories || categories.length === 0) {
      throw new CoustomError("No categories found", 404);
    }

    const updatedCategories = categories.map((cat) => {
      const categoryData = cat.toJSON();
      const categoryId = categoryData.id;

      // 1. Check karo retailer valid hai aur flag active hai
      if (categoryData.retailers && categoryData.retailers.length > 0) {
        let retailerSelected = categoryData.retailers[0].selected_categories;

        // JSON parsing logic
        if (typeof retailerSelected === "string") {
          try {
            retailerSelected = JSON.parse(retailerSelected);
          } catch (e) {
            retailerSelected = [];
          }
        }

        const isRetailerValid =
          Array.isArray(retailerSelected) &&
          retailerSelected.includes(categoryId);

        if (
          isRetailerValid &&
          parseInt(categoryData.is_retailor_price_active) === 1
        ) {
          // 2. Existing keys ko retailer ki values se update kar rahe hain
          categoryData.addon_percentage = `${parseFloat(categoryData.retailers[0].addon_percentage)}`;
          categoryData.discount_percentage = `${parseFloat(categoryData.retailers[0].discount)}`;

          const { status, marginPct, marginAmt } = calculateSafeMargin(
            categoryData.total_cost,
            categoryData.addon_percentage,
            categoryData.discount_percentage,
          );

          categoryData.total_margin = `${marginPct || 0}`;
        }
        // Note: Agar condition match nahi hui, toh jo database mein pehle se values hain
        // (categoryData.addon_percentage etc.), wahi rahengi.
      }

      // 3. Purani keys delete kardo aur extra retailer data hata do
      delete categoryData.retailers;
      return categoryData;
    });

    sendResponse(res, "Categories retrieved successfully!", 200, {
      categories: updatedCategories,
    });
  } catch (error) {
    next(error);
  }
};

const resetRetailorPrice = async (req, res, next) => {
  try {
    const { id } = req.body;
    const retailer = await Retailer.findByPk(id);

    if (!retailer) {
      return res.status(404).json({
        status: false,
        message: "Retailer not found",
      });
    }
    let selectedIds = retailer.selected_categories;

    if (typeof selectedIds === "string") {
      try {
        selectedIds = JSON.parse(selectedIds);
      } catch (e) {
        selectedIds = [];
      }
    }
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
      return res.status(400).json({
        status: false,
        message: "No categories selected for this retailer to update",
      });
    }
    const [updatedCount] = await Category.update(
      { is_retailor_price_active: 1 },
      {
        where: {
          id: selectedIds,
        },
      },
    );

    return res.status(200).json({
      status: true,
      message: `Successfully activated retailer price for ${updatedCount} selected categories.`,
      updatedCount,
    });
  } catch (error) {
    console.error("Error in resetRetailorPrice:", error);
    next(error);
  }
};

const categoryDetails = async (req, res, next) => {
  try {
    const { id } = req.body;
    const category = await Category.findOne({
      where: {
        id,
      },
    });
    if (!category) throw new CoustomError("Category not found", 404);
    sendResponse(res, "Category details retrieved successfully!", 200, {
      category,
    });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { id, add_on_percentage, discount } = req.body;
    if (add_on_percentage && isNaN(add_on_percentage)) {
      throw new CoustomError("Add-on percentage must be a valid number", 400);
    }
    if (discount && isNaN(discount)) {
      throw new CoustomError("Discount value must be a valid number", 400);
    }
    const CategoryUpdate = await Category.findOne({
      where: {
        id,
      },
    });
    if (!CategoryUpdate) throw new CoustomError("Category not found", 404);

    const categoryData = await Product.findOne({
      where: { category_id: id },
      attributes: [
        [sequelize.fn("SUM", sequelize.col("sale_price")), "total_cost"],
        [sequelize.fn("COUNT", sequelize.col("id")), "total_items"],
      ],
      raw: true,
    });
    if (!categoryData) throw new CoustomError("Category not found", 404);

    const { status, marginPct, marginAmt } = calculateSafeMargin(
      categoryData.total_cost,
      add_on_percentage,
      discount,
    );
    if (status == "Lost" || marginAmt < 0)
      throw new CoustomError(
        `Price update rejected! This configuration leads to a loss of ${Math.abs(marginAmt).toFixed(2)}. Please reduce the discount or increase the addon.`,
        400,
      );
    await CategoryUpdate.update({
      discount_percentage: discount,
      total_margin: marginPct,
      addon_percentage: add_on_percentage,
      is_retailor_price_active: 0,
    });

    sendResponse(res, "Category updated successfully!", 200, {
      CategoryUpdate,
      marginAmt,
    });
  } catch (error) {
    next(error);
  }
};

const addBanner = async (req, res, next) => {
  try {
    const {
      location,
      priority,
      heading,
      description,
      redirection_link,
      start_offer_date,
      end_offer_date,
      img_url,
    } = req.body;
    console.log("req.body:", req.body);
    let banner_url;
    if (req.file || img_url) {
      banner_url = req.file.filename;
    } else {
      banner_url = null;
    }
    let formattedLink = redirection_link;
    if (formattedLink && !formattedLink.startsWith("/")) {
      formattedLink = `/${formattedLink}`;
    }

    let finalPriority = parseInt(priority);
    if (img_url || isNaN(finalPriority)) {
      const maxPriority = await Banner.max("priority");
      finalPriority = (maxPriority || 0) + 1;
    } else {
      const existingPriority = await Banner.findOne({
        where: { priority: finalPriority },
      });
      if (existingPriority)
        throw new CoustomError(
          "Priority already exists. Please choose a different priority.",
          400,
        );
    }
    const startDate = formatDate(start_offer_date);
    const endDate = formatDate(end_offer_date);
    const newBanner = await Banner.create({
      location,
      banner_url,
      priority: finalPriority,
      heading,
      description,
      redirection_link: formattedLink,
      start_offer_date: startDate,
      end_offer_date: endDate,
    });
    return sendResponse(res, "Banner added successfully!", 201, {
      banner: newBanner,
    });
  } catch (error) {
    if (req.file) {
      await fs.unlink(req.file.path);
    }
    next(error);
  }
};

const updateBanner = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      id,
      location,
      priority,
      heading,
      description,
      redirection_link,
      start_offer_date,
      end_offer_date,
    } = req.body;

    const banner = await Banner.findOne({
      where: { id },
    });

    if (!banner) {
      if (req.file) await fs.unlink(req.file.path);
      throw new CoustomError("Banner not found", 404);
    }

    const oldPriority = banner.priority;
    const newPriority = priority ? parseInt(priority) : oldPriority;
    const oldBannerPath = banner.banner_url;
    const newBannerUrl = req.file ? req.file.filename : banner.banner_url;

    if (!isNaN(newPriority) && newPriority !== oldPriority) {
      const isPriorityOccupied = await Banner.findOne({
        where: { priority: newPriority, id: { [Op.ne]: id } },
      });
      if (isPriorityOccupied) {
        if (newPriority > oldPriority) {
          await Banner.decrement("priority", {
            where: {
              priority: { [Op.gt]: oldPriority, [Op.lte]: newPriority },
            },
            transaction,
          });
        } else {
          await Banner.increment("priority", {
            where: {
              priority: { [Op.gte]: newPriority, [Op.lt]: oldPriority },
            },
            transaction,
          });
        }
      }
    }

    const formattedStartDate = start_offer_date
      ? formatDate(start_offer_date)
      : banner.start_offer_date;
    const formattedEndDate = end_offer_date
      ? formatDate(end_offer_date)
      : banner.end_offer_date;

    let formattedLink = redirection_link || banner.redirection_link;
    if (formattedLink && !formattedLink.startsWith("/")) {
      formattedLink = `/${formattedLink}`;
    }

    await banner.update(
      {
        location: location || banner.location,
        priority: newPriority,
        heading: heading || banner.heading,
        description: description || banner.description,
        redirection_link: formattedLink,
        start_offer_date: formattedStartDate,
        end_offer_date: formattedEndDate,
        banner_url: newBannerUrl,
      },
      { transaction },
    );

    await transaction.commit();

    if (req.file && oldBannerPath) {
      const fullPath = path.join(__dirname, "../../Banners", oldBannerPath);
      await fs
        .access(fullPath)
        .then(() => fs.unlink(fullPath))
        .catch(() => console.log("Old file not found or already deleted"));
    }
    sendResponse(res, "Banner updated successfully with priority shift!", 200, {
      banner,
    });
  } catch (error) {
    await transaction.rollback();
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    next(error);
  }
};

const allBanners = async (req, res, next) => {
  try {
    const banners = await Banner.findAll();
    if (banners.length === 0) {
      throw new CoustomError("No banners found", 404);
    }
    const allBanners = banners.map((banner) => {
      const bannerJson = banner.toJSON();
      if (bannerJson.banner_url) {
        bannerJson.banner_url = `${process.env.BACKEND_URL}/banners/${bannerJson.banner_url}`;
      }
      return bannerJson;
    });
    sendResponse(res, "Banners retrieved successfully!", 200, { allBanners });
  } catch (error) {
    next(error);
  }
};

const retailersData = async (req, res, next) => {
  try {
    const retailersList = await Retailer.findAll({
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM RetailerCategories AS rc
              WHERE rc.retailer_id = Retailer.id
            )`),
            "total_categories",
          ],
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM products AS p
              WHERE p.retailer_id = Retailer.id
              AND p.sale_price > 0
            )`),
            "total_products",
          ],
          [
            sequelize.literal(`(
              SELECT IFNULL(SUM(p.sale_price), 0)
              FROM products AS p
              WHERE p.retailer_id = Retailer.id
              AND p.sale_price > 0
            )`),
            "total_cost",
          ],
        ],
      },
      include: [
        {
          model: Category,
          as: "categories",
          through: {
            attributes: [],
          },
        },
      ],
      order: [["id", "ASC"]],
    });

    if (!retailersList || retailersList.length === 0) {
      throw new CoustomError("No retailers data found", 404);
    }

    sendResponse(res, "Retailers data retrieved successfully!", 200, {
      retailers: retailersList,
    });
  } catch (error) {
    next(error);
  }
};

const updateRetailerPrice = async (req, res, next) => {
  try {
    const { id, add_on_percentage, discount, selected_categories } = req.body;
    if (!id || !add_on_percentage || !discount)
      throw new CoustomError("All fields are required", 400);

    const isRetailerExists = await Retailer.findOne({
      where: {
        id,
        is_active: 1,
      },
    });

    if (!isRetailerExists) throw new CoustomError("No retailer found", 404);
    if (selected_categories.length > 0) {
      const rows = await sequelize.query(
        `SELECT COUNT(*) as count 
        FROM RetailerCategories 
        WHERE retailer_id = :retailerId 
        AND category_id IN (:categoryIds)`,
        {
          replacements: {
            retailerId: id,
            categoryIds: selected_categories,
          },
          type: QueryTypes.SELECT,
        },
      );
      const mappedCount = rows[0].count;
      if (mappedCount !== selected_categories.length) {
        throw new CoustomError(
          "Some categories are not valid for this retailer!",
          400,
        );
      }
    }

    await isRetailerExists.update({
      addon_percentage: add_on_percentage,
      discount: discount,
      selected_categories: selected_categories,
    });

    sendResponse(
      res,
      "Retailer price has been updated on selected category successfully!",
      200,
      {
        RetailerData: isRetailerExists,
      },
    );
  } catch (error) {
    next(error);
  }
};

const getAllOrderData = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ["name", "id"],
      where: { is_active: 1, is_delete: 0 },
      raw: true,
    });

    const getAllOrdersForAdmin = async () => {
      let orders = await Order.findAll({
        include: [
          { model: User, as: "user", attributes: ["id", "name", "email"] },
          { model: Address, as: "order_address" },
        ],
        raw: true,
        nest: true,
      });

      const productIds = [
        ...new Set(
          orders.flatMap((order) => {
            const items =
              typeof order.items === "string"
                ? JSON.parse(order.items)
                : order.items;
            return items.map((item) => item.product_id);
          }),
        ),
      ];
      const productsWithRetailers = await Product.findAll({
        where: { id: productIds },
        include: [{ model: Retailer, as: "retailers" }],
        raw: true,
        nest: true,
      });

      const finalData = orders.map((order) => {
        const orderItems =
          typeof order.items === "string"
            ? JSON.parse(order.items)
            : order.items;

        const detailedItems = orderItems.map((item) => {
          const productInfo = productsWithRetailers.find(
            (p) => p.id == item.product_id,
          );
          return {
            ...item,
            productDetails: productInfo || null,
          };
        });
        return { ...order, items: detailedItems };
      });

      return finalData;
    };
    let orderData = await getAllOrdersForAdmin();
    // console.log("orderData",orderData)
    const formattedOrders = orderData.flatMap((order, orderIndex) => {
      return order.items.map((item, itemIndex) => {
        const productDetails = item.productDetails || {};
        return {
          id: order.id,
          order_id: `#${order.order_id}`,
          retailer_name: productDetails.retailers?.name || "N/A",
          product_id: item.product_id,
          track_id: order.id,
          retailer_id: String(productDetails.retailer_id || ""),
          user_name: order.user?.name || "N/A",
          user_id: order.user_id,
          product_name: item.product_name,
          quantity: item.quantity,
          amount: `$${item.subtotal || item.price}`,
          shipping_address: order.shipping_address || "N/A",
          payment_method: order.payment_method,
          delivery_status: order.order_status,
          return_details: order.is_returned === 1 ? "Returned" : "--",
          return_reason: order.reason || "--",
          order_date: order.order_date,
          delivered_date: order.delivery_date || "--",
        };
      });
    });

    sendResponse(
      res,
      "Orders fetched with real user names and dummy data",
      200,
      {
        count: formattedOrders.length,
        orders: formattedOrders,
      },
    );
  } catch (error) {
    console.error("Error in getAllOrderData:", error);
    next(error);
  }
};

// const getAllTransactions = async (req, res, next) => {
//   try {
//     const users = await User.findAll({
//       attributes: ["name", "id"],
//       where: { is_active: 1, is_delete: 0 },
//       raw: true,
//     });

//     const transactions = users.map((user, index) => {
//       const fullName = `${user.name || ""}`.trim() || "Guest User";
//       const user_id = user.id;
//       const pMethods = ["ATM Card", "Credit Card", "Debit Card"];
//       const statuses = ["Successful", "Pending", "Failed"];
//       const products = ["T-Shirt", "Jeans", "T-Shirts"];

//       return {
//         s_no: index + 1,
//         transaction_id: `#ID-12345`,
//         retailer_name: "Emily Smith",
//         user_name: fullName,
//         user_id: user_id,
//         shipping_address:
//           "26, Duong So 2, Thao Dien Ward, An Phu, District 2, Ho Chi Minh city",
//         payment_method: pMethods[index % 3],
//         status: statuses[index % 3],
//         product: products[index % 3],
//         quantity: index + 1,
//         order_date: `2026-04-0${index + 1}T09:40:26.000Z`,
//         delivered_date: "2026-02-12T09:40:26.000Z",
//         amount: "$400",
//       };
//     });

//     sendResponse(res, "Transactions fetched successfully", 200, {
//       count: transactions.length,
//       transactions: transactions,
//     });
//   } catch (error) {
//     console.error("Error in getAllTransactionData:", error);
//     next(error);
//   }
// };

const getAllTransactions = async (req, res, next) => {
  try {
    const data = await Transaction.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name"],
        },
        {
          model: Order,
          as: "order",
          attributes: [
            "shipping_address",
            "quantity",
            "order_date",
            "delivery_date",
            "items",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const transactions = await Promise.all(
      data.map(async (item, index) => {
        const user = item.user || {};
        const order = item.order || {};

        let productName = "N/A";
        let retailerName = "N/A";
        let parsedItems = [];

        try {
          parsedItems =
            typeof order.items === "string"
              ? JSON.parse(order.items)
              : order.items || [];

          if (parsedItems.length > 0) {
            const firstItem = parsedItems[0];
            productName = firstItem.product_name || "Product";

            if (firstItem.product_id || firstItem.id) {
              const productData = await Product.findOne({
                where: { id: firstItem.product_id || firstItem.id },
                include: [
                  {
                    model: Retailer,
                    as: "retailers",
                    attributes: ["name"],
                  },
                ],
              });

              if (productData && productData.retailers) {
                retailerName = productData.retailers.name;
              }
            }
          }
        } catch (e) {
          console.error(
            "Parsing/Fetching error for Order ID:",
            order.id,
            e.message,
          );
        }

        return {
          s_no: index + 1,
          id: item.id,
          transaction_id: item.transaction_id || `#ID-${item.id}`,
          retailer_name: retailerName,
          user_name: user.name || "Guest User",
          user_id: user.id || null,
          shipping_address: order.shipping_address || "Address Not Found",
          payment_method: item.payment_method || "N/A",
          status: item.status || "Pending",
          product: productName,
          quantity: order.quantity || 0,
          order_date: order.order_date,
          delivered_date: order.delivery_date || "--",
          amount: `$${item.amount || 0}`,
        };
      }),
    );
    sendResponse(res, "Transactions fetched successfully", 200, {
      count: transactions.length,
      transactions: transactions,
    });
  } catch (error) {
    console.error("Error in getAllTransactions:", error);
    next(error);
  }
};

const getAllData = async (req, res, next) => {
  try {
    const allProduct = await Product.findAll({
      where: {
        sale_price: 0,
      },
    });

    sendResponse(res, "abc", 200, allProduct);
  } catch (error) {
    next(error);
  }
};

const fetchAllPlans = async (req, res, next) => {
  try {
    let whereCondition = {};
    if (req.user.is_admin !== 1) {
      whereCondition.is_active = 1;
    }
    const allPlans = await Plan.findAll({
      where: whereCondition,
      attributes: {
        exclude: [
          "createdAt",
          "updatedAt",
          "stripe_price_id",
          "stripe_product_id",
        ],
      },
    });
    const formattedPlans = allPlans.map((plan) => {
      const planData = plan.get({ plain: true });
      let rawFeatures = planData.features;
      if (typeof rawFeatures === "string") {
        try {
          let cleaned = rawFeatures.trim();
          if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.substring(1, cleaned.length - 1);
          }
          cleaned = cleaned.replace(/\\"/g, '"');
          if (cleaned.includes("'")) {
            cleaned = cleaned.replace(/'/g, '"');
          }
          rawFeatures = JSON.parse(cleaned);
        } catch (e) {
          console.error("Parsing error for ID:", planData.id, e.message);
          rawFeatures =
            rawFeatures
              .match(/'([^']+)'|"([^"]+)"/g)
              ?.map((s) => s.slice(1, -1)) || [];
        }
      }

      return {
        ...planData,
        features: Array.isArray(rawFeatures) ? rawFeatures : [],
      };
    });
    sendResponse(res, "Fetching all the plans", 200, {
      allPlans: formattedPlans,
    });
  } catch (error) {
    next(error);
  }
};

const createNewPlane = async (req, res, next) => {
  try {
    const { plan_name, duraction, price, features } = req.body;
    let currency = "usd";
    const product = await stripe.products.create({
      name: plan_name,
      default_price_data: {
        currency: currency,
        recurring: {
          interval: duraction,
        },
        unit_amount: Number(price) * 100,
      },
    });

    await Plan.create({
      plan_name,
      duraction,
      price,
      features,
      stripe_price_id: product.default_price,
      stripe_product_id: product.id,
    });

    sendResponse(res, "Plan has been created successfully", 201);
  } catch (error) {
    next(error);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const { id, plan_name, price, features, is_active } = req.body;
    const isExitsPlan = await Plan.findOne({
      where: {
        id,
        // is_active: 1,
      },
    });
    if (!isExitsPlan) throw new CoustomError("Plan isn't avilible", 400);

    await isExitsPlan.update({
      plan_name: plan_name ? plan_name : isExitsPlan.plan_name,
      // duraction: duraction ? duraction : isExitsPlan.duraction,
      price: price ? price : isExitsPlan.price,
      features: features ? features : isExitsPlan.features,
      is_active: is_active ? is_active : isExitsPlan.is_active,
    });

    sendResponse(res, "Your plan has been updated successfully", 200);
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const { id, reason } = req.body;
    const orderData = await Order.findOne({
      where: {
        id,
        is_returned: 0,
      },
    });
    if (!orderData) {
      throw new CoustomError("Order not found or already returned", 404);
    }
    await orderData.update({
      is_cancelled: 1,
      order_status: "Cancelled",
      reason: reason || "Cancelled by admin",
    });
    sendResponse(res, "Order has been cancelled successfully!", 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  processBabyData,
  adminLogin,
  allUsers,
  updateUserStatus,
  globalDelete,
  globleFlashMessageEnable,
  globleFlashEnableStatus,
  addAlertMessage,
  fetchAllFlashMessages,
  previewMessage,
  addMinMaxTimeCount,
  updateMinMaxTimeCount,
  getTimeCountConfig,
  deleteUser,
  addFaq,
  getFaqs,
  updateFaq,
  deleteFaq,
  updateGlobalStatus,
  faqDetails,
  createStaticPage,
  updateStaticPageData,
  allStaticPages,
  userDetails,
  allCategories,
  resetRetailorPrice,
  categoryDetails,
  updateCategory,
  addBanner,
  updateBanner,
  allBanners,
  retailersData,
  updateRetailerPrice,
  getAllData,
  getAllOrderData,
  getAllTransactions,
  fetchAllPlans,
  createNewPlane,
  updatePlan,
  cancelOrder,
};
