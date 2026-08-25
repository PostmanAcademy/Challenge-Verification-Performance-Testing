# 🚀 Challenge Verification Performance Testing

> *Load-testing the Postman challenge-verification endpoints — measured, scheduled, and observable.*

![k6](https://img.shields.io/badge/k6-load%20testing-7d64ff?style=for-the-badge&logo=k6&logoColor=white)
![New Relic](https://img.shields.io/badge/New%20Relic-observability-1CE783?style=for-the-badge&logo=newrelic&logoColor=black)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-CI-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)
![Postman](https://img.shields.io/badge/Postman-API-FF6C37?style=for-the-badge&logo=postman&logoColor=white)

---

## 🛸 Overview

This repository is a **performance-testing harness** for the Postman `/v4/challenge`
verification endpoints. It uses [**k6**](https://k6.io/) to generate load, streams the
results to **New Relic** (via OpenTelemetry) for dashboards and history, and runs
automatically on a schedule through **GitHub Actions**.

The test is designed around a hard external constraint: the API key is **rate-limited to
10 requests per 10 seconds**, so the load profile is built to respect that cap precisely
rather than fight it.

```
k6 (arrival-rate)  ──▶  Postman /v4/challenge  ──▶  metrics ──▶  New Relic
     │                                                              dashboards + history
     └── HTML report + summary.json (GitHub Actions artifact)
```

> 📄 For the full technical context (design decisions, findings, caveats, and the roadmap),
> see **[PERFORMANCE_TESTING_CONTEXT.md](PERFORMANCE_TESTING_CONTEXT.md)**.

---

## 🎯 What it tests

Three challenge endpoints, exercised evenly on every run:

| Endpoint (tag) | challengeID |
|---|---|
| `core` | `v12/core/core` |
| `qa-fundamentals` | `v12/qa/fundamentals` |
| `qa-automation` | `v12/qa/automation` |

All are `GET` requests against
`https://sandbox-challenge-testing-sims.us.postman.com/v4/challenge`.

---

## 📈 The load profile

A **10-minute soak test** that holds steady right at the rate limit:

- Uses k6's `ramping-arrival-rate` executor to control the **request rate** (not raw VUs).
- `timeUnit: '10s'`, so targets are literally "requests per 10 seconds".
- **Ramp** `0 → 10` req/10s over 30s → **hold** `10` req/10s for **10 min** → **ramp down**.
- One request per iteration, rotating across the three endpoints.

Each request is tagged with `endpoint` and `name`; the built-in `status` tag provides the
good (200) vs. bad (non-200) split in New Relic.

---

## 📊 Reporting

- **New Relic** — metrics stream live via OTLP (`k6 run -o opentelemetry`), prefixed
  `k6_challenge_verification_performance_`. Import
  [`newrelic-dashboard.json`](newrelic-dashboard.json) for a ready-made dashboard (latency,
  throughput, error rate, per-endpoint/status breakdowns).
- **Artifacts** — every run also produces a standalone `html-report.html` and
  `summary.json`, uploaded as a GitHub Actions artifact.

---

## ⏰ Automation

Runs via [`.github/workflows/k6-load-test.yml`](.github/workflows/k6-load-test.yml):

- **Schedule:** every **Monday at 06:00 UTC** (`cron: '0 6 * * 1'`).
- **Manual:** `workflow_dispatch` (the "Run workflow" button).
- **Required secret:** `NEW_RELIC_LICENSE_KEY` — a New Relic **Ingest - License** key, stored
  as a **repository** secret.

---

## 🧪 Running it locally

### Prerequisites
- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) (`brew install k6`)

### Run
```bash
# console output only
k6 run api-test.js

# with an HTML report
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=html-report.html k6 run api-test.js

# stream to New Relic (requires a license key)
K6_OTEL_EXPORTER_PROTOCOL=http/protobuf \
K6_OTEL_HTTP_EXPORTER_ENDPOINT=otlp.nr-data.net:4318 \
K6_OTEL_METRIC_PREFIX=k6_challenge_verification_performance_ \
K6_OTEL_HEADERS="api-key=<YOUR_INGEST_LICENSE_KEY>" \
k6 run -o opentelemetry api-test.js
```

---

## 📂 Repository structure

| File | Purpose |
|---|---|
| `api-test.js` | The k6 test — soak profile + reporting. |
| `.github/workflows/k6-load-test.yml` | Scheduled run + New Relic streaming + artifacts. |
| `newrelic-dashboard.json` | Importable New Relic dashboard. |
| `PERFORMANCE_TESTING_CONTEXT.md` | Full technical context, decisions, and roadmap. |
| `html-report.html`, `summary.json` | Generated per run (gitignored). |

---

## 🗺️ Roadmap

- **Calibrate thresholds** from a real New Relic baseline (currently loose guardrails on
  purpose while data accumulates).
- **App scalability testing** — mock the Postman API (PAPI) with realistic latency and load
  *our own app* with thousands of virtual users to find its ceiling, independent of the
  PAPI rate limit. See [PERFORMANCE_TESTING_CONTEXT.md §9](PERFORMANCE_TESTING_CONTEXT.md).

---

<p align="center">
  <em>Measure it, watch it, scale it. 📈</em>
</p>
