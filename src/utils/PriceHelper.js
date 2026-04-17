// const { Op } = require("sequelize");
// const { Wishlist } = require("../modals/userWishlistModal");
// const Product = require("../modals/ProductModal/product");
// const Category = require("../modals/ProductModal/category");
// const Retailer = require("../modals/ProductModal/retailer");
// /**
//  * Get Calculated Products
//  * @param {Object} params - { category_id, product_id, user_id }
//  */
// const getCalculatedProducts = async ({
//   category_id,
//   product_id,
//   user_id = null,
// }) => {
//   try {
//     let productWhere = { sale_price: { [Op.gt]: 0 } };
//     if (product_id) productWhere.id = product_id;
//     if (category_id) productWhere.category_id = category_id;

//     const products = await Product.findAll({
//       where: productWhere,
//       include: [
//         {
//           model: Category,
//           as: "categories",
//           where: { is_active: 1 },
//           include: [
//             {
//               model: Retailer,
//               as: "retailers",
//               where: { is_active: 1 },
//               required: false,
//             },
//           ],
//         },
//         {
//           model: Wishlist,
//           as: "wishlists",
//           where: user_id ? { user_id } : {},
//           required: false,
//         },
//       ],
//     });

//     if (!products.length) return [];
//     const result = products.map((product) => {
//       const p = product.get({ plain: true });
//       const category = p.categories;
//       const firstRetailer = category?.retailers?.[0] || null;

//       const cost = parseFloat(p.sale_price) || 0;
//       let addonPct = parseFloat(category?.addon_percentage) || 0;
//       let discountPct = parseFloat(category?.discount_percentage) || 0;

//       if (firstRetailer) {
//         const selectedCats = firstRetailer.selected_categories || [];

//         if (selectedCats.includes(Number(p.category_id))) {
//           if (addonPct == 0)
//             addonPct = parseFloat(firstRetailer.addon_percentage) || 0;
//           if (discountPct == 0)
//             discountPct = parseFloat(firstRetailer.discount) || 0;
//         }
//       }

//       let finalPrice = cost;
//       if (addonPct > 0 || discountPct > 0) {
//         const markedPrice = cost + cost * (addonPct / 100);
//         finalPrice = markedPrice - markedPrice * (discountPct / 100);
//       }

//       let formattedImages = [];
//       try {
//         formattedImages =
//           typeof p.product_images === "string"
//             ? JSON.parse(p.product_images)
//             : p.product_images;
//       } catch (e) {
//         formattedImages = [];
//       }

//       return {
//         ...p,
//         discount_applied: `${discountPct}%`,
//         category_name: category.name,
//         sale_price: finalPrice > 0 ? finalPrice.toFixed(2) : cost.toFixed(2),
//         product_images: formattedImages,
//         is_fav: !!(p.wishlists && p.wishlists.length > 0),
//         categories: undefined,
//         wishlists: undefined,
//       };
//     });
//     return product_id ? result[0] : result;
//   } catch (error) {
//     console.error("Error in getCalculatedProducts:", error);
//     throw error;
//   }
// };

// module.exports = { getCalculatedProducts };

const { Op } = require("sequelize");
const { Wishlist } = require("../modals/userWishlistModal");
const Product = require("../modals/ProductModal/product");
const Category = require("../modals/ProductModal/category");
const Retailer = require("../modals/ProductModal/retailer");

const getCalculatedProducts = async ({
  category_id,
  product_id,
  user_id = null,
}) => {
  try {
    let productWhere = { sale_price: { [Op.gt]: 0 } };
    // if (product_id) productWhere.id = product_id;
    if (product_id) {
      productWhere.id = Array.isArray(product_id)
        ? { [Op.in]: product_id }
        : product_id;
    }
    if (category_id) productWhere.category_id = category_id;

    const products = await Product.findAll({
      where: productWhere,
      include: [
        {
          model: Category,
          as: "categories",
          where: { is_active: 1 },
          include: [
            {
              model: Retailer,
              as: "retailers",
              where: { is_active: 1 },
              required: false,
            },
          ],
        },

        {
          model: Retailer,
          as: "retailers",
          where: { is_active: 1 },
          required: false,
        },
        {
          model: Wishlist,
          as: "wishlists",
          where: user_id ? { user_id } : {},
          required: false,
        },
      ],
    });
    if (!products.length) return [];
    const firstProduct = JSON.parse(JSON.stringify(products));
    const firstRetailerData = firstProduct[0].retailers;
    const result = products.map((product) => {
      const p = product.get({ plain: true });
      const category = p.categories;
      const productRetailer = p.retailers;
      const categoryRetailers = category?.retailers || [];
      const firstRetailer = categoryRetailers[0] || null;
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
        discount_applied: `${discountPct}%`,
        category_name: category?.name || "N/A",
        sale_price: finalPrice > 0 ? finalPrice.toFixed(2) : cost.toFixed(2),
        actual_price: `${markedPrice.toFixed(2)}`,
        product_images: formattedImages,
        is_fav: !!(p.wishlists && p.wishlists.length > 0),
        categories: undefined,
        retailers: undefined,
        wishlists: undefined,
      };
    });

    // return product_id ? result[0] : result;
    return product_id && !Array.isArray(product_id) ? result[0] : result;
  } catch (error) {
    console.error("Error in getCalculatedProducts:", error);
    throw error;
  }
};

module.exports = { getCalculatedProducts };
