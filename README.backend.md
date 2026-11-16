# Quantum dashboard demo API

This dependency-free Node.js backend generates **synthetic telemetry**. It does
not connect to quantum hardware, a scheduler, or a monitoring service.
Use Node.js 22 or newer; no installation or package downloads are needed.

From the repository root, start the backend in its own session:

```sh
node server.mjs
```

The API listens on loopback at `http://localhost:3001`. Leave it running while
the frontend runs separately on `http://localhost:3000`; that origin is allowed
by the API's CORS headers. Stop with Ctrl+C. To use a different backend port:

```sh
PORT=3101 node server.mjs
```

In PowerShell, set `$env:PORT = '3101'` before running the Node command instead.
Update the frontend's API URL if overriding the port.

## Endpoints

```sh
curl http://localhost:3001/api/health
curl http://localhost:3001/api/metrics
```

`GET /api/health` returns `status`, `source: "synthetic"`,
`hardwareConnected: false`, and an ISO timestamp.

`GET /api/metrics` returns this contract:

```json
{
  "generatedAt": "2026-11-17T00:23:00.000Z",
  "summary": {
    "deviceStatus": "Demo / operational",
    "fidelity": 99.3,
    "errorRate": 0.6,
    "calibrationDrift": 0.2,
    "jobsRunning": 8
  },
  "series": [
    {
      "time": "2026-11-17T00:23:00.000Z",
      "fidelity": 99.3,
      "errorRate": 0.6,
      "drift": 0.2
    }
  ]
}
```

The example shows one point for brevity; the actual response contains 24
chronological points, spaced one minute apart, ending at `generatedAt`.
Fidelity and error rate are percentages (99.3 means 99.3%, not 0.993).
Calibration drift is a synthetic detuning in MHz; `series[].drift` uses the
same unit. Job count is a synthetic integer. These are illustrative independent
signals, not a physical model; fidelity and error rate need not sum to 100.
Summary readings match the latest chart point. Values change smoothly with
wall-clock time; clients can poll every five seconds.

Responses are uncached JSON with `X-Telemetry-Source: synthetic`. Unknown paths
return JSON 404; unsupported methods return JSON 405 with an `Allow` header.
API routes support CORS preflight (`OPTIONS`); unexpected request errors are
logged server-side and return JSON 500. Invalid ports and startup failures are
reported on stderr with a nonzero exit code.

## Backend checks

```sh
node --test server.test.mjs
```

Tests use an ephemeral loopback port and Node built-ins only.
