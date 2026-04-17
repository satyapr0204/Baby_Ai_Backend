/**
 * @param {number} page - Current page number (default: 1)
 * @param {number} size - Items per page (default: 10)
 * @returns {object} - { limit, offset }
 */
const getPagination = (page, size) => {
  const limit = size ? +size : 10; // Agar size nahi hai toh default 10
  const offset = page ? (page - 1) * limit : 0; // Page 1 ka offset 0 hoga

  return { limit, offset };
};

/**
 * @param {object} data - Sequelize findAndCountAll ka result
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {object} - Formatted response with metadata
 */
const getPagingData = (data, page, limit) => {
  const { count: totalItems, rows: items } = data;
  const currentPage = page ? +page : 1;
  const totalPages = Math.ceil(totalItems / limit);

  return {
    items,
    pagination: {
      current_page: currentPage,
      per_page: limit,
      total_items: totalItems,
      total_pages: totalPages,
    },
  };
};

module.exports = { getPagination, getPagingData };
