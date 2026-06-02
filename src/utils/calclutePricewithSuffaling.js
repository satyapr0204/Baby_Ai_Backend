const { Op } = require("sequelize");
const { Wishlist } = require("../modals/userWishlistModal");
const Product = require("../modals/ProductModal/product");
const Category = require("../modals/ProductModal/category");
const Retailer = require("../modals/ProductModal/retailer");
const Fabric = require("../modals/ProductModal/fabric");
const Color = require("../modals/ProductModal/color");
const Size = require("../modals/ProductModal/size");
const Brand = require("../modals/ProductModal/brand");
const Cart = require("../modals/cartModal");

const formatValue = (obj, isColor = false) => {
  if (!obj || !obj.name) return obj;
  if (Array.isArray(obj.name)) return obj;

  let formattedNames;
  if (obj.name.includes("/")) {
    formattedNames = obj.name
      .split("/")
      .map((item) => item.trim())
      .filter(Boolean);
  } else {
    formattedNames = [obj.name.trim()];
  }

  const result = {
    ...obj,
    name: formattedNames,
  };

  if (isColor) {
    result.hashcode = formattedNames.map((name) => getColorHex(name));
  }

  return result;
};

const getColorHex = (dbColorName) => {
  const colorMap = {
    black: "#000000",
    blue: "#0000FF",
    grey: "#808080",
    "heather grey": "#808080",
    navy: "#000080",
    red: "#FF0000",
    white: "#FFFFFF",
    pink: "#FFC0CB",
    yellow: "#FFFF00",
    green: "#008000",
    mint: "#98FF98",
    aqua: "#00FFFF",
    cream: "#FFFDD0",
    print: "#E0E0E0",
    prints: "#E0E0E0",
  };
  const primaryColor = dbColorName.toLowerCase().split("/")[0].trim();
  if (primaryColor.includes("print")) return colorMap["print"];
  return colorMap[primaryColor] || "#D3D3D3";
};

const getCalculatedProductsWithSuffling = async ({
  category_id,
  product_id,
  user_id = null,
  productWhereData = {},
  requestedId = null,
  page = 1,
  size = 10,
}) => {
  console.log(
    "product_id || category_id || productWhereData",
    product_id || category_id || productWhereData,
  );
  try {
    let productWhere = { sale_price: { [Op.gt]: 0 }, ...productWhereData };
    if (product_id) {
      productWhere.id = Array.isArray(product_id)
        ? { [Op.in]: product_id }
        : product_id;
    }
    if (category_id) productWhere.category_id = category_id;

    const products = await Product.findAll({
      where: productWhere,
      attributes: { exclude: ["createdAt", "updatedAt", "wholesale_cost"] },
      include: [
        {
          model: Category,
          as: "categories",
          where: { is_active: 1 },
          attributes: { exclude: ["createdAt", "updatedAt"] },
          include: [
            {
              model: Retailer,
              as: "retailers",
              where: { is_active: 1 },
              required: false,
              attributes: { exclude: ["createdAt", "updatedAt"] },
            },
          ],
        },
        {
          model: Retailer,
          as: "retailers",
          where: { is_active: 1 },
          required: false,
          attributes: { exclude: ["createdAt", "updatedAt"] },
        },
        {
          model: Wishlist,
          as: "wishlists",
          where: user_id ? { user_id } : {},
          required: false,
          attributes: { exclude: ["createdAt", "updatedAt"] },
        },
        {
          model: Cart,
          as: "cart",
          where: user_id ? { user_id } : {},
          required: false,
          attributes: { exclude: ["createdAt", "updatedAt"] },
        },
        {
          model: Fabric,
          as: "fabric",
          required: false,
          attributes: { exclude: ["createdAt", "updatedAt"] },
        },
        {
          model: Color,
          as: "color",
          required: false,
          attributes: { exclude: ["createdAt", "updatedAt"] },
        },
        {
          model: Size,
          as: "size",
          required: false,
          attributes: { exclude: ["createdAt", "updatedAt"] },
        },
        {
          model: Brand,
          as: "brand",
          required: false,
          attributes: { exclude: ["createdAt", "updatedAt"] },
        },
      ],
    });

    if (!products.length) return [];
    const firstProduct = JSON.parse(JSON.stringify(products));
    const firstRetailerData = firstProduct[0].retailers;

    const calculatedList = products.map((product) => {
      const p = product.get({ plain: true });
      const category = p.categories;
      const productRetailer = p.retailers;
      const categoryRetailers = category?.retailers || [];
      const cost = parseFloat(p.sale_price) || 0;
      let addonPct = parseFloat(category?.addon_percentage) || 0;
      let discountPct = parseFloat(category?.discount_percentage) || 0;

      if (addonPct == 0 && discountPct == 0) {
        if (productRetailer) {
          let selectedCats = [];
          try {
            selectedCats =
              typeof productRetailer.selected_categories === "string"
                ? JSON.parse(productRetailer.selected_categories)
                : productRetailer.selected_categories || [];
          } catch (e) {
            selectedCats = [];
          }
          if (selectedCats.map(Number).includes(Number(p.category_id))) {
            addonPct = parseFloat(productRetailer.addon_percentage) || 0;
            discountPct = parseFloat(productRetailer.discount) || 0;
          }
        }
        if (addonPct == 0 && discountPct == 0 && firstRetailerData) {
          addonPct = parseFloat(firstRetailerData.addon_percentage) || 0;
          discountPct = parseFloat(firstRetailerData.discount) || 0;
        }
      }
      let finalPrice = cost;
      let markedPrice = cost;
      if (addonPct > 0 || discountPct > 0) {
        markedPrice = cost + cost * (addonPct / 100);
        finalPrice = markedPrice - markedPrice * (discountPct / 100);
      }
      let formattedImages = [];
      try {
        formattedImages =
          typeof p.product_images === "string"
            ? JSON.parse(p.product_images || "[]")
            : p.product_images || [];
      } catch (e) {
        formattedImages = [];
      }

      return {
        ...p,
        fabric: formatValue(p.fabric),
        color: formatValue(p.color, true),
        size: formatValue(p.size),
        brand: formatValue(p.brand),
        discount_applied: `${discountPct}%`,
        category_name: category?.name || "N/A",
        sale_price: finalPrice > 0 ? finalPrice.toFixed(2) : cost.toFixed(2),
        actual_price: `${markedPrice.toFixed(2)}`,
        product_images: formattedImages,
        is_fav: !!(p.wishlists && p.wishlists.length > 0),
        is_in_cart: !!(p.cart && p.cart.length > 0),
        categories: undefined,
        retailers: undefined,
        wishlists: undefined,
        cart: undefined,
        product_url: undefined,
        msrp_price: undefined,
      };
    });
    const groupedProductsMap = new Map();

    calculatedList.forEach((prod) => {
      const productNameKey = prod.product_name
        ? prod.product_name.trim().toLowerCase()
        : `unknown_${prod.id}`;

      if (!groupedProductsMap.has(productNameKey)) {
        const newProductGroup = {
          ...prod,
          sizes: prod.size
            ? [
                {
                  id: prod.size.id,
                  name: Array.isArray(prod.size.name)
                    ? prod.size.name[0]
                    : prod.size.name,
                  product_id: prod.id,
                },
              ]
            : [],
        };
        delete newProductGroup.size;
        groupedProductsMap.set(productNameKey, newProductGroup);
      } else {
        const existingProduct = groupedProductsMap.get(productNameKey);
        if (requestedId && Number(prod.id) === Number(requestedId)) {
          const currentSizes = existingProduct.sizes;
          Object.assign(existingProduct, prod);
          existingProduct.sizes = currentSizes;
          delete existingProduct.size;
        }
        if (prod.size) {
          const sizeExists = existingProduct.sizes.some(
            (s) => s.id === prod.size.id,
          );
          if (!sizeExists) {
            existingProduct.sizes.push({
              id: prod.size.id,
              name: Array.isArray(prod.size.name)
                ? prod.size.name[0]
                : prod.size.name,
              product_id: prod.id,
            });
          }
        }
      }
    });

    let result = Array.from(groupedProductsMap.values());

    if (result.length > 1 && (!product_id || Array.isArray(product_id))) {
      const categoryBuckets = {};
      result.forEach((product) => {
        const catId = product.category_id || "uncategorized";
        if (!categoryBuckets[catId]) categoryBuckets[catId] = [];
        categoryBuckets[catId].push(product);
      });

      Object.keys(categoryBuckets).forEach((catId) => {
        categoryBuckets[catId].sort(() => Math.random() - 0.5);
      });

      const mixedResult = [];
      const bucketKeys = Object.keys(categoryBuckets);
      let itemsRemaining = true;

      while (itemsRemaining) {
        itemsRemaining = false;
        bucketKeys.forEach((catId) => {
          if (categoryBuckets[catId].length > 0) {
            mixedResult.push(categoryBuckets[catId].shift());
            itemsRemaining = true;
          }
        });
      }
      result = mixedResult;
    }
    if (result.length === 0) return [];

    if (result.length === 1) {
      if (category_id) {
        return result;
      }
      return result[0];
    }

    return result;
  } catch (error) {
    console.error("Error in getCalculatedProducts:", error);
    throw error;
  }
};

module.exports = { getCalculatedProductsWithSuffling };
