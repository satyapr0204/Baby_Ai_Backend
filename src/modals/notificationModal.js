const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const User = require("./userModal.js");

const NotificationSchema = sequelize.define(
    "User_notification",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        notification_message: {
            type: DataTypes.STRING,
        },
        is_read: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    },{
    tableName: 'user_notification',
    timestamps: true
});

NotificationSchema.belongsTo(User,{
    foreignKey: "user_id",
    as: "notification",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
});

User.hasMany(NotificationSchema,{
    foreignKey: "user_id",
    as: "notification",
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
});


module.exports = NotificationSchema