const cron = require("node-cron");
const fs = require("fs-extra");
const Category = require("./src/modals/categoriesModal");
const Retailer = require("./src/modals/retailerModal");

const syncCategories = async () => {
  console.log(`[${new Date().toLocaleString()}] Cron Job Started...`);

  try {
    const jsonData = await fs.readJson("./Category.json");

    for (const item of jsonData) {
      const existingCategory = await Category.findOne({
        where: { category_id: item.category_id },
      });

      if (existingCategory) {
        if (
          parseFloat(existingCategory.actual_price) !== parseFloat(item.pricing)
        ) {
          const newPricing = parseFloat(item.pricing);
          const discountPercent = parseFloat(existingCategory.discount || 0);

          const calculatedMargin =
            newPricing - newPricing * (discountPercent / 100);
          await existingCategory.update({
            categories_name: item.category_name,
            retailer_count: item.retailer_count,
            total_products: item.total_products,
            actual_price: initialPricing,
            pricing_markup: newPricing,
            total_margin: calculatedMargin,
          });
          console.log(
            `Updated: ID ${item.category_id} (Price & Margin changed)`,
          );
        } else {
          await existingCategory.update({
            categories_name: item.category_name,
            retailer_count: item.retailer_count,
            total_products: item.total_products,
          });
        }
      } else {
        const initialPricing = parseFloat(item.pricing);
        await Category.create({
          category_id: item.category_id,
          categories_name: item.category_name,
          retailer_count: item.retailer_count,
          total_products: item.total_products,
          actual_price: initialPricing,
          pricing_markup: initialPricing,
          discount: 0,
          total_margin: 0,
        });
        console.log(`Created: ID ${item.category_id}`);
      }
    }
    console.log("✅ Sync Finished.");
  } catch (error) {
    console.error("❌ Sync Error:", error.message);
  }
};

const syncRetailers = async () => {
  console.log(`[${new Date().toLocaleString()}] Retailer Cron Job Started...`);

  try {
    const jsonData = await fs.readJson("./retailerData.json");

    for (const item of jsonData) {
      const existingRetailer = await Retailer.findOne({
        where: { retailer_id: item.retailer_id },
      });

      if (existingRetailer) {
        await existingRetailer.update({
          retailer_name: item.retailer_name,
          status: item.status,
          products_count: item.products_count,
          actual_price: parseFloat(item.addon_price || 40),
          selected_categories: item.categories,
          last_sync: new Date(),
        });
        console.log(`Updated Retailer: ${item.retailer_id}`);
      } else {
        await Retailer.create({
          retailer_id: item.retailer_id,
          retailer_name: item.retailer_name,
          status: item.status || "Active",
          products_count: item.products_count || 0,
          actual_price: parseFloat(item.addon_price || 40),
          selected_categories: item.categories,
          email: item.email || null,
          last_sync: new Date(),
        });
        console.log(`Created Retailer: ${item.retailer_id}`);
      }
    }
    console.log("✅ Retailer Sync Finished.");
  } catch (error) {
    console.error("❌ Retailer Sync Error:", error.message);
  }
};

cron.schedule("*/15 * * * *", syncRetailers);
cron.schedule("*/10 * * * *", syncCategories);

module.exports = { syncCategories, syncRetailers };
