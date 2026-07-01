const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const User = require("./userModal.js");
const Order = require("./orderModal.js");
const Subscriber = require("./subscriberModal.js");
const Plan = require("./planModal.js");

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
      // allowNull: false,
    },
    transaction_id: {
      type: DataTypes.STRING,
    },
    stripe_payment_intent_id: {
      type: DataTypes.STRING,
    },
    stripe_invoice_id: {
      type: DataTypes.STRING,
    },
    stripe_invoice_url: {
      type: DataTypes.TEXT,
    },
    stripe_invoice_pdf: {
      type: DataTypes.TEXT,
    },
    total_amount: {
      type: DataTypes.FLOAT,
    },
    status: {
      type: DataTypes.STRING,
    },
    payment_method: {
      type: DataTypes.STRING,
    },
    paid_at: {
      type: DataTypes.DATE
    },
    stripe_charge_id: {
      type: DataTypes.STRING,
    },
    payment_method_id: {
      type: DataTypes.STRING,
    },
    type: {
      type: DataTypes.STRING,
    }
  },
  {
    tableName: "transactions",
    timestamps: true,
  },
);

Transaction.belongsTo(User, { as: "user", foreignKey: "user_id" });
Transaction.belongsTo(Order, { as: "order", foreignKey: "order_id" });
Transaction.belongsTo(Subscriber, { as: "subscription", foreignKey: "subscription_id" });
Subscriber.hasOne(Transaction, { as: "subscription", foreignKey: "subscription_id" });
// Transaction.belongsTo(Plan, { as: "subscriptionPlan", foreignKey: "subscription_plan_id" });
// Plan.hasOne(Transaction, { as: "subscriptionPlan", foreignKey: "subscription_plan_id" });
Order.hasOne(Transaction, { as: "transaction", foreignKey: "order_id" });

(async () => {
  await Transaction.sync({ alter: true });
})();

module.exports = Transaction;
