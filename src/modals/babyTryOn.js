const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const User = require("./userModal.js");
const BabyProfile = require("./babyProfileModal.js");
const Product = require("./ProductModal/product.js");

const BabyTRYON = sequelize.define(
    "Baby_try_on",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        try_on_avtar: {
            type: DataTypes.STRING
        }
    },
    {
        tableName: "Baby_try_on",
        timestamps: true
    }
)

BabyTRYON.belongsTo(User, {
    foreignKey: "try_on_user_id",
    as: "tryOnUsers",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
});

User.hasMany(BabyTRYON, {
    foreignKey: "try_on_user_id",
    as: "tryOnUsers",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
});

BabyTRYON.belongsTo(BabyProfile, {
    foreignKey: "try_on_baby_id",
    as: "tryOnBabys",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
});

BabyProfile.hasMany(BabyTRYON, {
    foreignKey: "try_on_baby_id",
    as: "tryOnBabys",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
});

BabyTRYON.belongsTo(Product, {
    foreignKey: "try_on_product_id",
    as: "tryOnProducts",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
});

Product.hasMany(BabyTRYON, {
    foreignKey: "try_on_product_id",
    as: "tryOnProducts",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
});

module.exports = {
    BabyTRYON
}