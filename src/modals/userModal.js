const { DataTypes } = require('sequelize');
const { sequelize } = require('../../dbConfig.js');


const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    phone: {
        type: DataTypes.STRING
    },
    profile_image: {
        type: DataTypes.STRING
    },
    is_profile_complete: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    is_new_user: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    name: {
        type: DataTypes.STRING,
    },
    orders: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    is_active: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    is_delete: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    current_step: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    fcm_token:{
        type: DataTypes.STRING,
    }
}, {
    tableName: 'users',
    timestamps: true,
});

// (async () => {
//     try {
//         await User.sync({ alter: true });
//         console.log("✅ User table synced successfully");
//     } catch (err) {
//         console.error("❌ Error syncing User table:", err);
//     }
// })();

module.exports = User;