const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const out = { ...process.env };
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].trim();
    }
  }
  for (const key of ['AA_CLIENT_ID', 'AA_CLIENT_SECRET', 'AA_ORG_ID', 'AA_SCOPES', 'AA_GLOBAL_COMPANY_ID']) {
    if (!out[key]) throw new Error(`Missing required env var: ${key}`);
  }
  return out;
}

async function getAccessToken(env) {
  const res = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.AA_CLIENT_ID,
      client_secret: env.AA_CLIENT_SECRET,
      scope: env.AA_SCOPES,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${JSON.stringify(body)}`);
  return body.access_token;
}

async function callAnalyticsApi(env, accessToken, apiPath, options = {}) {
  const res = await fetch(`https://analytics.adobe.io/api/${env.AA_GLOBAL_COMPANY_ID}${apiPath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-api-key': env.AA_CLIENT_ID,
      'x-gw-ims-org-id': env.AA_ORG_ID,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Analytics API call failed: ${res.status} ${JSON.stringify(body)}`);
  return body;
}

module.exports = { loadEnv, getAccessToken, callAnalyticsApi };
