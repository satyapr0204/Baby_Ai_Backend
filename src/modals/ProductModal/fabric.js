// module.exports = (sequelize, DataTypes) => {
//     return sequelize.define("Fabric", {
//         name: {
//             type: DataTypes.STRING,
//             unique: true,
//         },
//     });
// };



const { DataTypes } = require("sequelize");
const { sequelize } = require("../../../dbConfig");

const Fabric = sequelize.define("Fabric", {
  name: {
    type: DataTypes.STRING,
    unique: true,
  },
}, {
  tableName: "fabrices",
  timestamps: true,
});

// (async () => {
//   try {
//     await Fabric.sync({ alter: true });
//     console.log("Fabric table synced!");
//   } catch (err) {
//     console.error("Fabric sync error:", err);
//   }
// })();

module.exports = Fabric;