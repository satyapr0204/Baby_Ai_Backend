const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");

const AddOneToken = sequelize.define(
    "add_on_token_plan",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        plan_name: {
            type: DataTypes.STRING,
        },
        price: {
            type: DataTypes.DECIMAL,
            defaultValue: 0.0,
        },
        token_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        is_active: {
            type: DataTypes.INTEGER,
            defaultValue: 1
        }
    }, {
    tableName: 'add_on_token_plan',
    timestamps: true
})


module.exports = AddOneToken