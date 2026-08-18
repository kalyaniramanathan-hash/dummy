// One-off: OAuth Server-to-Server token exchange + Analytics discovery call
const fs = require('fs');

function loadEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

async function main() {
  const env = loadEnv('.env');
  const scopes = env.AA_SCOPES.split(',').join(',');

  const tokenRes = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.AA_CLIENT_ID,
      client_secret: env.AA_CLIENT_SECRET,
      scope: scopes,
    }),
  });

  const tokenBody = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error('Token exchange failed:', tokenRes.status, tokenBody);
    process.exit(1);
  }

  const accessToken = tokenBody.access_token;

  const discoveryRes = await fetch('https://analytics.adobe.io/discovery/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-api-key': env.AA_CLIENT_ID,
      'x-gw-ims-org-id': env.AA_ORG_ID,
    },
  });

  const discoveryBody = await discoveryRes.json();
  if (!discoveryRes.ok) {
    console.error('Discovery call failed:', discoveryRes.status, discoveryBody);
    process.exit(1);
  }

  console.log(JSON.stringify(discoveryBody, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
