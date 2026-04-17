const fs = require("fs");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const path = require("path");

// const {
//   Product,
//   Fabric,
//   Color,
//   Gender,
//   Size,
//   Brand,
//   Category,
// } = require("../../modals/ProductModal");

const Product = require("../../modals/ProductModal/product");
const Fabric = require("../../modals/ProductModal/fabric");
const Color = require("../../modals/ProductModal/color");
const Gender = require("../../modals/ProductModal/gender");
const Size = require("../../modals/ProductModal/size");
const Brand = require("../../modals/ProductModal/brand");
const Category = require("../../modals/ProductModal/category");

const { Op } = require("sequelize");
const { sequelize } = require("../../../dbConfig");
const Retailer = require("../../modals/ProductModal/retailer");

// ================= HELPERS =================

const cleanPrice = (val) =>
  val ? parseFloat(val.toString().replace(/[^0-9.]/g, "")) || 0 : 0;

const parseBool = (val) =>
  ["y", "yes", "true", "1"].includes((val || "").toLowerCase());

const formatUPC = (val) => {
  if (!val) return null;
  let str = val.toString().trim();
  if (str === "#N/A") return null;
  return str;
};

const normalizeGender = (val) => {
  if (!val) return null;

  const g = val.toLowerCase().trim();

  if (["boy", "boys"].includes(g)) return "Boy";
  if (["girl", "girls"].includes(g)) return "Girl";
  if (["unisex", "both"].includes(g)) return "Unisex";

  return val;
};

// 🔥 GET OR CREATE
const getOrCreate = async (Model, value) => {
  if (!value) return null;
  const name = value.trim();

  let record = await Model.findOne({ where: { name } });
  if (!record) {
    record = await Model.create({ name });
  }

  return record.id;
};

const updateCategoryPriceRange = async (Modal, Ids) => {
  try {
    for (const id of Ids) {
      if (!id) continue;
      const columnToFilter =
        Modal.name === "Category" ? "category_id" : "retailer_id";

      const result = await Product.findOne({
        where: {
          [columnToFilter]: id,
          sale_price: {
            [Op.gt]: 0,
          },
        },
        attributes: [
          [sequelize.fn("MIN", sequelize.col("sale_price")), "minPrice"],
          [sequelize.fn("MAX", sequelize.col("sale_price")), "maxPrice"],
        ],
        raw: true,
      });

      if (result && result.minPrice !== null) {
        const rangeText = `${result.minPrice} - ${result.maxPrice}`;
        await Modal.update(
          {
            price_range: rangeText,
          },
          { where: { id: id } },
        );
      }
    }
    console.log("✅ Category Price Ranges Updated");
  } catch (error) {
    console.error("❌ Error updating price range:", error.message);
  }
};

// ================= MAIN UPLOAD =================

exports.uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "File required" });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  let results = [];

  try {
    // ===== READ FILE =====
    if (ext === ".xlsx" || ext === ".xls") {
      const workbook = XLSX.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      results = XLSX.utils.sheet_to_json(sheet);
    } else if (ext === ".csv") {
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on("data", (row) => results.push(row))
          .on("end", resolve)
          .on("error", reject);
      });
    }

    console.log("TOTAL:", results.length);

    // ===== COLLECT UPC =====
    const allUPCs = [];
    for (let item of results) {
      const rawUPC = item["UPC"] || item["upc"];
      const formatted = formatUPC(rawUPC);
      if (formatted) allUPCs.push(formatted);
    }

    // ===== FIND EXISTING IN DB =====
    const existingProducts = await Product.findAll({
      where: {
        product_id: {
          [Op.in]: allUPCs,
        },
      },
      attributes: ["product_id"],
    });

    const existingSet = new Set(existingProducts.map((p) => p.product_id));

    // ===== PROCESS =====
    const bulkData = [];
    const seenUPC = new Set();
    const retailerCategoryMapping = new Set();

    let fileDuplicate = 0;
    let dbDuplicate = 0;
    let skipNoUPC = 0;

    for (let item of results) {
      const rawUPC = item["UPC"] || item["upc"];

      if (!rawUPC) {
        skipNoUPC++;
        continue;
      }

      const productId = formatUPC(rawUPC);
      if (!productId) continue;

      // FILE DUPLICATE
      if (seenUPC.has(productId)) {
        fileDuplicate++;
        continue;
      }
      seenUPC.add(productId);

      // DB DUPLICATE
      if (existingSet.has(productId)) {
        dbDuplicate++;
        continue;
      }
  

      // RELATIONS
      const fabricId = await getOrCreate(Fabric, item["Fabric"]);
      const colorId = await getOrCreate(Color, item["Color"]);
      const sizeId = await getOrCreate(Size, item["Size"]);
      const genderId = await getOrCreate(
        Gender,
        normalizeGender(item["Gender"]),
      );
      const brandValue = (item["Brand"] || "").trim();
      const finalBrand = brandValue ? brandValue : "bambini";
      const retailer = (item["Brand"] || "").trim();
      const finalRetailer = retailer ? retailer : "bambini";
      const retailerId = await getOrCreate(Retailer, finalRetailer);
      const brandId = await getOrCreate(Brand, finalBrand);
      const categoryId = await getOrCreate(Category, item["Categories"]);

      const images = [item["Main Image URL 1"], item["Main Image URL 2"]]
        .filter(Boolean)
        .slice(0, 2);

      if (retailerId && categoryId) {
        retailerCategoryMapping.add(`${retailerId}-${categoryId}`);
      }
      bulkData.push({
        product_id: productId,
        product_name: item["Product Name"],
        description: item["Description"],

        msrp_price: cleanPrice(item["MSRP Price"]),
        sale_price: cleanPrice(item["Sale Price"]),
        wholesale_cost: cleanPrice(item["Wholesale Cost"]),

        product_images: images,
        product_url: item["Product URL"],

        is_best_seller: parseBool(item["Best Seller"]),

        fabric_id: fabricId,
        color_id: colorId,
        size_id: sizeId,
        gender_id: genderId,
        brand_id: brandId,
        retailer_id: retailerId,
        category_id: categoryId,
      });
    }


    // ===== INSERT IN CHUNKS =====
    const chunkSize = 200;
    const affectedCategoryIds = new Set();
    const affectedRetailerIds = new Set();
    for (let i = 0; i < bulkData.length; i += chunkSize) {
      const chunk = bulkData.slice(i, i + chunkSize);

      await Product.bulkCreate(chunk, {
        ignoreDuplicates: true,
      });

      chunk.forEach((item) => affectedCategoryIds.add(item.category_id));
      chunk.forEach((item) => affectedRetailerIds.add(item.retailer_id));
      console.log(`Inserted ${i} to ${i + chunk.length}`);
    }

    if (retailerCategoryMapping.size > 0) {
      try {
        const junctionData = Array.from(retailerCategoryMapping).map((pair) => {
          const [rId, cId] = pair.split("-");
          return {
            retailer_id: parseInt(rId),
            category_id: parseInt(cId),
          };
        });
        await sequelize.model("RetailerCategories").bulkCreate(junctionData, {
          ignoreDuplicates: true,
        });
        console.log("✅ All Retailers and Categories linked successfully");
      } catch (linkError) {
        console.error("⚠️ Junction table error:", linkError.message);
      }
    }
    if (affectedCategoryIds.size > 0) {
      await updateCategoryPriceRange(Category, Array.from(affectedCategoryIds));
    }
    if (affectedRetailerIds.size > 0) {
      await updateCategoryPriceRange(Retailer, Array.from(affectedRetailerIds));
    }

    fs.unlinkSync(req.file.path);

    res.json({
      message: "Upload Done 🚀",
      total: results.length,
      inserted: bulkData.length,
      file_duplicates: fileDuplicate,
      db_duplicates: dbDuplicate,
      skipped_no_upc: skipNoUPC,
    });
  } catch (err) {
    console.error("rrrr", err);
    res.status(500).json({
      message: "Upload Failed",
      error: err.message,
    });
  }
};

// ================= GET =================

exports.getProducts = async (req, res) => {
  try {
    const data = await Product.findAll({
      include: [Fabric, Color, Size, Gender, Brand, Category],
    });

    res.json({
      count: data.length,
      data,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error fetching",
      error: err.message,
    });
  }
};
