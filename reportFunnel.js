// Builds a step-by-step conversion funnel from a sequence of events/metrics.
// Configure via env vars:
//   AA_RSID          report suite id (see `npm run discover` / listReportSuites.js)
//   FUNNEL_EVENTS     comma-separated event ids in order, e.g. "event1,event2,event3"
//   FUNNEL_DATE_RANGE optional "YYYY-MM-DDT00:00:00.000/YYYY-MM-DDT00:00:00.000" (defaults to last 30 days)
const { loadEnv, getAccessToken, callAnalyticsApi } = require('./lib/aaClient');

function sequentialSegment(events) {
  return {
    func: 'segment',
    version: [1, 0, 0],
    container: {
      func: 'container',
      context: 'visitors',
      pred: {
        func: 'sequence',
        stream: events.map((event) => ({
          func: 'event-exists',
          evt: { func: 'segment-metric', id: event },
        })),
      },
    },
  };
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const iso = (d) => d.toISOString().slice(0, 19) + '.000';
  return `${iso(start)}/${iso(end)}`;
}

async function main() {
  const env = loadEnv();
  const rsid = env.AA_RSID;
  if (!rsid) throw new Error('Missing required env var: AA_RSID');

  const events = (env.FUNNEL_EVENTS || '').split(',').map((e) => e.trim()).filter(Boolean);
  if (events.length < 2) {
    throw new Error('Set FUNNEL_EVENTS to at least two comma-separated event ids, e.g. "event1,event2,event3"');
  }

  const dateRange = env.FUNNEL_DATE_RANGE || defaultDateRange();
  const accessToken = await getAccessToken(env);

  // Step i = visitors who did events[0] then events[1] ... then events[i], in order.
  const metricFilters = events.map((_, i) => ({
    id: String(i),
    type: 'segment',
    segmentDefinition: sequentialSegment(events.slice(0, i + 1)),
  }));

  const metrics = events.map((_, i) => ({
    columnId: String(i),
    id: 'metrics/visitors',
    filters: [String(i)],
  }));

  const body = await callAnalyticsApi(env, accessToken, '/reports', {
    method: 'POST',
    body: JSON.stringify({
      rsid,
      globalFilters: [{ type: 'dateRange', dateRange }],
      metricContainer: { metrics },
      metricFilters,
      dimension: 'variables/daterangeday',
      settings: { limit: 5000 },
    }),
  });

  const totals = events.map(() => 0);
  for (const row of body.rows || []) {
    row.data.forEach((value, i) => {
      totals[i] += value;
    });
  }

  console.log(`Funnel for report suite ${rsid} (${dateRange})\n`);
  totals.forEach((count, i) => {
    const pct = i === 0 ? 100 : (count / totals[0]) * 100;
    console.log(`${i + 1}. ${events[i].padEnd(20)} ${count.toLocaleString()} (${pct.toFixed(1)}%)`);
  });
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
