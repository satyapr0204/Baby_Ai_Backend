const { DataTypes } = require("sequelize");
const { sequelize } = require("../../dbConfig.js");
const User = require("./userModal.js");

const Wishlist = sequelize.define(
  "User_Wishlist",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    is_delete: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "user_wishlist",
    timestamps: true,
  },
);
Wishlist.belongsTo(User, {
  foreignKey: "user_id",
  as: "wishlists",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

User.hasMany(Wishlist, {
  foreignKey: "user_id",
  as: "wishlists",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// (async () => {
//   try {
//     await Wishlist.sync({ alter: true });
//     console.log("✅ User wishlist table synced successfully");
//   } catch (err) {
//     console.error("❌ Error syncing User  wishlist table :", err);
//   }
// })();

module.exports = { Wishlist };
