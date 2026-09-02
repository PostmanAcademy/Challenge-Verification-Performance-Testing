import { check } from 'k6';
import http from 'k6/http';
import exec from 'k6/execution';
import { Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// Stress test: ramp to 300 concurrent VUs to find the endpoint's breaking point.
// (No 429 rate limit is enforced here — under load it fails with 424/5xx instead.)
// Metrics stream to New Relic via OTLP in CI; status counters make the breakdown easy to query.
const s200 = new Counter('status_200');
const s429 = new Counter('status_429');
const s424 = new Counter('status_424');
const s5xx = new Counter('status_5xx');
const sOther = new Counter('status_other');

export const options = {
  scenarios: {
    challenge_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { target: 50,  duration: '20s' }, // warm up
        { target: 300, duration: '1m'  }, // ramp to 300 concurrent VUs
        { target: 300, duration: '1m'  }, // hold at 300
        { target: 0,   duration: '20s' }, // ramp down
      ],
    },
  },
  // Observability run, not a gate: we want the data in New Relic, so no blocking
  // thresholds (the endpoint is expected to fail heavily under this load).
};

const BASE_URL = 'https://sandbox-challenge-testing-sims.us.postman.com/v4/challenge';

const SHARED_PARAMS = {
  skilljarID: '2hz9lwmkfdymt',
  studentID: '1',
  sandboxID: '39345b6b-8e3c-4e8a-9239-c0e6e7afce76',
  postmanElementID: 'n/a',
};

const CHALLENGES = [
  { endpoint: 'core',            challengeID: 'v12/core/core',       courseID: '2axd6hixu0tx5', lessonID: 'jdowsrgw9m8c' },
  { endpoint: 'qa-fundamentals', challengeID: 'v12/qa/fundamentals', courseID: '36qznie7lwdwc', lessonID: '1fgnn74fqo9z4' },
  { endpoint: 'qa-automation',   challengeID: 'v12/qa/automation',   courseID: '15pxvp1jc57qx', lessonID: '3kzyqdirnqsni' },
];

function buildUrl(challenge) {
  const params = {
    challengeID: challenge.challengeID,
    courseID: challenge.courseID,
    lessonID: challenge.lessonID,
    ...SHARED_PARAMS,
  };
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${BASE_URL}?${query}`;
}

// one request per iteration, rotating through the endpoints so each gets even traffic
export default function () {
  const challenge = CHALLENGES[exec.scenario.iterationInTest % CHALLENGES.length];
  const params = {
    headers: {
      'Content-Type': 'application/json',
      Accept: '*/*',
    },
    // endpoint/name tags drive the New Relic facets; status tag comes for free
    tags: {
      endpoint: challenge.endpoint,
      name: challenge.endpoint,
    },
  };

  const res = http.get(buildUrl(challenge), params);

  if (res.status === 200) s200.add(1);
  else if (res.status === 429) s429.add(1);
  else if (res.status === 424) s424.add(1);
  else if (res.status >= 500) s5xx.add(1);
  else sOther.add(1);

  check(res, { 'status is 200': (r) => r.status === 200 }, { endpoint: challenge.endpoint });
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
