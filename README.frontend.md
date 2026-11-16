# Quantum dashboard frontend

A dependency-free, responsive example infrastructure observatory. All displayed
metrics are **synthetic demo data**, not measurements from real quantum hardware.
Requires Node.js 22 or newer to run both layers. No packages or build step are needed.

From the repository root, start the frontend in its own terminal/session:

```sh
node frontend-server.mjs
```

Open <http://localhost:3000>. Run the separate backend in a second session:

```sh
node server.mjs
```

The frontend polls `http://localhost:3001/api/metrics` every five seconds.
The included backend allows the `http://localhost:3000` origin via CORS;
see [the backend instructions](README.backend.md) for its API and checks.

The API response is:

```json
{
  "generatedAt": "2026-11-16T22:00:00Z",
  "summary": {
    "deviceStatus": "Operational",
    "fidelity": 99.84,
    "errorRate": 0.16,
    "calibrationDrift": 0.04,
    "jobsRunning": 12
  },
  "series": [
    { "time": "2026-11-16T22:00:00Z", "fidelity": 99.84, "errorRate": 0.16, "drift": 0.04 }
  ]
}
```

Percentage values are already in percent units (`99.84` means `99.84%`).
The chart uses independently scaled, labelled percentage axes for fidelity and
error rate. Hover a sample for its exact value. Empty series are supported.
On a failed refresh, the last received values remain visible with a stale-data
warning; the UI retries automatically. A refresh button allows immediate retries.

The static server serves only the three public UI assets, binds to localhost,
and does not expose backend files. Stop it with Ctrl+C.

Check the frontend server:

```sh
node --test frontend-server.test.mjs
node --check app.js
```
