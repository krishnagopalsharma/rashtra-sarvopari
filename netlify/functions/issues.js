import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const responseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });

const secret = () =>
  process.env.RASHTRA_AUTH_SECRET ||
  process.env.NETLIFY_SITE_ID ||
  process.env.SITE_ID ||
  "rashtra-sarvopari-local-development-secret";

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

const areaKey = (area = "Govardhan") =>
  `area:${area
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")}`;

const readIssues = async (store, key) => {
  const raw = await store.get(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const issuesHandler = async (request) => {
  if (request.method === "OPTIONS") return json(204, {});

  const store = getStore("rashtra-issues");
  const requestUrl = new URL(request.url);

  if (request.method === "GET") {
    const area = requestUrl.searchParams.get("area") || "Govardhan";
    const issues = await readIssues(store, areaKey(area));
    return json(200, { ok: true, issues });
  }

  if (request.method !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const session = verifyToken(token);

  if (!session?.username) {
    return json(401, { ok: false, message: "Login required before submitting issue." });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { ok: false, message: "Invalid request body" });
  }

  const category = payload.category?.toString().trim() || "Local Issue";
  const text = payload.text?.toString().trim() || "";
  const area = payload.area?.toString().trim() || "Govardhan";
  const pincode = payload.pincode?.toString().trim() || "281502";

  if (text.length < 4) {
    return json(400, { ok: false, message: "Issue detail thoda clearly likho." });
  }

  const key = areaKey(area);
  const issues = await readIssues(store, key);
  const issue = {
    id: `issue-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    category,
    text,
    area,
    pincode,
    username: session.username,
    status: "Pending Verification",
    createdAt: new Date().toISOString(),
  };

  issues.unshift(issue);
  await store.set(key, JSON.stringify(issues.slice(0, 300)));

  return json(201, { ok: true, issue });
};

export default async (request) => {
  try {
    return await issuesHandler(request);
  } catch (error) {
    console.error("Issues function failed", error);
    return json(500, {
      ok: false,
      message: `Issues backend error: ${error.message || "Unknown Netlify function error"}`,
    });
  }
};
