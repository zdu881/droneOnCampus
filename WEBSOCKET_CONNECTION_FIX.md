# WebSocket 连接诊断与修复指南 - 已修复 ✅

## 问题症状（已解决）

```
Error fetching cluster data: TypeError: NetworkError when attempting to fetch resource
GET ws://10.30.2.11:8001/ws
NS_ERROR_WEBSOCKET_CONNECTION_REFUSED
```

---

## 根本原因（已识别和修复）

### ✅ 问题原因：错误的端口配置

**发现**:
- 原配置将 CastRay 指向 `8001` 端口（实际是文件服务器）
- 实际 CastRay 服务运行在 **8000** 端口（uvicorn）
- 端口 8001 运行的是 `http.server`（文件下载服务）

**修复**:
- CastRay API 和 WebSocket 都改为 **8000** 端口
- 8001 仅用于文件下载

---

## 修复后的配置结构

```javascript
window.appConfig = {
  // CastRay 服务（REST API + WebSocket）- 端口 8000
  castrayApiBase: 'http://10.30.2.11:8000',
  castrayWsUrl: 'ws://10.30.2.11:8000/ws',
  
  // CM-ZSB（仅用于预测功能）- 端口 8000
  rayApiBase: 'http://10.30.2.11:8000',
  wsUrl: 'ws://10.30.2.11:8000/ws',
  
  // 文件下载服务 - 端口 8001
  fileServerUrl: 'http://10.30.2.11:8001',
  
  // 其他服务
  ueRemoteControlUrl: 'http://10.30.2.11:30010',
  vehicleAgentUrl: 'http://10.30.2.11:5000/api/agent/decision',
  pixelStreamingUrl: 'http://10.30.2.11:80'
}
```

---

## 验证修复

### ✅ 测试清单

```bash
# 1. 检查 CastRay API
curl http://localhost:8000/api/ray-dashboard

# 2. 测试 WebSocket
websocat ws://localhost:8000/ws

# 3. 检查文件服务器
curl http://localhost:8001/

# 4. 在浏览器控制台验证
console.log(window.appConfig.castrayApiBase)  // http://10.30.2.11:8000
console.log(window.appConfig.castrayWsUrl)    // ws://10.30.2.11:8000/ws
```

---

## 修改的文件

1. **dashboard-manager.js**
   - 修正 castrayApiBase 和 castrayWsUrl 指向 8000
   - 添加 fileServerUrl 配置
   - 更新日志信息

2. **ray-cluster-manager.js**
   - 改为使用 castrayApiBase 而不是 rayApiBase
   - WebSocket 连接改为 castrayWsUrl
   - 更新日志前缀为 [CastRay]

3. **ray-cluster-integration.js**
   - WebSocket 连接改为 castrayWsUrl
   - 使用 castrayApiBase 配置
   - 一致的日志前缀

---

## 系统架构（已更正）

```
┌─────────────────────────────────────────────────┐
│          droneOnCampus Dashboard                │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │     window.appConfig (全局配置)           │  │
│  │                                          │  │
│  │  castrayApiBase: 8000   ✓                │  │
│  │  castrayWsUrl: 8000/ws  ✓                │  │
│  │  fileServerUrl: 8001    ✓                │  │
│  │  (其他服务配置)                          │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │    CastRay Manager                       │  │
│  │    (REST API + WebSocket)                │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
                    ↓
     ┌──────────────────────────────────┐
     │   CastRay Service (8000)         │
     │  - REST API: /api/ray-dashboard  │
     │  - WebSocket: /ws                │
     │  - uvicorn FastAPI App           │
     └──────────────────────────────────┘
                    ↓
     ┌──────────────────────────────────┐
     │   File Server (8001)             │
     │  - http.server SimpleHTTP        │
     │  - 文件下载和浏览                 │
     └──────────────────────────────────┘
```

---

## 部署验证

### 在浏览器控制台执行

```javascript
// 1. 验证配置已加载
console.log('Config loaded:', window.appConfig);

// 2. 测试 API 连接
fetch(window.appConfig.castrayApiBase + '/api/ray-dashboard')
  .then(r => r.json())
  .then(d => console.log('✓ API OK:', d))
  .catch(e => console.log('✗ API Error:', e.message));

// 3. 测试 WebSocket
const ws = new WebSocket(window.appConfig.castrayWsUrl);
ws.onopen = () => {
  console.log('✓ WebSocket OK');
  ws.close();
};
ws.onerror = (e) => {
  console.log('✗ WebSocket Error:', e);
};

// 4. 查看集群数据
console.log('Cluster data:', window.dashboardManager?.rayClusterManager?.nodes);
```

---

## 常见问题解决

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| CORS 错误 | 浏览器阻止跨域请求 | CastRay 已配置 CORS，检查防火墙 |
| WebSocket 拒绝连接 | 端口错误或服务未启动 | 确保 CastRay 在 8000 运行 |
| 无法获取集群数据 | API 端点路径错误 | 使用 `/api/ray-dashboard` |
| 端口被占用 | 服务冲突 | 检查 `ss -tuln \| grep 8000` |

---

## 性能验证

```bash
# 查看实际运行的进程
ps aux | grep -E 'uvicorn|http.server' | grep -v grep

# 输出应该显示:
# uvicorn services.castray.main:app --host 0.0.0.0 --port 8000
# python3 -m http.server 8001
```

---

## 下一步

- ✅ 配置已修正
- ✅ 所有服务已验证
- ✅ WebSocket 连接已测试
- ✅ 文档已更新

**状态**: 🎉 所有问题已解决，系统运行正常

**最后更新**: 2025-12-04  
**版本**: 2.0 (已修复正确的架构)


### 🔍 原因 1: Ray 服务未启动

**症状**: 无法连接到 `10.30.2.11:8000`

**解决方案**:

```bash
# 检查 Ray 集群是否运行
curl http://10.30.2.11:8000/api/ray-dashboard

# 如果失败，启动 Ray 集群
# 对于 CM-ZSB:
cd ~/CM-ZSB
python -m cm_zsb.server --port 8000

# 或者对于 Ray 集群:
ray start --head --port=8000
```

---

### 🔍 原因 2: IP 地址不正确

**症状**: 配置使用 `10.30.2.11`，但服务实际在 `localhost` 或其他 IP

**快速诊断**:

```bash
# 1. 检查当前机器的 IP 地址
hostname -I

# 2. 检查 localhost 上的服务
curl http://localhost:8000/api/ray-dashboard

# 3. 检查特定 IP 的服务
curl http://10.30.2.11:8000/api/ray-dashboard
```

**修复方案**: 根据实际情况修改 `window.appConfig.rayApiBase`

---

### 🔍 原因 3: 防火墙阻止连接

**症状**: 连接超时或被拒绝

**解决方案**:

```bash
# 检查端口是否开放
sudo netstat -tuln | grep 8000

# 或使用 ss (推荐)
ss -tuln | grep 8000

# 如果需要，开放防火墙
sudo ufw allow 8000/tcp
sudo ufw allow 8001/tcp
```

---

## 修复步骤

### ✅ 步骤 1: 确定正确的 IP/Host

在浏览器控制台执行：

```javascript
// 测试不同的地址
const testUrls = [
  'http://localhost:8000/api/ray-dashboard',
  'http://127.0.0.1:8000/api/ray-dashboard',
  'http://10.30.2.11:8000/api/ray-dashboard',
  'http://[您的IP地址]:8000/api/ray-dashboard'
];

for (const url of testUrls) {
  fetch(url)
    .then(r => r.json())
    .then(d => console.log('✓ 成功:', url, d))
    .catch(e => console.log('✗ 失败:', url, e.message));
}
```

### ✅ 步骤 2: 更新配置

找到能工作的 URL 后，修改 `dashboard-manager.js`:

```javascript
initializeAppConfig() {
  window.appConfig = {
    // 使用实际工作的 IP/host
    rayApiBase: 'http://localhost:8000',  // 或其他正确的地址
    wsUrl: 'ws://localhost:8000/ws',      // 同一个地址
    // ... 其他配置
  };
}
```

### ✅ 步骤 3: 验证 WebSocket 连接

```javascript
// 在浏览器控制台测试 WebSocket
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onopen = () => {
  console.log('✓ WebSocket 连接成功!');
  ws.close();
};

ws.onerror = (e) => {
  console.log('✗ WebSocket 连接失败:', e);
};

ws.onclose = () => {
  console.log('WebSocket 已关闭');
};
```

---

## 完整的配置选项

### 本地开发（推荐）

```javascript
// 所有服务都在本机上运行
window.appConfig = {
  rayApiBase: 'http://localhost:8000',
  wsUrl: 'ws://localhost:8000/ws',
  castrayApiBase: 'http://localhost:8001',
  castrayWsUrl: 'ws://localhost:8001/ws',
  // ...其他配置
};
```

### 远程服务器

```javascript
// 服务运行在远程机器上
window.appConfig = {
  rayApiBase: 'http://192.168.1.100:8000',
  wsUrl: 'ws://192.168.1.100:8000/ws',
  castrayApiBase: 'http://192.168.1.100:8001',
  castrayWsUrl: 'ws://192.168.1.100:8001/ws',
  // ...其他配置
};
```

### 跨域场景（需要 CORS 支持）

如果前端和后端在不同的域上：

```javascript
// 后端需要支持 CORS
// 在 Ray/CastRay 服务器上配置 CORS 头:
// Access-Control-Allow-Origin: *
// Access-Control-Allow-Methods: GET, POST, OPTIONS
// Access-Control-Allow-Headers: Content-Type
```

---

## 最快诊断流程

### 1️⃣ 打开浏览器开发者工具（F12）

### 2️⃣ 在控制台执行诊断脚本

```javascript
console.log('=== 诊断信息 ===');
console.log('当前配置:', window.appConfig);

// 测试 Ray API
fetch('http://localhost:8000/api/ray-dashboard')
  .then(r => r.status === 200 ? '✓ Ray API 可连接' : '✗ Ray API 返回 ' + r.status)
  .then(m => console.log(m))
  .catch(e => console.log('✗ Ray API 不可连接:', e.message));

// 测试 Ray WebSocket
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onopen = () => {
  console.log('✓ Ray WebSocket 可连接');
  ws.close();
};
ws.onerror = () => console.log('✗ Ray WebSocket 不可连接');
```

### 3️⃣ 根据结果判断

| 结果 | 原因 | 解决方案 |
|------|------|--------|
| API ✓, WS ✓ | 配置正确 | 检查防火墙或服务是否真的启动 |
| API ✗, WS ✗ | 地址或端口错误 | 验证 IP 地址和端口号 |
| API ✓, WS ✗ | 仅 WebSocket 有问题 | 检查 WebSocket 代理或防火墙规则 |

---

## 常见错误与解决

### ❌ 错误: "CORS header 'Access-Control-Allow-Origin' missing"

**原因**: 跨域请求被浏览器阻止

**解决**:
```javascript
// 后端需要添加 CORS 头
// 在 ray-cluster-manager.js 中添加 credentials
fetch(apiUrl, {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'omit'  // 不发送 cookies
});
```

或配置后端支持 CORS：

```python
# 对于 Flask/FastAPI
from flask_cors import CORS
CORS(app, resources={r"/api/*": {"origins": "*"}})
```

### ❌ 错误: "NS_ERROR_WEBSOCKET_CONNECTION_REFUSED"

**原因**: WebSocket 连接被拒绝（服务未运行或防火墙阻止）

**解决**:
1. 确认服务在该端口上运行: `netstat -tuln | grep 8000`
2. 检查防火墙: `sudo ufw status`
3. 尝试本地连接: `ws://localhost:8000/ws`

---

## 验证清单

- [ ] Ray/CM-ZSB 服务已启动
- [ ] 端口 8000 在防火墙中开放
- [ ] 已找到正确的 IP/hostname
- [ ] 浏览器控制台显示 WebSocket 连接成功
- [ ] 集群数据在页面上显示
- [ ] Ray 集群标签卡显示节点信息

---

## 下一步

如果以上步骤都不能解决问题，请收集以下信息：

1. **服务状态**:
   ```bash
   # Ray/CM-ZSB 是否运行
   ps aux | grep -E 'ray|cm_zsb'
   
   # 监听的端口
   netstat -tuln | grep -E '8000|8001'
   ```

2. **网络诊断**:
   ```bash
   # 远程连接测试
   curl -v http://10.30.2.11:8000/api/ray-dashboard
   
   # WebSocket 测试
   websocat ws://10.30.2.11:8000/ws
   ```

3. **浏览器错误**:
   - 截图浏览器控制台的完整错误信息
   - 包含网络标签页（Network tab）中的请求详情

---

**最后更新**: 2025-12-04  
**状态**: 已修复 ✅
