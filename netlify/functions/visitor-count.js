const { getStore } = require("@netlify/blobs");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  try {
    const store = getStore("visitor-counts");

    // Build time-keyed bucket names (UTC)
    const now = new Date();
    const Y   = now.getUTCFullYear();
    const M   = now.getUTCMonth() + 1;
    const D   = now.getUTCDate();
    const dayKey   = `day-${Y}-${M}-${D}`;
    const monthKey = `month-${Y}-${M}`;
    const yearKey  = `year-${Y}`;
    const totalKey = `total`;

    // Helper: read a key safely (returns 0 if missing)
    async function readNum(key) {
      try {
        const val = await store.get(key);
        return parseInt(val || "0", 10);
      } catch {
        return 0;
      }
    }

    // ── GET: return current counts without touching them ──────────────────
    if (event.httpMethod === "GET") {
      const [daily, monthly, yearly, total] = await Promise.all([
        readNum(dayKey),
        readNum(monthKey),
        readNum(yearKey),
        readNum(totalKey),
      ]);
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ daily, monthly, yearly, total }),
      };
    }

    // ── POST: increment all four counters atomically ──────────────────────
    if (event.httpMethod === "POST") {
      const [d, m, y, t] = await Promise.all([
        readNum(dayKey),
        readNum(monthKey),
        readNum(yearKey),
        readNum(totalKey),
      ]);

      const daily   = d + 1;
      const monthly = m + 1;
      const yearly  = y + 1;
      const total   = t + 1;

      await Promise.all([
        store.set(dayKey,   String(daily)),
        store.set(monthKey, String(monthly)),
        store.set(yearKey,  String(yearly)),
        store.set(totalKey, String(total)),
      ]);

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ daily, monthly, yearly, total }),
      };
    }

    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };

  } catch (err) {
    console.error("[visitor-count]", err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Server error", daily: 0, monthly: 0, yearly: 0, total: 0 }),
    };
  }
};
