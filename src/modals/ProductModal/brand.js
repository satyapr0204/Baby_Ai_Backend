// module.exports = (sequelize, DataTypes) => {
//     return sequelize.define("Brand", {
//         name: {
//             type: DataTypes.STRING,
//             unique: true,
//         },
//     });

// };


const { DataTypes } = require("sequelize");
const { sequelize } = require("../../../dbConfig");


const Brand = sequelize.define(
  "Brand",
  {
    name: {
      type: DataTypes.STRING,
      unique: true,
    },
  },
  {
    tableName: "brands",
    timestamps: true,
  },
);

// (async () => {
//   try {
//     await Brand.sync({ alter: true });
//   } catch (err) {}
// })();

module.exports = Brand;
