const http = require('http');
const url = require('url');
const os = require('os');

// 获取本机 IP 地址
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部接口和 IPv6 地址
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

let droneState = {
  isFlying: false,
  status: 'idle',
  position: { x: 0, y: 0, z: 0 },
  lastUpdate: Date.now()
};

let autoStopTimer = null;

function sendJSON(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const { pathname } = url.parse(req.url);
  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

  // GET /api/drone/status
  if (pathname === '/api/drone/status' && req.method === 'GET') {
    sendJSON(res, 200, {
      isFlying: droneState.isFlying,
      status: droneState.status,
      position: droneState.position,
      timestamp: droneState.lastUpdate
    });
    return;
  }

  // PUT /api/drone/status
  if (pathname === '/api/drone/status' && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        if (data.isFlying !== undefined) droneState.isFlying = data.isFlying;
        if (data.status !== undefined) droneState.status = data.status;
        if (data.position !== undefined) droneState.position = data.position;
        droneState.lastUpdate = Date.now();

        // Auto-stop after 30 seconds if flying
        if (droneState.isFlying === true) {
          console.log(`[${new Date().toISOString()}] ✈️ Flight started - auto-stop in 30s`);
          if (autoStopTimer) clearTimeout(autoStopTimer);
          autoStopTimer = setTimeout(() => {
            droneState.isFlying = false;
            droneState.status = 'idle';
            droneState.lastUpdate = Date.now();
            autoStopTimer = null;
            console.log(`[${new Date().toISOString()}] 🛬 Auto-stopped`);
          }, 30000);
        }

        sendJSON(res, 200, {
          success: true,
          state: {
            isFlying: droneState.isFlying,
            status: droneState.status,
            position: droneState.position,
            timestamp: droneState.lastUpdate
          }
        });
      } catch (e) {
        sendJSON(res, 400, { error: e.message });
      }
    });
    return;
  }

  // GET /api/health
  if (pathname === '/api/health' && req.method === 'GET') {
    sendJSON(res, 200, {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime()
    });
    return;
  }

  // 404
  sendJSON(res, 404, { error: 'Not found' });
});

const PORT = 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Dashboard API Server Started');
  console.log('='.repeat(60));
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📍 Listen on: 0.0.0.0:${PORT}`);
  console.log('\n✅ Endpoints:');
  console.log('   GET  /api/drone/status');
  console.log('   PUT  /api/drone/status');
  console.log('   GET  /api/health');
  console.log('='.repeat(60) + '\n');
});

process.on('SIGINT', () => {
  if (autoStopTimer) clearTimeout(autoStopTimer);
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  if (autoStopTimer) clearTimeout(autoStopTimer);
  server.close(() => process.exit(0));
});
