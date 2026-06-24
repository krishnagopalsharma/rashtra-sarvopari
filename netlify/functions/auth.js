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
    .replace(/[^a-z0-9._]/g, "");

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

const verifyToken = (token = "") => {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    return JSON.parse(Buffer.from(body.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
};

const publicUser = (user) => ({
  username: user.username,
  displayName: user.displayName || user.username,
  avatar: user.avatar || "",
  avatarZoom: user.avatarZoom || 1,
  totalVotes: user.totalVotes || 0,
  totalOpinions: user.totalOpinions || 0,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

const requireAdmin = (request) => {
  const authHeader = request.headers.get("authorization") || "";
  const session = verifyToken(authHeader.replace(/^Bearer\s+/i, ""));
  return session?.username === "krishnagopalsharma" ? session : null;
};

const listUsers = async (users) => {
  const listed = await users.list();
  const keys = (listed.blobs || []).map((blob) => blob.key).filter((key) => key.startsWith("user:"));
  const records = await Promise.all(
    keys.map(async (key) => {
      const raw = await users.get(key);
      return raw ? publicUser(JSON.parse(raw)) : null;
    }),
  );
  return records.filter(Boolean).sort((a, b) => a.username.localeCompare(b.username));
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

  const users = getStore("rashtra-users");

  if (payload.action === "adminList") {
    if (!requireAdmin(request)) return json(403, { ok: false, message: "Admin access required." });
    return json(200, { ok: true, users: await listUsers(users) });
  }

  if (payload.action === "deleteUser") {
    if (!requireAdmin(request)) return json(403, { ok: false, message: "Admin access required." });
    const username = normalizeUsername(payload.username);
    if (!username || username === "krishnagopalsharma") {
      return json(400, { ok: false, message: "This account cannot be deleted." });
    }
    await users.delete(`user:${username}`);
    return json(200, { ok: true, deleted: username });
  }

  if (payload.action === "updateAvatar") {
    const authHeader = request.headers.get("authorization") || "";
    const session = verifyToken(authHeader.replace(/^Bearer\s+/i, ""));
    if (!session?.username) return json(401, { ok: false, message: "Login required." });

    const key = `user:${session.username}`;
    const existingRaw = await users.get(key);
    const existingUser = existingRaw ? JSON.parse(existingRaw) : null;
    if (!existingUser) return json(404, { ok: false, message: "Account not found." });

    const avatar = payload.avatar?.toString() || "";
    if (avatar && !avatar.startsWith("data:image/")) {
      return json(400, { ok: false, message: "Only image avatars are allowed." });
    }
    if (avatar.length > 650000) {
      return json(400, { ok: false, message: "Avatar image is too large. Please choose a smaller photo." });
    }

    const updated = { ...existingUser, avatar, updatedAt: new Date().toISOString() };
    await users.set(key, JSON.stringify(updated));
    return json(200, { ok: true, user: publicUser(updated) });
  }

  if (payload.action === "updateProfile") {
    const authHeader = request.headers.get("authorization") || "";
    const session = verifyToken(authHeader.replace(/^Bearer\s+/i, ""));
    if (!session?.username) return json(401, { ok: false, message: "Login required." });

    const key = `user:${session.username}`;
    const existingRaw = await users.get(key);
    const existingUser = existingRaw ? JSON.parse(existingRaw) : null;
    if (!existingUser) return json(404, { ok: false, message: "Account not found." });

    const displayName = payload.displayName?.toString().trim().slice(0, 40) || existingUser.username;
    const avatarZoom = Math.min(Math.max(Number(payload.avatarZoom || existingUser.avatarZoom || 1), 1), 1.8);
    const updated = { ...existingUser, displayName, avatarZoom, updatedAt: new Date().toISOString() };
    await users.set(key, JSON.stringify(updated));
    return json(200, { ok: true, user: publicUser(updated) });
  }

  const username = normalizeUsername(payload.username);
  const password = payload.password?.toString() || "";

  if (username.length < 3) {
    return json(400, { ok: false, message: "Username minimum 3 characters ka hona chahiye." });
  }

  if (password.length < 6) {
    return json(400, { ok: false, message: "Password minimum 6 characters ka hona chahiye." });
  }

  const key = `user:${username}`;
  const existingRaw = await users.get(key);
  const existingUser = existingRaw ? JSON.parse(existingRaw) : null;
  const now = new Date().toISOString();

  if (existingUser) {
    const inputHash = hashPassword(password, existingUser.salt);
    if (!safeEqual(inputHash, existingUser.passwordHash)) {
      return json(409, { ok: false, message: "This username is already taken. Please choose another one!" });
    }

    const updated = { ...existingUser, lastLoginAt: now };
    await users.set(key, JSON.stringify(updated));
    return json(200, {
      ok: true,
      mode: "login",
      user: publicUser(updated),
      token: signToken({ username, issuedAt: Date.now() }),
    });
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const newUser = {
    username,
    displayName: username,
    salt,
    passwordHash: hashPassword(password, salt),
    avatar: "",
    avatarZoom: 1,
    totalVotes: 0,
    totalOpinions: 0,
    createdAt: now,
    lastLoginAt: now,
  };

  await users.set(key, JSON.stringify(newUser));

  return json(201, {
    ok: true,
    mode: "created",
    user: publicUser(newUser),
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
