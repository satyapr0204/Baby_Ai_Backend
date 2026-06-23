const { predictSize } = require("../../services/aiService");
const Measurement = require("../../modals/Ai/measurementModal");
const Product = require("../../modals/ProductModal/product");
const Size = require("../../modals/ProductModal/size");
const { Op } = require("sequelize");

const PRODUCT_FILTER_FIELDS = [
  "id",
  "product_id",
  "product_name",
  "retailer_id",
  "fabric_id",
  "color_id",
  "gender_id",
  "brand_id",
  "category_id",
  "is_best_seller",
];

function buildProductFilter(payload) {
  const where = {};

  for (const field of PRODUCT_FILTER_FIELDS) {
    const value = payload[field];

    if (value !== undefined && value !== null && value !== "") {
      where[field] = value;
    }
  }

  return where;
}

function normalizeSizeIds(payload) {
  const rawValue =
    payload.available_size_ids ||
    payload.size_ids ||
    payload.product_size_ids ||
    payload.available_sizes;

  if (!rawValue) {
    return [];
  }

  const list = Array.isArray(rawValue) ? rawValue : [rawValue];

  return [
    ...new Set(
      list
        .map((item) => {
          if (typeof item === "number") {
            return item;
          }

          if (
            typeof item === "string" &&
            item.trim() !== "" &&
            !Number.isNaN(Number(item))
          ) {
            return Number(item);
          }

          if (
            item &&
            typeof item === "object" &&
            item.id !== undefined &&
            !Number.isNaN(Number(item.id))
          ) {
            return Number(item.id);
          }

          return null;
        })
        .filter((item) => Number.isInteger(item) && item > 0),
    ),
  ];
}

async function resolveAvailableSizeIds(payload, productWhere) {
  const explicitSizeIds = normalizeSizeIds(payload);

  if (explicitSizeIds.length > 0) {
    return explicitSizeIds;
  }

  if (Object.keys(productWhere).length === 0) {
    return [];
  }

  const products = await Product.findAll({
    where: productWhere,
    attributes: ["size_id"],
    raw: true,
  });

  return [
    ...new Set(
      products
        .map((product) => product.size_id)
        .filter((sizeId) => Number.isInteger(sizeId) && sizeId > 0),
    ),
  ];
}

function extractAiPayload(payload, availableSizeIds) {
  const aiPayload = {
    height: payload.height,
    weight: payload.weight,
    chest: payload.chest,
    waist: payload.waist,
    hip: payload.hip,
  };

  if (payload.landmarks) {
    aiPayload.landmarks = payload.landmarks;
  }

  if (availableSizeIds.length > 0) {
    aiPayload.available_size_ids = availableSizeIds;
  }

  return aiPayload;
}

async function getRecommendedSize(req, res, next) {
  try {
    const productWhere = buildProductFilter(req.body);
    const availableSizeIds = await resolveAvailableSizeIds(
      req.body,
      productWhere,
    );
    const aiPayload = extractAiPayload(req.body, availableSizeIds);
    const aiResult = await predictSize(aiPayload);

    const recommendedSizeId =
      aiResult?.data?.recommendedSizeId ??
      aiResult?.recommended_size_id ??
      null;

    const recommendedSizeName =
      aiResult?.data?.recommendedSizeName ?? aiResult?.recommended_size ?? null;

    const measurements =
      aiResult?.data?.measurements ?? aiResult?.measurements ?? null;

    if (!measurements || !recommendedSizeName) {
      return res.status(502).json({
        status: 502,
        success: false,
        message: "AI service returned an invalid response",
      });
    }

    await Measurement.create({
      height: measurements.height,
      weight: measurements.weight,
      chest: measurements.chest,
      waist: measurements.waist,
      hip: measurements.hip,
      recommended_size: recommendedSizeName,
    });

    const recommendedSize = recommendedSizeId
      ? await Size.findByPk(recommendedSizeId, { raw: true })
      : null;

    const clothesWhere = { ...productWhere };

    if (recommendedSizeId) {
      clothesWhere.size_id = recommendedSizeId;
    }

    const clothes = await Product.findAll({
      where: {
        ...clothesWhere,
        sale_price: {
          [Op.gt]: 0,
        },
      },
    });

    return res.json({
      status: 200,
      success: true,
      message: "Recommended size fetched successfully",
      data: {
        recommendedSize: recommendedSize || {
          id: recommendedSizeId,
          name: recommendedSizeName,
        },
        recommendedSizeId: recommendedSizeId,
        recommendedSizeName: recommendedSizeName,
        availableSizeIdsUsed:
          aiResult?.data?.availableSizeIdsUsed || availableSizeIds,
        measurements,
        products: clothes,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getSizes(req, res, next) {
  try {
    const allSizeList = await Size.findAll({
      order: [["id", "ASC"]],
      raw: true,
    });

    return res.json({
      status: 200,
      success: true,
      message: "Fetching all size list",
      data: {
        allSizeList,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getRecommendedSize, getSizes };
