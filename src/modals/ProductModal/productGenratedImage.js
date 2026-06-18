const { DataTypes } = require("sequelize");
const { sequelize } = require("../../../dbConfig");


const productGenratedImage = sequelize.define('ProductAIImage', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ai_image: { type: DataTypes.STRING, allowNull: false },
    prompt_used: { type: DataTypes.TEXT }
}, {
    tableName: "product_ai_images",
    timestamps: true
});

// Product.hasOne(ProductAIImage, { foreignKey: 'product_id', as: 'aiImage' });
// ProductAIImage.belongsTo(Product, { foreignKey: 'product_id' });

module.exports = productGenratedImage;