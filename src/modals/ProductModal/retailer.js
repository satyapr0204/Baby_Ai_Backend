const { DataTypes } = require("sequelize");
const { sequelize } = require("../../../dbConfig");
const Retailer = sequelize.define(
  "Retailer",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      unique: true,
    },
    is_active: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    price_range: {
      type: DataTypes.STRING,
    },
    discount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    total_margin: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    addon_percentage: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    selected_categories: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
  },
  {
    tableName: "retailers",
    timestamps: true,
  },
);

// (async () => {
//   try {
//     await Retailer.sync({ alter: true });
//     console.log("✅ Retailer table synced successfully");
//   } catch (err) {
//     console.error("❌ Error syncing Retailer table:", err);
//   }
// })();

module.exports = Retailer;

const Category = require("./category");

Retailer.belongsToMany(Category, {
  through: "RetailerCategories",
  foreignKey: "retailer_id",
  as: "categories",
});
