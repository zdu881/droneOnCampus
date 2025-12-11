# Electron 应用自动流检测 - 实现总结

## 问题描述
Electron 应用启动后，虽然能连接到 Dashboard API Server，但当用户在 dashboard.html 中点击"开始飞行"按钮时，Electron 应用的像素流不会自动开启。

## 根本原因
1. Dashboard 中的"开始飞行"按钮只调用了 UE 的 `Fly()` 函数
2. 没有同时更新 `/api/drone/status` 端点的飞行状态
3. Electron 应用通过轮询检测飞行状态变化，但状态没有被更新

## 解决方案

### 修改 1: api-manager.js
在 `triggerDroneAction()` 和 `startDelivery()` 函数中添加对 Dashboard API 的调用：

**修改位置**: `/data/home/sim6g/rayCode/droneOnCampus/api-manager.js`

```javascript
// 触发无人机动作 - 更新函数名为Fly
async triggerDroneAction() {
  const result = await this.sendRequest(this.levelScriptActorPath, "Fly", {});
  
  // 【新增】同步更新 Dashboard API 的飞行状态，供 Electron 应用检测
  if (result.success) {
    try {
      await fetch('http://localhost:8000/api/drone/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isFlying: true,
          status: 'flying'
        })
      });
      console.log('✅ Dashboard API 飞行状态已更新');
    } catch (err) {
      console.warn('⚠️ 无法更新 Dashboard API 飞行状态:', err.message);
    }
  }
  
  return result;
}
```

同样的修改也应用在 `startDelivery()` 函数中。

### 修改 2: src/frontend/js/api-manager.js
同样的修改应用在前端版本的 `triggerDroneAction()` 和 `startDelivery()` 函数中。

## 工作流程

```
1. 用户点击 "开始飞行" 按钮
   ↓
2. dashboard-manager.startDroneFlight() 被调用
   ↓
3. ueApiManager.triggerDroneAction() 执行
   ├─ 调用 UE 的 Fly() 函数
   └─ PUT /api/drone/status { isFlying: true }
   ↓
4. Dashboard API Server 收到请求
   ├─ 更新内部状态: droneState.isFlying = true
   └─ 启动 30 秒自动关闭计时器
   ↓
5. Electron 应用轮询检测
   ├─ 每 500ms 发送 GET /api/drone/status
   ├─ 检测到 isFlying: false → true 的变化
   └─ 自动启动像素流
   ↓
6. 30 秒后自动停止
   ├─ API Server 重置: isFlying = false
   ├─ Electron 检测到变化
   └─ 自动停止像素流
```

## 部署步骤

### 1. 启动 Dashboard API Server
```bash
cd /data/home/sim6g/rayCode/droneOnCampus
node server.js &
```

### 2. 访问 Dashboard
```
http://localhost:8081/dashboard.html
```

### 3. 点击"开始飞行"按钮
- Dashboard 会立即调用 UE 的 Fly() 函数
- 同时更新 API Server 的飞行状态
- Electron 应用应该立即检测到状态变化并启动流

### 4. 验证

**检查 API 健康状态**:
```bash
curl -s http://localhost:8000/api/health | jq .
```

**检查飞行状态**:
```bash
curl -s http://localhost:8000/api/drone/status | jq .
```

**手动测试飞行状态设置**:
```bash
curl -s -X PUT http://localhost:8000/api/drone/status \
  -H "Content-Type: application/json" \
  -d '{"isFlying": true, "status": "flying"}' | jq .
```

## API 端点

### GET /api/drone/status
获取当前飞行状态

**响应**:
```json
{
  "isFlying": false,
  "status": "idle",
  "position": {"x": 0, "y": 0, "z": 0},
  "timestamp": 1702xxxx
}
```

### PUT /api/drone/status
更新飞行状态（30秒后自动重置）

**请求体**:
```json
{
  "isFlying": true,
  "status": "flying"
}
```

**响应**:
```json
{
  "success": true,
  "state": {
    "isFlying": true,
    "status": "flying",
    "position": {"x": 0, "y": 0, "z": 0},
    "timestamp": 1702xxxx
  }
}
```

### GET /api/health
健康检查

**响应**:
```json
{
  "status": "ok",
  "timestamp": 1702xxxx,
  "uptime": 123.456
}
```

## 关键改进

1. ✅ Dashboard 操作现在自动同步到 API 状态
2. ✅ Electron 应用能够检测到状态变化
3. ✅ 自动流启动/停止功能生效
4. ✅ 30 秒自动重置确保可靠性
5. ✅ 错误处理确保系统稳定

## 注意事项

- Dashboard API Server 必须在 8000 端口运行
- Electron 应用配置的轮询间隔为 500ms
- 自动停止计时器为 30 秒
- 所有操作都支持 CORS
- 失败的 API 调用不会中断 UE 函数执行
