/**
 * Dashboard API Server
 * 为 Electron 应用提供 REST API 接口
 * 监听 8000 端口，提供无人机飞行状态接口
 */

const http = require('http');
const url = require('url');

// 全局状态
let droneState = {
  isFlying: false,
  lastUpdate: Date.now(),
  position: { x: 0, y: 0, z: 0 },
  status: 'idle',
  autoStopTimer: null
};

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  // 设置 CORS 响应头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

  // 路由处理
  if (pathname === '/api/drone/status' && req.method === 'GET') {
    // 获取无人机飞行状态
    res.writeHead(200);
    res.end(JSON.stringify({
      isFlying: droneState.isFlying,
      status: droneState.status,
      position: droneState.position,
      timestamp: droneState.lastUpdate
    }));
    return;
  }

  if (pathname === '/api/drone/status' && req.method === 'PUT') {
    // 更新无人机飞行状态
    let body = '';
    let responded = false;
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('error', (err) => {
      console.error(`[${new Date().toISOString()}] Request error:`, err.message);
      responded = true;
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    });
    
    req.on('end', () => {
      if (responded) return;  // 防止重复响应
      responded = true;
      
      try {
        const data = body ? JSON.parse(body) : {};
        console.log(`[${new Date().toISOString()}] Parsed data:`, data);
        
        // 更新状态
        if (data.isFlying !== undefined) {
          droneState.isFlying = data.isFlying;
        }
        if (data.status !== undefined) {
          droneState.status = data.status;
        }
        if (data.position !== undefined) {
          droneState.position = data.position;
        }
        droneState.lastUpdate = Date.now();

        // 如果设置为飞行状态，30秒后自动关闭
        if (droneState.isFlying === true) {
          console.log(`[${new Date().toISOString()}] ✈️ Flight started - will auto-stop in 30s`);
          
          // 清除之前的定时器（如果有）
          if (droneState.autoStopTimer) {
            clearTimeout(droneState.autoStopTimer);
          }
          
          // 30秒后自动设置为不飞行
          droneState.autoStopTimer = setTimeout(() => {
            droneState.isFlying = false;
            droneState.status = 'idle';
            droneState.lastUpdate = Date.now();
            droneState.autoStopTimer = null;
            console.log(`[${new Date().toISOString()}] 🛬 Flight auto-stopped after 30s`);
          }, 30000);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          state: {
            isFlying: droneState.isFlying,
            status: droneState.status,
            position: droneState.position,
            timestamp: droneState.lastUpdate
          }
        }));
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Parse error:`, error.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON', message: error.message }));
      }
    });
    return;
  }

  if (pathname === '/api/health' && req.method === 'GET') {
    // 健康检查
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime()
    }));
    return;
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    // 获取配置
    res.writeHead(200);
    res.end(JSON.stringify({
      dashboardUrl: 'http://10.30.2.11:8000',
      streamUrl: 'http://10.30.2.11:80',
      apiVersion: '1.0.0',
      timestamp: Date.now()
    }));
    return;
  }

  // 404 处理
  res.writeHead(404);
  res.end(JSON.stringify({
    error: 'Not found',
    path: pathname,
    method: req.method
  }));
});

// 启动服务器
const PORT = process.env.PORT || 8000;
const HOST = '0.0.0.0'; // 监听所有接口

server.listen(PORT, HOST, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Dashboard API Server Started');
  console.log(`${'='.repeat(60)}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`📍 Listen on: ${HOST}:${PORT}`);
  console.log(`\n✅ Available endpoints:`);
  console.log(`   GET  /api/drone/status     - Get drone flight status`);
  console.log(`   PUT  /api/drone/status     - Update drone flight status`);
  console.log(`   GET  /api/health           - Health check`);
  console.log(`   GET  /api/config           - Get configuration`);
  console.log(`${'='.repeat(60)}\n`);
});

// 错误处理
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use!`);
    process.exit(1);
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('\n📌 Received SIGTERM, shutting down gracefully...');
  // 清除自动停止定时器
  if (droneState.autoStopTimer) {
    clearTimeout(droneState.autoStopTimer);
  }
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n📌 Received SIGINT, shutting down gracefully...');
  // 清除自动停止定时器
  if (droneState.autoStopTimer) {
    clearTimeout(droneState.autoStopTimer);
  }
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = server;
