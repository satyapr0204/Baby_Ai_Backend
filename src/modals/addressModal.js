const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const User = require("./userModal.js");

const Address = sequelize.define(
  "User_Address",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    address_type: {
      type: DataTypes.STRING,
    },
    street_address: {
      type: DataTypes.STRING,
    },
    apartment: {
      type: DataTypes.STRING,
    },
    city: {
      type: DataTypes.STRING,
    },
    state: {
      type: DataTypes.STRING,
    },
    zip_code: {
      type: DataTypes.STRING,
    },
    is_active: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    is_delete: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_default: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lat: {
      type: DataTypes.STRING,
    },
    long: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "user_address",
    timestamps: true,
  },
);

Address.belongsTo(User, {
  foreignKey: "user_id",
  as: "address",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

User.hasMany(Address, {
  foreignKey: "user_id",
  as: "address",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// (async () => {
//   try {
//     await Address.sync({ alter: true });
//     console.log("✅ Address table synced successfully");
//   } catch (err) {
//     console.error("❌ Error syncing Address table:", err);
//   }
// })();

module.exports = Address;
