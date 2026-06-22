const crypto = require("node:crypto");

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  },
  body: JSON.stringify(body),
});

const secret = () =>
  process.env.RASHTRA_AUTH_SECRET ||
  process.env.NETLIFY_SITE_ID ||
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

const issuesHandler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(204, {});

  const { getStore } = await import("@netlify/blobs");
  const store = getStore("rashtra-issues");

  if (event.httpMethod === "GET") {
    const area = event.queryStringParameters?.area || "Govardhan";
    const issues = await readIssues(store, areaKey(area));
    return json(200, { ok: true, issues });
  }

  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const session = verifyToken(token);

  if (!session?.username) {
    return json(401, { ok: false, message: "Login required before submitting issue." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
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

exports.handler = async (event) => {
  try {
    return await issuesHandler(event);
  } catch (error) {
    console.error("Issues function failed", error);
    return json(500, {
      ok: false,
      message: `Issues backend error: ${error.message || "Unknown Netlify function error"}`,
    });
  }
};
