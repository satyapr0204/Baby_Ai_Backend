// module.exports = (sequelize, DataTypes) => {
//     return sequelize.define("Gender", {
//         name: {
//             type: DataTypes.STRING,
//             unique: true,
//         },
//     });
// };




const { DataTypes } = require("sequelize");
const { sequelize } = require("../../../dbConfig");

const Gender = sequelize.define("Gender", {
  name: {
    type: DataTypes.STRING,
    unique: true,
  },
}, {
  tableName: "genders",
  timestamps: true,
});

// (async () => {
//   try {
//     await Gender.sync({ alter: true });
//   } catch (err) {}
// })();

module.exports = Gender;