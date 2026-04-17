require("dotenv").config();
const { Sequelize } = require("sequelize");


const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
);


// const Admin=require('./src/modals/adminsModal')
// const User=require('./src/modals/userModal')
// const BabyProfile=require('./src/modals/babyProfileModal')
// const Banner=require('./src/modals/bannerModal')
// const Cart=require('./src/modals/cartModal')
// const FAQ=require('./src/modals/faqModal')
// const FlashMessage=require('./src/modals/flashMessageModal')
// const FlashMessageEnable=require('./src/modals/flashMessageEnableModa')
// const MinAndMax=require('./src/modals/minAndMaxModal')
// const StaticPage=require('./src/modals/staticPageModal')
// const Address=require('./src/modals/addressModal')
// const Brand=require('./src/modals/ProductModal/brand')
// const Wishlist=require('./src/modals/userWishlistModal')
// const Category=require('./src/modals/ProductModal/category')
// const Color=require('./src/modals/ProductModal/color')
// const Fabric=require('./src/modals/ProductModal/fabric')
// const Gender=require('./src/modals/ProductModal/gender')
// const Product=require('./src/modals/ProductModal/product')
// const Retailer=require('./src/modals/ProductModal/retailer')
// const Size=require('./src/modals/ProductModal/size')


(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log("✅ Database connection has been established successfully.");
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error.message);
  }
})();

module.exports = { sequelize };
