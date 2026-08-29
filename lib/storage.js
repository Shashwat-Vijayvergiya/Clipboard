/**
 * Unified Storage Adapter for QuickClip
 * - Uses Upstash Redis on Vercel (Auto TTL expiration)
 * - Seamlessly falls back to In-Memory Map in local development if Redis credentials are not set
 */

const { Redis } = require('@upstash/redis');

let redisClient = null;
const memoryStore = new Map();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (redisUrl && redisToken) {
  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken
    });
    console.log('✅ Connected to Upstash Redis (Vercel Serverless Storage)');
  } catch (err) {
    console.warn('⚠️ Could not initialize Redis client, using in-memory store:', err.message);
  }
} else {
  console.log('ℹ️ Running with in-memory storage (Local Development)');
}

/**
 * Generate a unique 4-digit code (1000-9999)
 */
async function generateUniqueCode() {
  let attempts = 0;
  while (attempts < 100) {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const exists = await getClip(code);
    if (!exists) return code;
    attempts++;
  }
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Save a clip with expiration (TTL in seconds)
 */
async function saveClip(code, clipData, ttlSeconds = 300) {
  if (redisClient) {
    // Redis handles auto-deletion natively with EX (seconds)
    await redisClient.set(`clip:${code}`, JSON.stringify(clipData), { ex: ttlSeconds });
    return clipData;
  }

  // In-Memory Fallback
  memoryStore.set(code, clipData);
  return clipData;
}

/**
 * Retrieve a clip by its 4-digit code
 */
async function getClip(code) {
  if (!code) return null;
  const cleanCode = code.trim();

  if (redisClient) {
    const data = await redisClient.get(`clip:${cleanCode}`);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  // In-Memory Fallback
  const clip = memoryStore.get(cleanCode);
  if (!clip) return null;
  if (clip.expiresAt && clip.expiresAt <= Date.now()) {
    memoryStore.delete(cleanCode);
    return null;
  }
  return clip;
}

/**
 * Delete a clip
 */
async function deleteClip(code) {
  if (!code) return;
  const cleanCode = code.trim();

  if (redisClient) {
    await redisClient.del(`clip:${cleanCode}`);
    return;
  }

  memoryStore.delete(cleanCode);
}

module.exports = {
  saveClip,
  getClip,
  deleteClip,
  generateUniqueCode
};
