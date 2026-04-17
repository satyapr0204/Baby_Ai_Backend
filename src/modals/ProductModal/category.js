const { DataTypes } = require("sequelize");
const { sequelize } = require("../../../dbConfig");


const Category = sequelize.define(
  "Category",
  {
    name: {
      type: DataTypes.STRING,
      unique: true,
    },
    image: {
      type: DataTypes.STRING,
    },
    is_active: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    price_range: {
      type: DataTypes.STRING,
      defaultValue: 0.0,
    },
    discount_percentage: {
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
  },
  {
    tableName: "categories",
    timestamps: true,
  },
);

module.exports = Category;


const Retailer = require("./retailer"); 
Category.belongsToMany(Retailer, { 
    through: "RetailerCategories", 
    foreignKey: "category_id",
    as: "retailers" 
});