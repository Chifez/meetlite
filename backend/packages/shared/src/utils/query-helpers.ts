import { Query } from 'mongoose';

/**
 * Shared Database Query Helpers
 * 
 * Common database operations and utilities
 */

/**
 * Pagination helper
 * @param query - Mongoose query object
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @returns Modified query with pagination
 */
export const paginate = <T, DocType>(
  query: Query<T, DocType>,
  page: number = 1,
  limit: number = 10
): Query<T, DocType> => {
  const skip = (page - 1) * limit;
  return query.skip(skip).limit(limit);
};

/**
 * Sort helper
 * @param query - Mongoose query object
 * @param sortBy - Field to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Modified query with sorting
 */
export const sort = <T, DocType>(
  query: Query<T, DocType>,
  sortBy: string = 'createdAt',
  order: string = 'desc'
): Query<T, DocType> => {
  const sortOrder = order === 'asc' ? 1 : -1;
  return query.sort({ [sortBy]: sortOrder });
};

/**
 * Search helper for text fields
 * @param query - Mongoose query object
 * @param searchTerm - Search term
 * @param fields - Fields to search in
 * @returns Modified query with search
 */
export const search = <T, DocType>(
  query: Query<T, DocType>,
  searchTerm: string,
  fields: string[]
): Query<T, DocType> => {
  if (!searchTerm || !fields.length) return query;

  const searchRegex = new RegExp(searchTerm, 'i');
  const searchQuery = fields.map((field) => ({ [field]: searchRegex }));

  return query.find({ $or: searchQuery } as any) as any;
};
