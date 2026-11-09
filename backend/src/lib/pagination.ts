import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

/** Query schema for offset pagination: ?limit=20&offset=0 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const idParamSchema = z.object({ id: z.string().min(1).max(64) });
export const slugParamSchema = z.object({ slug: z.string().min(1).max(64) });
