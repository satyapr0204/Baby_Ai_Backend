const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const User = require("../modals/userModal.js");


const ScanToken = sequelize.define(
    "user_scan_token",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        total_scan_token: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        remaining_scan_token: {
            type: DataTypes.INTEGER
        },
        used_scan_token: {
            type: DataTypes.INTEGER
        },
        type: {
            type: DataTypes.ENUM('plan', 'topup'), // 'plan' (monthly cycle) ya 'topup' (extra buy kiya)
            defaultValue: 'plan'
        },
        expired_at: {
            type: DataTypes.DATE
        }
    }, {
    tableName: 'user_scan_token',
    timestamps: true
});


ScanToken.belongsTo(User, {
    foreignKey: "user_id",
    as: "scan_token",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
});

User.hasMany(ScanToken, {
    foreignKey: "user_id",
    as: "scan_token",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
});


module.exports = ScanToken