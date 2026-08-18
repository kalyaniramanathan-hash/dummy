// Lists available report suites so we can pick one for the funnel report.
const { loadEnv, getAccessToken, callAnalyticsApi } = require('./lib/aaClient');

async function main() {
  const env = loadEnv();
  const accessToken = await getAccessToken(env);
  const body = await callAnalyticsApi(env, accessToken, '/collections/suites?limit=100');
  console.log(JSON.stringify(body.content?.map((s) => ({ id: s.rsid, name: s.name })) || body, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
