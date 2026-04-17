const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");

const FlashMessage = sequelize.define(
  "FlashMessageEable",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    is_enabled: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
  },
  {
    tableName: "flash_message_enable",
    timestamps: true,
  },
);
// (async () => {
//   try {
//     await FlashMessage.sync({ alter: true });
//     console.log("✅ FlashMessageEable table synced successfully");
//   } catch (err) {
//     console.error("❌ Error syncing FlashMessageEable table:", err);
//   }
// })();

module.exports = FlashMessage;
