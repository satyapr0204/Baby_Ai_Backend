const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");

const Plan = sequelize.define(
  "Plan",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    plan_name: {
      type: DataTypes.STRING,
    },
    duraction: {
      type: DataTypes.STRING,
    },
    price: {
      type: DataTypes.DECIMAL,
      defaultValue: 0.0,
    },
    is_active: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    features: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    token_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    stripe_price_id: {
      type: DataTypes.STRING
    },
    stripe_product_id: {
      type: DataTypes.STRING
    },
    is_premium: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }

  },
  {
    tableName: "Plan",
    timestamps: true,
  },
);

(async () => {
  try {
    await Plan.sync({ alter: true });
    console.log("✅ Plan table synced successfully");
  } catch (err) {
    console.error("❌ Error syncing Plan table:", err);
  }
})();

module.exports = Plan;
