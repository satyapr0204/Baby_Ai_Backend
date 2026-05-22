const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const User = require("./userModal.js");

const Subscription = sequelize.define("subscription", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
});
