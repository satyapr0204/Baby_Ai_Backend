const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const User = require("./userModal.js");
const Retailer = require("./ProductModal/retailer.js");
const Product = require("./ProductModal/product.js");
const Address = require("./addressModal.js");

const Order = sequelize.define(
  "Orders",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_id: {
      type: DataTypes.STRING,
    },
    items: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
    },
    total_amount: {
      type: DataTypes.FLOAT,
    },
    shipping_address: {
      type: DataTypes.STRING,
    },
    payment_method: {
      type: DataTypes.STRING,
    },
    order_status: {
      type: DataTypes.STRING,
    },
    is_returned: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_cancelled: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    reason: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    order_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    delivery_date: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    retailer_status: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    retailer_error_log: {
      type: DataTypes.TEXT,
      defaultValue: null,
    },
    retailer_order_id: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
  },
  {
    tableName: "orders",
    timestamps: true,
  },
);

Order.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Order.belongsTo(Address, {
  foreignKey: "shippingAddress_id",
  as: "order_address",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Address.hasMany(Order, {
  foreignKey: "shippingAddress_id",
  as: "shipping_address",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

(async () => {
  try {
    await Order.sync({ alter: true });
    console.log("✅ Order table synced successfully");
  } catch (err) {
    console.error("❌ Error syncing Order table:", err);
  }
})();

module.exports = Order;
