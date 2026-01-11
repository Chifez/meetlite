/**
 * Shared Database Query Helpers
 * 
 * Common database operations and utilities
 */

/**
 * Pagination helper
 * @param {Object} query - Mongoose query object
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @returns {Object} Modified query with pagination
 */
export const paginate = (query, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    return query.skip(skip).limit(limit);
  };
  
  /**
   * Sort helper
   * @param {Object} query - Mongoose query object
   * @param {string} sortBy - Field to sort by
   * @param {string} order - Sort order ('asc' or 'desc')
   * @returns {Object} Modified query with sorting
   */
  export const sort = (query, sortBy = 'createdAt', order = 'desc') => {
    const sortOrder = order === 'asc' ? 1 : -1;
    return query.sort({ [sortBy]: sortOrder });
  };
  
  /**
   * Search helper for text fields
   * @param {Object} query - Mongoose query object
   * @param {string} searchTerm - Search term
   * @param {Array} fields - Fields to search in
   * @returns {Object} Modified query with search
   */
  export const search = (query, searchTerm, fields) => {
    if (!searchTerm || !fields.length) return query;
    
    const searchRegex = new RegExp(searchTerm, 'i');
    const searchQuery = fields.map(field => ({ [field]: searchRegex }));
    
    return query.find({ $or: searchQuery });
  };