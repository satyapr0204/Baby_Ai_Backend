const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");

const MinAndMax = sequelize.define(
  "Min_And_Max",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    min: {
      type: DataTypes.STRING,
    },
    max: {
      type: DataTypes.STRING,
    },
    type: {
      type: DataTypes.STRING,
    },
    is_active: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
  },
  {
    tableName: "min_and_max",
    timestamps: true,
  },
);

// (async () => {
//   try {
//     await MinAndMax.sync({ alter: true });
//     console.log("✅ Min And Max table synced successfully");
//   } catch (err) {
//     console.error("❌ Error syncing Min And Max table:", err);
//   }
// })();

module.exports = MinAndMax;
