require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const session = require("express-session");
const crypto = require("crypto");

// ---- PKCE helpers ----
function base64url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generatePkcePair() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );
  return { codeVerifier, codeChallenge };
}

const {
  SF_CLIENT_ID,
  SF_CLIENT_SECRET,
  SF_REDIRECT_URI,
  SF_LOGIN_URL,
  SF_API_VERSION,
  SESSION_SECRET,
  FRONTEND_URL,
  PORT,
} = process.env;

const app = express();
app.set("trust proxy", 1); // required on Render for secure cookies to work
app.use(express.json());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(
  session({
    secret: SESSION_SECRET || "dev_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "none",
      secure: true, // required for sameSite: "none" — Render serves over https
      maxAge: 1000 * 60 * 60 * 4,
    },
  })
);

// Objects allowed by the assignment, with a curated field allow-list
// (used to filter Salesforce's describe() response down to 5-10 fields).
const OBJECT_FIELD_ALLOWLIST = {
  Account: ["Name", "Industry", "Phone", "Website", "BillingCity", "AnnualRevenue", "Type"],
  Opportunity: ["Name", "StageName", "Amount", "CloseDate", "Probability", "Type"],
  Lead: ["FirstName", "LastName", "Company", "Email", "Status", "Phone"],
  Contact: ["FirstName", "LastName", "Email", "Phone", "Title", "Department"],
  Case: ["Subject", "Status", "Priority", "Origin", "Description"],
};

function requireAuth(req, res, next) {
  if (!req.session.accessToken || !req.session.instanceUrl) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function sfApi(req) {
  return axios.create({
    baseURL: `${req.session.instanceUrl}/services/data/${SF_API_VERSION}`,
    headers: { Authorization: `Bearer ${req.session.accessToken}` },
  });
}

// ---------- AUTH ----------

// Step 1: redirect the browser to Salesforce's login/consent screen
app.get("/auth/login", (req, res) => {
  const { codeVerifier, codeChallenge } = generatePkcePair();
  req.session.codeVerifier = codeVerifier; // needed later at the token exchange

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SF_CLIENT_ID,
    redirect_uri: SF_REDIRECT_URI,
    scope: "api refresh_token offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  res.redirect(`${SF_LOGIN_URL}/services/oauth2/authorize?${params.toString()}`);
});



// Step 2: Salesforce redirects back here with ?code=...
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Missing authorization code");

  const codeVerifier = req.session.codeVerifier;
  if (!codeVerifier) {
    return res
      .status(400)
      .send("Missing PKCE code_verifier in session — start over from /auth/login");
  }

  try {
    const tokenResp = await axios.post(
      `${SF_LOGIN_URL}/services/oauth2/token`,
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: SF_CLIENT_ID,
        client_secret: SF_CLIENT_SECRET,
        redirect_uri: SF_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token, instance_url } = tokenResp.data;
    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;
    req.session.instanceUrl = instance_url;

    res.redirect(`${FRONTEND_URL}/?loggedIn=1`);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("OAuth token exchange failed");
  }
});

app.get("/auth/me", (req, res) => {
  res.json({ loggedIn: !!req.session.accessToken });
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ---------- METADATA ----------

// Returns the curated field list + labels/types for the chosen object
app.get("/api/objects/:objectName/fields", requireAuth, async (req, res) => {
  const { objectName } = req.params;
  const allow = OBJECT_FIELD_ALLOWLIST[objectName];
  if (!allow) return res.status(400).json({ error: "Unsupported object" });

  try {
    const { data } = await sfApi(req).get(`/sobjects/${objectName}/describe`);
    const fieldMap = Object.fromEntries(data.fields.map((f) => [f.name, f]));
    const fields = allow
      .filter((name) => fieldMap[name])
      .map((name) => ({
        name,
        label: fieldMap[name].label,
        type: fieldMap[name].type,
        updateable: fieldMap[name].updateable,
        createable: fieldMap[name].createable,
      }));
    res.json({ fields });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to describe object" });
  }
});

// ---------- CRUD ----------

// List records with offset-based pagination (20 per page)
app.get("/api/objects/:objectName/records", requireAuth, async (req, res) => {
  const { objectName } = req.params;
  const allow = OBJECT_FIELD_ALLOWLIST[objectName];
  if (!allow) return res.status(400).json({ error: "Unsupported object" });

  const limit = 20;
  const offset = parseInt(req.query.offset || "0", 10);
  const fields = ["Id", ...allow].join(", ");
  const soql = `SELECT ${fields} FROM ${objectName} ORDER BY Id LIMIT ${limit} OFFSET ${offset}`;

  try {
    const { data } = await sfApi(req).get("/query", { params: { q: soql } });
    // Salesforce's totalSize on a LIMIT'd query only reflects THIS page,
    // not the object's real total — so infer "more pages" from whether
    // this page came back full, not by comparing against totalSize.
    const gotFullPage = data.records.length === limit;
    res.json({
      records: data.records,
      totalSize: data.totalSize,
      hasMore: gotFullPage,
      nextOffset: offset + data.records.length,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

app.post("/api/objects/:objectName/records", requireAuth, async (req, res) => {
  const { objectName } = req.params;
  try {
    const { data } = await sfApi(req).post(`/sobjects/${objectName}`, req.body);
    res.json(data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || "Create failed" });
  }
});

app.patch("/api/objects/:objectName/records/:id", requireAuth, async (req, res) => {
  const { objectName, id } = req.params;
  try {
    await sfApi(req).patch(`/sobjects/${objectName}/${id}`, req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || "Update failed" });
  }
});

app.delete("/api/objects/:objectName/records/:id", requireAuth, async (req, res) => {
  const { objectName, id } = req.params;
  try {
    await sfApi(req).delete(`/sobjects/${objectName}/${id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(400).json({ error: err.response?.data || "Delete failed" });
  }
});

app.listen(PORT || 5000, () => {
  console.log(`Backend running on http://localhost:${PORT || 5000}`);
});