const { DataTypes } = require('sequelize');
const { sequelize } = require('../../dbConfig.js');

const Admin = sequelize.define('Admins', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    is_admin: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    is_deleted: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'admins',
    timestamps: true,
});

// (async () => {
//     try {
//         await Admin.sync({ alter: true });
//         console.log("✅ Admin table synced successfully");
//     } catch (err) {
//         console.error("❌ Error syncing Admin table:", err);
//     }
// })();

module.exports = Admin;