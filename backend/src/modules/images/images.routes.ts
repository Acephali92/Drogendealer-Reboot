import type { FastifyPluginAsync } from 'fastify';
import { imageFallbacks } from '../../domain/index.js';

/**
 * Public image configuration (ADR-020, T-114): fallback image per category and the allowed file
 * extensions, taken from parameters.toml [images]. Static configuration only – no player data.
 * Paths are relative to the frontend's `images/` folder; the frontend prefixes its BASE_URL.
 */
const imageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/images', async () => ({
    fallback: imageFallbacks(app.gameParams),
    allowedExtensions: app.gameParams.images?.allowed_extensions ?? ['.webp', '.png', '.svg'],
  }));
};

export default imageRoutes;
