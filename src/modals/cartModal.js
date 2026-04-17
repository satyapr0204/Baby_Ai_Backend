const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const User = require("./userModal.js");
const Product = require("./ProductModal/product.js");

const Cart = sequelize.define(
  "Cart",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    total_price: {
      type: DataTypes.FLOAT,
    },
  },
  {
    tableName: "carts",
    timestamps: true,
  },
);

Cart.belongsTo(User, {
  foreignKey: "user_id",
  as: "carts",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

User.hasMany(Cart, {
  foreignKey: "user_id",
  as: "carts",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// Cart.belongsTo(Product, {
//   foreignKey: "product_id",
//   as: "cart",
//   onDelete: "SET NULL",
//   onUpdate: "CASCADE",
// });

// Product.hasMany(Cart, {
//   foreignKey: "product_id",
//   as: "cart",
//   onDelete: "SET NULL",
//   onUpdate: "CASCADE",
// });

(async () => {
  try {
    await Cart.sync({ alter: true });
    console.log("✅ Cart table synced successfully");
  } catch (err) {
    console.error("❌ Error syncing Cart table:", err);
  }
})();

module.exports = Cart;
