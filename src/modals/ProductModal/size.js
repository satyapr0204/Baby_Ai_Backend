// module.exports = (sequelize, DataTypes) => {
//     return sequelize.define("Size", {
//         name: {
//             type: DataTypes.STRING,
//             unique: true,
//         },
//     });
// };

const { DataTypes } = require("sequelize");
const { sequelize } = require("../../../dbConfig");

const Size = sequelize.define(
  "Size",
  {
    name: {
      type: DataTypes.STRING,
      unique: true,
    },
  },
  {
    tableName: "sizes",
    timestamps: true,
  },
);

// (async () => {
//   try {
//     await Size.sync({ alter: true });
//   } catch (err) {}
// })();

module.exports = Size;
