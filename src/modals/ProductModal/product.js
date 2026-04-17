// module.exports = (sequelize, DataTypes) => {
//   const Product = sequelize.define("Product", {
//     product_id: {
//       type: DataTypes.STRING,
//       unique: true,
//     },

//     product_name: DataTypes.STRING,
//     description: DataTypes.TEXT,

//     msrp_price: DataTypes.FLOAT,
//     sale_price: DataTypes.FLOAT,
//     wholesale_cost: DataTypes.FLOAT,

//     product_images: DataTypes.JSON,
//     product_url: DataTypes.TEXT,

//     is_best_seller: DataTypes.BOOLEAN,

//     retailer_id: DataTypes.STRING,
//   });

//   Product.associate = (models) => {
//     Product.belongsTo(models.Fabric);
//     Product.belongsTo(models.Color);
//     Product.belongsTo(models.Gender);
//     Product.belongsTo(models.Size);
//     Product.belongsTo(models.Brand);
//     Product.belongsTo(models.Category);
//   };

//   return Product;
// };

const { DataTypes } = require("sequelize");
const { sequelize } = require("../../../dbConfig.js"); // Path check kar lena

// Import associated models
const Fabric = require("./fabric.js");
const Color = require("./color.js");
const Gender = require("./gender.js");
const Size = require("./size.js");
const Brand = require("./brand.js");
const Category = require("./category.js");
const { Wishlist } = require("../userWishlistModal.js");
const Retailer = require("../ProductModal/retailer.js");
const Cart = require("../cartModal.js");

const Product = sequelize.define(
  "Product",
  {
    product_id: {
      type: DataTypes.STRING,
      // unique: true,
    },
    product_name: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.TEXT,
    },
    msrp_price: {
      type: DataTypes.FLOAT,
    },
    sale_price: {
      type: DataTypes.FLOAT,
    },
    wholesale_cost: {
      type: DataTypes.FLOAT,
    },
    product_images: {
      type: DataTypes.JSON,
    },
    product_url: {
      type: DataTypes.TEXT,
    },
    is_best_seller: {
      type: DataTypes.BOOLEAN,
    },
    retailer_id: {
      type: DataTypes.INTEGER,
    },
  },
  {
    tableName: "products",
    timestamps: true,
  },
);


Product.belongsTo(Fabric, { foreignKey: "fabric_id", as: "fabric" });
Product.belongsTo(Color, { foreignKey: "color_id", as: "color" });
Product.belongsTo(Size, { foreignKey: "size_id", as: "size" });
Product.belongsTo(Gender, { foreignKey: "gender_id", as: "gender" });
Product.belongsTo(Brand, { foreignKey: "brand_id", as: "brand" });
Product.belongsTo(Category, { foreignKey: "category_id", as: "categories" });
Product.belongsTo(Retailer, { foreignKey: "retailer_id", as: "retailers" });
Product.hasMany(Wishlist, { foreignKey: "product_id", as: "wishlists" });
Wishlist.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Product.hasMany(Cart, { foreignKey: "product_id", as: "cart" });
Cart.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Retailer.hasMany(Product, { 
    foreignKey: "retailer_id", 
    as: "retailers" 
});

// Sync Logic
(async () => {
  try {
    await Product.sync({ alter: true });
    console.log("✅ Product table synced successfully");
  } catch (err) {
    console.error("❌ Error syncing Product table:", err);
  }
})();

module.exports = Product;
