const { DataTypes } = require("sequelize");
const { sequelize } = require("../../../dbConfig.js");
const User = require("../userModal.js");

const recentSearch = sequelize.define(
    "Recent_Search",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
    }, {
    tableName: "Recent_Search",
    timestamps: true

});

recentSearch.belongsTo(User, {
    foreignKey: "user_id",
    as: "recentUser",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
});

User.hasMany(recentSearch, {
    foreignKey: "user_id",
    as: "recentUser",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
});


module.exports = recentSearch