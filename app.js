const API_URL = 'http://localhost:3001/api/metrics';
const byId = (id) => document.getElementById(id);
let refreshing = false;
let hasData = false;
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function validateMetrics(data) {
  const numericKeys = ['fidelity', 'errorRate', 'calibrationDrift', 'jobsRunning'];
  if (!data || !Number.isFinite(Date.parse(data.generatedAt)) ||
      typeof data.summary?.deviceStatus !== 'string' || !data.summary.deviceStatus.trim() ||
      !numericKeys.every((key) => typeof data.summary[key] === 'number' && Number.isFinite(data.summary[key])) ||
      !Array.isArray(data.series) ||
      !data.series.every((point) => point && Number.isFinite(Date.parse(point.time)) &&
        ['fidelity', 'errorRate', 'drift'].every((key) => typeof point[key] === 'number' && Number.isFinite(point[key])))) {
    throw new Error('The metrics service returned an unexpected data format.');
  }
  return data;
}

function svgElement(name, attributes, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderChart(series) {
  const chart = byId('chart');
  const empty = byId('chart-empty');
  chart.toggleAttribute('hidden', series.length === 0);
  empty.hidden = series.length !== 0;
  empty.textContent = 'No time-series samples yet. Summary metrics are available above.';
  byId('sample-count').textContent = `${series.length} sample${series.length === 1 ? '' : 's'}`;
  if (!series.length) return;

  const points = [...series].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const group = byId('chart-content');
  group.replaceChildren();
  const left = 63, right = 892, top = 36, bottom = 250;
  const start = Date.parse(points[0].time);
  const end = Date.parse(points.at(-1).time);
  const x = (point) => start === end ? (left + right) / 2 :
    left + (Date.parse(point.time) - start) / (end - start) * (right - left);
  const scales = [
    { key: 'fidelity', color: '#ac93ff', label: 'FIDELITY', align: 'end', labelX: left - 12 },
    { key: 'errorRate', color: '#5cddc3', label: 'ERROR RATE', align: 'start', labelX: right + 12 },
  ].map((scale) => {
    const values = points.map((point) => point[scale.key]);
    const min = Math.min(...values), max = Math.max(...values);
    const padding = Math.max((max - min) * .2, .01);
    return { ...scale, min: min - padding, max: max + padding };
  });
  for (let tick = 0; tick <= 4; tick++) {
    const y = top + tick / 4 * (bottom - top);
    group.append(svgElement('line', { x1: left, x2: right, y1: y, y2: y, stroke: '#2a3040', 'stroke-dasharray': '3 6' }));
    for (const scale of scales) {
      const value = scale.max - tick / 4 * (scale.max - scale.min);
      group.append(svgElement('text', { x: scale.labelX, y: y + 3, fill: scale.color, 'font-size': 10, 'text-anchor': scale.align }, value.toFixed(2)));
    }
  }
  for (const scale of scales) {
    group.append(svgElement('text', { x: scale.labelX, y: 17, fill: scale.color, 'font-size': 8, 'letter-spacing': 1, 'text-anchor': scale.align }, scale.label));
    const y = (point) => bottom - (point[scale.key] - scale.min) / (scale.max - scale.min) * (bottom - top);
    group.append(svgElement('polyline', { points: points.map((point) => `${x(point)},${y(point)}`).join(' '), fill: 'none', stroke: scale.color, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    for (const point of points) {
      const circle = svgElement('circle', { cx: x(point), cy: y(point), r: points.length === 1 ? 4 : 2.5, fill: scale.color });
      circle.append(svgElement('title', {}, `${timeFormat.format(new Date(point.time))}: ${scale.label.toLowerCase()} ${point[scale.key].toFixed(3)}%`));
      group.append(circle);
    }
  }
  const indices = [...new Set([0, ...[1, 2, 3].map((n) => Math.round(n * (points.length - 1) / 4)), points.length - 1])];
  for (const index of indices) {
    const point = points[index];
    group.append(svgElement('text', { x: x(point), y: 279, fill: '#7c89a2', 'font-size': 10, 'text-anchor': 'middle' }, timeFormat.format(new Date(point.time))));
  }
  byId('chart-desc').textContent = `${points.length} synthetic samples from ${timeFormat.format(new Date(points[0].time))} to ${timeFormat.format(new Date(points.at(-1).time))}. Purple: fidelity; green: error rate. Each uses its own percentage scale.`;
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  byId('refresh').disabled = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(API_URL, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`The metrics service returned HTTP ${response.status}.`);
    const data = validateMetrics(await response.json());
    byId('deviceStatus').textContent = data.summary.deviceStatus;
    for (const key of ['fidelity', 'errorRate', 'calibrationDrift']) byId(key).textContent = data.summary[key].toFixed(2);
    byId('jobsRunning').textContent = data.summary.jobsRunning.toLocaleString();
    byId('updated').textContent = `Last sample ${timeFormat.format(new Date(data.generatedAt))}`;
    byId('connection').textContent = 'Connected to demo telemetry';
    byId('connection-dot').className = 'status-dot';
    byId('error').hidden = true;
    renderChart(data.series);
    hasData = true;
  } catch (error) {
    byId('connection').textContent = hasData ? 'Connection lost · showing last received data' : 'Metrics service unavailable';
    byId('connection-dot').className = 'status-dot offline';
    byId('error').textContent = `${error.name === 'AbortError' ? 'The metrics request timed out.' : error.message} Start the backend on localhost:3001 with CORS enabled for http://localhost:3000. Retrying automatically every 5 seconds.`;
    byId('error').hidden = false;
    if (!hasData) byId('chart-empty').textContent = 'Telemetry will appear when the metrics service is available.';
  } finally {
    clearTimeout(timeout);
    refreshing = false;
    byId('refresh').disabled = false;
  }
}

byId('refresh').addEventListener('click', refresh);
refresh();
setInterval(refresh, 5000);
