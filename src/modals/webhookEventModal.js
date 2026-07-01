const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js"); // Aapka path

const WebhookEvent = sequelize.define(
    "webhook_event",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        event_id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true, 
        },
    },
    {
        tableName: "webhook_events",
        timestamps: true, 
    }
);

module.exports = WebhookEvent;