const { DataTypes } = require("sequelize");
const { sequelize } = require("../../../dbConfig.js");

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
// const productGenratedImage = require("./productGenratedImage.js");

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
    }
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
  as: "retailers",
});

Category.hasMany(Product, { foreignKey: "category_id", as: "categories" });

const productGenratedImage = require("./productGenratedImage.js");
const recentSearch = require("./recentlySearch.js");

Product.hasOne(productGenratedImage, { foreignKey: 'product_id', as: 'aiImage' });
productGenratedImage.belongsTo(Product, { foreignKey: 'product_id', as: 'productMain' });

Product.hasOne(recentSearch, { foreignKey: 'product_id', as: 'recentSearchProduct' });
recentSearch.belongsTo(Product, { foreignKey: 'product_id', as: 'recentSearchProduct' });;

// Sync Logic
(async () => {
  try {
    // await Product.sync({ alter: true });
    await Product.sync();
    console.log("✅ Product table synced successfully");
  } catch (err) {
    console.error("❌ Error syncing Product table:", err);
  }
})();

module.exports = Product;
