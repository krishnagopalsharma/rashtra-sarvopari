import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const responseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
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
  process.env.SITE_ID ||
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

const parseBody = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const authHandler = async (request) => {
  if (request.method === "OPTIONS") return json(204, {});
  if (request.method !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  const payload = await parseBody(request);
  if (!payload) return json(400, { ok: false, message: "Invalid request body" });

  const username = normalizeUsername(payload.username);
  const password = payload.password?.toString() || "";

  if (username.length < 3) {
    return json(400, { ok: false, message: "Username minimum 3 characters ka hona chahiye." });
  }

  if (password.length < 6) {
    return json(400, { ok: false, message: "Password minimum 6 characters ka hona chahiye." });
  }

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

export default async (request) => {
  try {
    return await authHandler(request);
  } catch (error) {
    console.error("Auth function failed", error);
    return json(500, {
      ok: false,
      message: `Auth backend error: ${error.message || "Unknown Netlify function error"}`,
    });
  }
};
