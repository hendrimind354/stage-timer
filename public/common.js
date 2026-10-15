// Sinkronisasi state + jam server. Dipakai display.html dan control.html
function connectTimer(onState) {
  let offset = 0; // serverTime - clientTime
  let state = null;

  function remaining() {
    if (!state) return 0;
    return state.running ? state.endsAt - (Date.now() + offset) : state.remainingMs;
  }

  async function calibrate() {
    // ukur offset jam dengan beberapa sampel, ambil RTT terkecil
    let best = null;
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      try {
        const r = await fetch('/api/time', { cache: 'no-store' });
        const { now } = await r.json();
        const t1 = Date.now();
        const rtt = t1 - t0;
        const off = now + rtt / 2 - t1;
        if (!best || rtt < best.rtt) best = { rtt, off };
      } catch {}
    }
    if (best) offset = best.off;
  }

  function open() {
    const es = new EventSource('/events');
    es.onmessage = (e) => {
      state = JSON.parse(e.data);
      onState(state, true);
    };
    es.onerror = () => onState(state, false); // EventSource akan reconnect otomatis
  }

  calibrate().then(() => { open(); setInterval(calibrate, 60000); });

  return {
    remaining,
    get state() { return state; },
    send(cmd) {
      return fetch('/api/cmd', { method: 'POST', body: JSON.stringify(cmd) });
    },
  };
}

function formatTime(ms) {
  const neg = ms < 0;
  const total = Math.floor(Math.abs(ms) / 1000) + (neg ? 0 : (Math.abs(ms) % 1000 ? 1 : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  const core = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  return (neg ? '−' : '') + core;
}

function zoneOf(ms, st) {
  if (ms <= 0) return 'over';
  if (ms <= st.alertMs) return 'alert';
  if (ms <= st.warnMs) return 'warn';
  return 'ok';
}
