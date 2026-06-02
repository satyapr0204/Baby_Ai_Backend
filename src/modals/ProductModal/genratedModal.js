const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const Product = require("./product.js");

const GeneratedImageModal = sequelize.define(
  "generated_modal",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    modal_image:{
        type: DataTypes.STRING,
    }
},
  {
    tableName: "generated_modal",
    timestamps: true,
  },
);

GeneratedImageModal.belongsTo(Product, { foreignKey: "product_id", as: "product_modal" });
Product.hasOne(GeneratedImageModal, { foreignKey: "product_id", as: "product_modal" });


(async () => {
  try {
    await GeneratedImageModal.sync({ alter: true });
    console.log("✅ Generated Modal table synced successfully");
  } catch (err) {
    console.error("❌ Error syncing Generated Modal table:", err);
  }
})();

module.exports = GeneratedImageModal;