// module.exports = (sequelize, DataTypes) => {
//     return sequelize.define("Color", {
//         name: {
//             type: DataTypes.STRING,
//             unique: true,
//         },
//     });
// };





const { DataTypes } = require("sequelize");
const { sequelize } = require("../../../dbConfig");


const Color = sequelize.define("Color", {
  name: {
    type: DataTypes.STRING,
    unique: true,
  },
}, {
  tableName: "colors",
  timestamps: true,
});

// (async () => {
//   try {
//     await Color.sync({ alter: true });
//   } catch (err) {}
// })();

module.exports = Color;