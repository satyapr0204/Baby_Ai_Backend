// const Sequelize = require("sequelize");
// const {sequelize} = require("../../../dbConfig");

// const db = {};

// db.Sequelize = Sequelize;
// db.sequelize = sequelize;

// db.Product = require("./product")(sequelize, Sequelize);

// db.Fabric = require("./fabric")(sequelize, Sequelize);
// db.Color = require("./color")(sequelize, Sequelize);
// db.Gender = require("./gender")(sequelize, Sequelize);
// db.Size = require("./size")(sequelize, Sequelize);
// db.Brand = require("./brand")(sequelize, Sequelize);
// db.Category = require("./category")(sequelize, Sequelize);

// // associations
// Object.keys(db).forEach((modelName) => {
//     if (db[modelName].associate) {
//         db[modelName].associate(db);
//     }
// });

// module.exports = db;