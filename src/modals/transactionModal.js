const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const User = require("./userModal.js");
const Order = require("./orderModal.js");

const Transaction = sequelize.define(
  "Transaction",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    stripe_session_id: {
      type: DataTypes.STRING,
      // unique: true,
      allowNull: false,
    },
    transaction_id: {
      type: DataTypes.STRING,
    },
    payment_intent_id: {
      type: DataTypes.STRING,
    },
    invoice_id: {
      type: DataTypes.STRING,
    },
    invoice_url: {
      type: DataTypes.TEXT,
    },
    amount: {
      type: DataTypes.FLOAT,
    },
    status: {
      type: DataTypes.STRING,
    },
    payment_method: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "transactions",
    timestamps: true,
  },
);

Transaction.belongsTo(User, { as: "user", foreignKey: "user_id" });
Transaction.belongsTo(Order, { as: "order", foreignKey: "order_id" });
Order.hasOne(Transaction, { as: "transaction", foreignKey: "order_id" });

(async () => {
  await Transaction.sync({ alter: true });
})();

module.exports = Transaction;
