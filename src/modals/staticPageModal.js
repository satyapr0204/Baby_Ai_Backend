const { DataTypes } = require('sequelize');
const { sequelize } = require('../../dbConfig.js');


const StaticPage = sequelize.define('StaticPage', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING,
        // allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        // allowNull: false
    },
    is_active: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    is_delete: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'static_pages',
    timestamps: true,
});

// (async () => {
//     try {
//         await StaticPage.sync({ alter: true });
//         console.log("✅ StaticPage table synced successfully");
//     } catch (err) {
//         console.error("❌ Error syncing StaticPage table:", err);

//     }
// })();

module.exports = StaticPage;