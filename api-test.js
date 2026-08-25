import { check } from 'k6';
import http from 'k6/http';
import exec from 'k6/execution';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// The API key is capped at 10 req / 10s, so we drive by request rate (arrival-rate)
// rather than VUs. Soak test: ramp up, hold at the cap for 10 minutes, ramp down.
export const options = {
  scenarios: {
    challenge_load: {
      executor: 'ramping-arrival-rate',
      exec: 'hitChallenge',
      timeUnit: '10s', // targets are requests per 10s
      startRate: 0,
      preAllocatedVUs: 10,
      maxVUs: 50,
      stages: [
        { target: 10, duration: '30s' },
        { target: 10, duration: '10m' },
        { target: 0,  duration: '10s' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    // TODO: recalibrate once we have a real baseline in New Relic
    http_req_duration: ['p(95)<10000'],
  },
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
export function hitChallenge() {
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

  check(res, { 'status is 200': (r) => r.status === 200 }, { endpoint: challenge.endpoint });
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
