/**
 * Array ko paginate karne ke liye function
 * @param {Array} items - Poora processed data (Array)
 * @param {number} page - Current page number
 * @param {number} size - Items per page
 * @returns {object} - Paginated data with metadata
 */
const paginateArray = (items, page, size,key) => {
  const currentPage = page ? +page : 1;
  const limit = size ? +size : 10;
  const offset = (currentPage - 1) * limit;

  const paginatedItems = items.slice(offset, offset + limit);
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / limit);

  return {
     paginatedItems,
    pagination: {
      total_items: totalItems,
      total_pages: totalPages,
      current_page: currentPage,
      per_page: limit,
    },
  };
};

module.exports = { paginateArray };