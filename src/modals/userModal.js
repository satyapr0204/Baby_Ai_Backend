const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const Plan = require("./planModal.js");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      //   allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
    },
    profile_image: {
      type: DataTypes.STRING,
    },
    is_profile_complete: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_new_user: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    name: {
      type: DataTypes.STRING,
    },
    orders: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    is_delete: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    current_step: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    selected_baby: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    country_code: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    fcm_token: {
      type: DataTypes.STRING,
    },
    stripe_customer_id: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    stripe_subscription_id: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
    active_plan_id: {
      type: DataTypes.INTEGER,
      defaultValue: null,
    },
    current_subscription_id: {
      type: DataTypes.INTEGER,
      defaultValue: null,
    },
  },
  {
    tableName: "users",
    timestamps: true,
  },
);

User.belongsTo(Plan, {
  foreignKey: "active_plan_id",
  as: "subscriber",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

Plan.hasMany(User, {
  foreignKey: "active_plan_id",
  as: "subscriber",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// (async () => {
//     try {
//         await User.sync({ alter: true });
//         console.log("✅ User table synced successfully");
//     } catch (err) {
//         console.error("❌ Error syncing User table:", err);
//     }
// })();

module.exports = User;
