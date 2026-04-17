const { DataTypes } = require('sequelize');
const { sequelize } = require('../../dbConfig.js');

const FAQ = sequelize.define('FAQ', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    question: {
        type: DataTypes.STRING,
        // allowNull: false
    },
    answer: {
        type: DataTypes.TEXT,
        // allowNull: false
    },
    is_active: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    }
}, {
    tableName: 'faqs',
    timestamps: true,
});

// (async () => {
//     try {
//         await FAQ.sync({ alter: true });
//         console.log("✅ FAQ table synced successfully");
//     } catch (err) {
//         console.error("❌ Error syncing FAQ table:", err);
//     }
// })();

module.exports = FAQ;