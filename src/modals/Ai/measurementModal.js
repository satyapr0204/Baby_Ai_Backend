const { DataTypes } = require("sequelize");
const { sequelize } = require("../../../dbConfig");

const Measurement = sequelize.define(
  "Measurement",
  {
    height: {
      type: DataTypes.FLOAT,
    },
    weight: {
      type: DataTypes.FLOAT,
    },
    chest: {
      type: DataTypes.FLOAT,
    },
    waist: {
      type: DataTypes.FLOAT,
    },
    hip: {
      type: DataTypes.FLOAT,
    },
    recommended_size: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "measurements",
    timestamps: true,
  },
);

module.exports = Measurement;
