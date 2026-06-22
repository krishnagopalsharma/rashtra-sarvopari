const crypto = require("node:crypto");

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  },
  body: JSON.stringify(body),
});

const normalizeUsername = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

const base64url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const secret = () =>
  process.env.RASHTRA_AUTH_SECRET ||
  process.env.NETLIFY_SITE_ID ||
  "rashtra-sarvopari-local-development-secret";

const hashPassword = (password, salt) =>
  crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const signToken = (payload) => {
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, message: "Invalid request body" });
  }

  const username = normalizeUsername(payload.username);
  const password = payload.password?.toString() || "";

  if (username.length < 3) {
    return json(400, { ok: false, message: "Username minimum 3 characters ka hona chahiye." });
  }

  if (password.length < 6) {
    return json(400, { ok: false, message: "Password minimum 6 characters ka hona chahiye." });
  }

  const { getStore } = await import("@netlify/blobs");
  const users = getStore("rashtra-users");
  const key = `user:${username}`;
  const existingRaw = await users.get(key);
  const existingUser = existingRaw ? JSON.parse(existingRaw) : null;
  const now = new Date().toISOString();

  if (existingUser) {
    const inputHash = hashPassword(password, existingUser.salt);
    if (!safeEqual(inputHash, existingUser.passwordHash)) {
      return json(401, { ok: false, message: "Password galat hai. Dobara try karo." });
    }

    const user = {
      username: existingUser.username,
      createdAt: existingUser.createdAt,
      lastLoginAt: now,
    };
    await users.set(key, JSON.stringify({ ...existingUser, lastLoginAt: now }));
    return json(200, {
      ok: true,
      mode: "login",
      user,
      token: signToken({ username, issuedAt: Date.now() }),
    });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const newUser = {
    username,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: now,
    lastLoginAt: now,
  };

  await users.set(key, JSON.stringify(newUser));

  return json(201, {
    ok: true,
    mode: "created",
    user: {
      username,
      createdAt: now,
      lastLoginAt: now,
    },
    token: signToken({ username, issuedAt: Date.now() }),
  });
};
