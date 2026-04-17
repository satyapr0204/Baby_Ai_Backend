const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const User = require("./userModal.js");

const BabyProfile = sequelize.define(
  "BabyProfile",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    baby_nikname: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    baby_profile_image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    age_range: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    baby_gender: {
      type: DataTypes.ENUM("Male", "Female", "Boy", "Girl", "Other"),
      // allowNull: false
    },
    fabric_preferences: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    preferred_colors: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    body_style: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    is_delete: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "baby_profiles",
    timestamps: true,
  },
);

BabyProfile.belongsTo(User, {
  foreignKey: "user_id",
  as: "babies",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

User.hasMany(BabyProfile, {
  foreignKey: "user_id",
  as: "babies",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// (async () => {
//   try {
//     await BabyProfile.sync({ alter: true });
//     console.log("✅ BabyProfile table updated/synced successfully");
//   } catch (err) {
//     console.error("❌ Error syncing BabyProfile table:", err);
//   }
// })();

module.exports = BabyProfile;
