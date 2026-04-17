const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");

const FlashMessage = sequelize.define(
  "Flash_Message",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    message: {
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
    tableName: "flash_message",
    timestamps: true,
  },
);

// (async () => {
//   try {
//     await FlashMessage.sync({ alter: true });
//     console.log("✅ Flash Message table synced successfully");
//   } catch (err) {
//     console.error("❌ Error syncing Flash Message table:", err);
//   }
// })();

module.exports = FlashMessage;
