const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");

const Banner = sequelize.define(
  "Banner",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    location: {
      type: DataTypes.STRING,
    },
    banner_url: {
      type: DataTypes.STRING,
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    heading: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.STRING,
    },
    redirection_link: {
      type: DataTypes.STRING,
    },
    start_offer_date: {
      type: DataTypes.DATE,
    },
    end_offer_date: {
      type: DataTypes.DATE,
    },
    is_active: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    }
  },
  {
    tableName: "banners",
    timestamps: true,
  },
);

// (async () => {
//   try {
//     await Banner.sync({ alter: true });
//     console.log("✅ Banner table synced successfully");
//   } catch (err) {
//     console.error("❌ Error syncing Banner table:", err);
//   }
// })();

module.exports = Banner;
