const Redis = require("ioredis");

// Dedicated Redis connection for rate-limit bookkeeping only. Kept separate
// from the BullMQ connection used in documentWorker.js — BullMQ puts its
// connection into special blocking/subscriber modes internally, so it's
// safer not to share it with arbitrary app-level commands like INCR/EXPIRE.
const redis = new Redis(process.env.REDIS_URL);

redis.on("error", (err) => {
  console.error("[RateLimit] ⚠️ Redis connection error:", err.message);
});

/**
 * Free-tier caps as shown on this project's Google AI Studio dashboard
 * ("Rate limits by model"). Google can change these without notice, and
 * they reset automatically once you enable billing — if that happens,
 * update (or remove) the numbers below to match your dashboard.
 */
const MODEL_LIMITS = {
  "gemini-3.7-flash": { rpm: 5, rpd: 20 },
  "gemini-3.6-flash": { rpm: 5, rpd: 20 },
  "gemini-3.5-flash": { rpm: 5, rpd: 20 },
};

class RateLimitExceededError extends Error {
  constructor(message, retryAfterSeconds) {
    super(message);
    this.name = "RateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function utcDateKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function utcMinuteKey() {
  return new Date().toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

function secondsUntilNextUtcMidnight() {
  const now = new Date();
  const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.ceil((nextMidnight - now) / 1000);
}

/**
 * Reserves one "slot" for a call to `modelName` against OUR OWN tracked
 * daily/per-minute counters, BEFORE the real network call to Gemini is
 * made. Throws RateLimitExceededError if this call would exceed the
 * free-tier caps above, so the app fails fast with a friendly message
 * instead of waiting on a network round trip that Google would reject
 * anyway — and without burning a retry on something retrying can't fix.
 *
 * Uses Redis INCR/EXPIRE so the count is correctly shared between the
 * Express web process and the BullMQ worker — they run in the same
 * process today per server.js, but this also stays correct if you ever
 * split them into separate processes/dynos later.
 *
 * The daily window resets at UTC midnight here as an approximation —
 * Google doesn't publish its exact internal reset time, so this may not
 * line up to the minute. Worst case this blocks a little earlier or
 * later than Google's real cutoff; it's a minor inconvenience, not a
 * correctness bug. Likewise the per-minute window is a simple fixed
 * window (grouped by clock-minute), not a sliding one — good enough for
 * this purpose without adding real complexity.
 */
async function reserveGeminiCall(modelName) {
  const limits = MODEL_LIMITS[modelName];
  if (!limits) return; // no known cap for this model name — nothing to enforce

  const dayKey = `gemini:rpd:${modelName}:${utcDateKey()}`;
  const dayCount = await redis.incr(dayKey);
  if (dayCount === 1) {
    await redis.expire(dayKey, 60 * 60 * 26); // ~1 day + safety margin
  }
  if (dayCount > limits.rpd) {
    throw new RateLimitExceededError(
      `Daily free-tier limit (${limits.rpd}/day) reached for ${modelName}.`,
      secondsUntilNextUtcMidnight()
    );
  }

  const minuteKey = `gemini:rpm:${modelName}:${utcMinuteKey()}`;
  const minuteCount = await redis.incr(minuteKey);
  if (minuteCount === 1) {
    await redis.expire(minuteKey, 90); // a little over 1 minute
  }
  if (minuteCount > limits.rpm) {
    throw new RateLimitExceededError(
      `Per-minute free-tier limit (${limits.rpm}/min) reached for ${modelName}.`,
      60
    );
  }
}

function isRetryableGoogleError(err) {
  return err?.status === 503 || /503|overloaded|high demand/i.test(err?.message || "");
}

/**
 * Calls `model.generateContent(prompt)`, first reserving a slot via
 * reserveGeminiCall for every attempt (including retries, since each
 * retry is itself a real request against the per-minute cap). Retries
 * with backoff ONLY on genuine transient "high demand" (503) errors.
 *
 * A RateLimitExceededError from reserveGeminiCall is intentionally left
 * outside the try/catch below, so it propagates immediately — retrying a
 * quota you've already exceeded wastes time and cannot succeed.
 */
async function generateWithRetry(model, modelName, prompt, { retries = 2, baseDelayMs = 1000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await reserveGeminiCall(modelName);
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      if (!isRetryableGoogleError(err) || attempt === retries) break;
      const delay = baseDelayMs * Math.pow(2, attempt); // 1s, 2s, 4s...
      console.warn(`[Gemini] ⏳ ${modelName} overloaded, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

module.exports = {
  reserveGeminiCall,
  generateWithRetry,
  isRetryableGoogleError,
  RateLimitExceededError,
  MODEL_LIMITS,
};