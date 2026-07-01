const { DataTypes } = require('sequelize');
const { sequelize } = require('../../dbConfig');
const User = require('./userModal');
const Plan = require('./planModal');
const Transaction = require('./transactionModal');

const SubscriberShema = sequelize.define('Subscribers', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    stripe_subscription_id: {
        type: DataTypes.STRING
    },
    transaction_id: {
        type: DataTypes.STRING
    },
    payment_method: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.STRING
    },
    payment_status: {
        type: DataTypes.STRING
    },
    stripe_invoice_url: {
        type: DataTypes.STRING
    },
    stripe_invoice_pdf: {
        type: DataTypes.STRING
    },
    start_date: {
        type: DataTypes.DATE
    },
    end_date: {
        type: DataTypes.DATE
    },
    cancelled_at: {
        type: DataTypes.DATE
    },
    inner_transaction_id: {
        type: DataTypes.INTEGER
    }
}, {
    tableName: 'Subscribers',
    timestamps: true
})

SubscriberShema.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'subscribers',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
});

User.hasMany(SubscriberShema, { foreignKey: 'user_id', as: 'subscribers' });

SubscriberShema.belongsTo(Plan, {
    foreignKey: 'plan_id',
    as: 'plan',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
});

Plan.hasMany(SubscriberShema, { foreignKey: 'plan_id', as: 'plan' });

// SubscriberShema.belongsTo(Transaction, {
//     foreignKey: 'inner_transaction_id',
//     as: 'subscriber_transaction',
//     onDelete: 'SET NULL',
//     onUpdate: 'CASCADE'
// });

// Transaction.hasMany(SubscriberShema, { foreignKey: 'inner_transaction_id', as: 'subscriber_transaction' });

(async () => {
    try {
        await SubscriberShema.sync({ alter: true });
        console.log("✅ Subscriber table synced successfully");
    } catch (err) {
        console.error("❌ Error syncing Subscriber table:", err);
    }
})();

module.exports = SubscriberShema