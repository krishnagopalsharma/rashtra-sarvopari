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

const publicUser = (user) => ({
  username: user.username,
  avatar: user.avatar || "",
  totalVotes: user.totalVotes || 0,
  totalOpinions: user.totalOpinions || 0,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

const readUser = async (users, username) => {
  const raw = await users.get(`user:${username}`);
  return raw ? JSON.parse(raw) : null;
};

const writeUser = (users, user) => users.set(`user:${user.username}`, JSON.stringify(user));

const decrementVoteTotals = async (users, voters = []) => {
  const voteCounts = voters.reduce((counts, voter) => {
    if (!voter?.username) return counts;
    counts.set(voter.username, (counts.get(voter.username) || 0) + 1);
    return counts;
  }, new Map());
  await Promise.all(
    [...voteCounts.entries()].map(async ([username, count]) => {
      const user = await readUser(users, username);
      if (!user) return;
      user.totalVotes = Math.max(0, (user.totalVotes || 0) - count);
      user.updatedAt = new Date().toISOString();
      await writeUser(users, user);
    }),
  );
};

const requireAdmin = (request) => {
  const authHeader = request.headers.get("authorization") || "";
  const session = verifyToken(authHeader.replace(/^Bearer\s+/i, ""));
  return session?.username === "krishnagopalsharma" ? session : null;
};

const uniqueVoters = (voters = []) => {
  const seen = new Set();
  return voters.filter((voter) => {
    if (!voter?.username || seen.has(voter.username)) return false;
    seen.add(voter.username);
    return true;
  });
};

const issuesHandler = async (request) => {
  if (request.method === "OPTIONS") return json(204, {});

  const store = getStore("rashtra-issues");
  const users = getStore("rashtra-users");
  const requestUrl = new URL(request.url);

  if (request.method === "GET") {
    const area = requestUrl.searchParams.get("area") || "Govardhan";
    const issues = await readIssues(store, areaKey(area));
    const votes = await readIssues(store, `votes:${areaKey(area)}`);
    return json(200, { ok: true, issues, votes });
  }

  if (request.method !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const session = verifyToken(token);

  if (!session?.username) {
    return json(401, { ok: false, message: "Login required before submitting issue." });
  }

  const activeUser = await readUser(users, session.username);
  if (!activeUser) return json(401, { ok: false, message: "Account not found. Please login again." });

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { ok: false, message: "Invalid request body" });
  }

  if (payload.action === "vote") {
    const area = payload.area?.toString().trim() || "Govardhan";
    const issueKey = payload.issueKey?.toString().trim() || "";
    const title = payload.title?.toString().trim() || issueKey;
    if (!issueKey) return json(400, { ok: false, message: "Issue vote key missing." });

    const key = `votes:${areaKey(area)}`;
    const votes = await readIssues(store, key);
    const existing = votes.find((item) => item.issueKey === issueKey);
    const voter = {
      username: activeUser.username,
      avatar: activeUser.avatar || "",
      votedAt: new Date().toISOString(),
    };

    if (existing) {
      const voters = uniqueVoters(existing.voters || []);
      if (voters.some((item) => item.username === activeUser.username)) {
        return json(409, { ok: false, message: "You have already voted for this issue." });
      }
      existing.voters = [voter, ...voters].slice(0, 50);
      existing.count = existing.voters.length;
    } else {
      votes.unshift({
        issueKey,
        title,
        count: 1,
        voters: [voter],
      });
    }

    activeUser.totalVotes = (activeUser.totalVotes || 0) + 1;
    activeUser.updatedAt = new Date().toISOString();
    await Promise.all([store.set(key, JSON.stringify(votes)), writeUser(users, activeUser)]);

    return json(201, { ok: true, votes, user: publicUser(activeUser) });
  }

  if (payload.action === "purgePost") {
    if (!requireAdmin(request)) return json(403, { ok: false, message: "Admin access required." });
    const area = payload.area?.toString().trim() || "Govardhan";
    const issueId = payload.issueId?.toString().trim();
    if (!issueId) return json(400, { ok: false, message: "Post id missing." });
    const key = areaKey(area);
    const issues = await readIssues(store, key);
    const filtered = issues.filter((issue) => issue.id !== issueId);
    await store.set(key, JSON.stringify(filtered));
    return json(200, { ok: true, removed: issueId, issues: filtered });
  }

  if (payload.action === "removeVote") {
    if (!requireAdmin(request)) return json(403, { ok: false, message: "Admin access required." });
    const area = payload.area?.toString().trim() || "Govardhan";
    const issueKey = payload.issueKey?.toString().trim();
    const username = payload.username?.toString().trim();
    if (!issueKey || !username) return json(400, { ok: false, message: "Vote details missing." });

    const key = `votes:${areaKey(area)}`;
    const votes = await readIssues(store, key);
    const removedVoters = [];
    const updated = votes
      .map((vote) => {
        if (vote.issueKey !== issueKey) return vote;
        const voters = uniqueVoters(vote.voters || []);
        removedVoters.push(...voters.filter((voter) => voter.username === username));
        const keptVoters = voters.filter((voter) => voter.username !== username);
        return { ...vote, voters: keptVoters, count: keptVoters.length };
      })
      .filter((vote) => (vote.voters || []).length > 0);

    await Promise.all([store.set(key, JSON.stringify(updated)), decrementVoteTotals(users, removedVoters)]);
    return json(200, { ok: true, votes: updated });
  }

  if (payload.action === "clearVotes") {
    if (!requireAdmin(request)) return json(403, { ok: false, message: "Admin access required." });
    const area = payload.area?.toString().trim() || "Govardhan";
    const issueKey = payload.issueKey?.toString().trim();
    const key = `votes:${areaKey(area)}`;
    const votes = await readIssues(store, key);

    if (!issueKey) {
      const removedVoters = votes.flatMap((vote) => uniqueVoters(vote.voters || []));
      await Promise.all([store.set(key, JSON.stringify([])), decrementVoteTotals(users, removedVoters)]);
      return json(200, { ok: true, votes: [] });
    }

    const removedVoters = votes
      .filter((vote) => vote.issueKey === issueKey)
      .flatMap((vote) => uniqueVoters(vote.voters || []));
    const updated = votes.filter((vote) => vote.issueKey !== issueKey);
    await Promise.all([store.set(key, JSON.stringify(updated)), decrementVoteTotals(users, removedVoters)]);
    return json(200, { ok: true, votes: updated });
  }

  const category = payload.category?.toString().trim() || "Local Issue";
  const text = payload.text?.toString().trim() || "";
  const area = payload.area?.toString().trim() || "Govardhan";
  const pincode = payload.pincode?.toString().trim() || "281502";
  const photo = payload.photo || null;

  if (text.length < 4) {
    return json(400, { ok: false, message: "Please write the issue details clearly." });
  }

  if (photo?.dataUrl && (!photo.dataUrl.startsWith("data:image/") || photo.dataUrl.length > 1800000)) {
    return json(400, { ok: false, message: "Photo proof image is too large or invalid." });
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
    avatar: activeUser.avatar || "",
    photo: photo?.dataUrl
      ? {
          name: photo.name?.toString() || "photo-proof",
          type: photo.type?.toString() || "image",
          dataUrl: photo.dataUrl,
        }
      : null,
    status: "Pending Verification",
    createdAt: new Date().toISOString(),
  };

  issues.unshift(issue);
  activeUser.totalOpinions = (activeUser.totalOpinions || 0) + 1;
  activeUser.updatedAt = new Date().toISOString();
  await Promise.all([store.set(key, JSON.stringify(issues.slice(0, 300))), writeUser(users, activeUser)]);

  return json(201, { ok: true, issue, user: publicUser(activeUser) });
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
