# Electron 自动流启动修复 - 快速检查清单

## ✅ 已应用的修复

### 1. 网络地址修复
- [x] `api-manager.js:triggerDroneAction()` - 使用 `http://10.30.2.11:8000`
- [x] `api-manager.js:startDelivery()` - 使用 `http://10.30.2.11:8000`
- [x] `src/frontend/js/api-manager.js:triggerDroneAction()` - 使用 `http://10.30.2.11:8000`
- [x] `src/frontend/js/api-manager.js:startDelivery()` - 使用 `http://10.30.2.11:8000`

### 2. Electron fetch 超时修复
- [x] `doc/electron-app-template/src/drone-monitor.js` - 使用 AbortController 替换 timeout

### 3. Electron IPC 修复
- [x] 创建 `doc/electron-app-template/src/preload.js` - 新文件
- [x] `doc/electron-app-template/main.js` - 修复 preload 路径到 `src/preload.js`
- [x] `doc/electron-app-template/main.js` - 添加 `status:request` IPC 监听器

## 🔍 验证清单

### 验证前置条件
- [ ] API 服务器正在运行 (`node server.js`)
- [ ] Dashboard 可以访问 (`http://localhost:8081/dashboard.html`)
- [ ] Electron 应用已构建并可以启动

### 验证自动流启动
1. [ ] 打开 Electron 应用并打开开发工具 (`Ctrl+Shift+I`)
2. [ ] 观察初始日志，应该看到:
   ```
   📍 Dashboard URL: http://10.30.2.11:8000
   🎯 Starting flight monitor (polling every 500ms)
   ```
3. [ ] 在 Dashboard 中点击"开始飞行"按钮
4. [ ] 检查 Electron 日志，应该看到:
   ```
   ✈️ DRONE FLIGHT STARTED
   🎬 像素流已启动
   📊 状态: streaming
   ```
5. [ ] 验证 iframe 已自动创建并显示像素流

### 故障诊断
如果自动流启动不工作：

**检查点 1: API 服务器状态**
```bash
curl http://10.30.2.11:8000/api/drone/status | jq .
# 应该返回 JSON 对象，包含 isFlying 字段
```

**检查点 2: 状态更新**
```bash
# 点击 Dashboard "开始飞行" 后，立即运行:
curl http://10.30.2.11:8000/api/drone/status | jq '.isFlying'
# 应该返回 true
```

**检查点 3: Electron 可访问性**
```bash
# 在运行 Electron 的机器上
curl http://10.30.2.11:8000/api/drone/status
# 应该成功，不能是 localhost 地址
```

**检查点 4: Electron 日志**
- 打开 Electron 开发工具
- 查看 Console 标签
- 查找"DRONE FLIGHT STARTED"日志
- 如果看到"Failed to check flight status"，检查网络连接

## 文件修改摘要

| 文件 | 修改内容 | 原因 |
|------|---------|------|
| `api-manager.js` | 2 处 localhost → 10.30.2.11 | 网络地址一致性 |
| `src/frontend/js/api-manager.js` | 2 处 localhost → 10.30.2.11 | 网络地址一致性 |
| `doc/electron-app-template/src/drone-monitor.js` | 修复 fetch timeout | Node.js 兼容性 |
| `doc/electron-app-template/src/preload.js` | 新建文件 | IPC 通信安全 |
| `doc/electron-app-template/main.js` | 修复 preload 路径和 IPC | 完整的 IPC 通信链 |

## 预期行为

### 完全工作状态
```
用户操作                    系统反应
─────────────────────────  ──────────────────────
点击"开始飞行"  ──→  Dashboard 更新 API 状态
                      ↓
                    API 服务器设置 isFlying=true
                      ↓
                    Electron 轮询检测到状态变化
                      ↓
                    发送 'flight:started' 事件
                      ↓
                    发送 IPC 消息到 renderer
                      ↓
                    Renderer 创建 iframe
                      ↓
                    ✅ 像素流自动显示
```

### 常见问题症状
- **症状**: Electron 报错"无法连接到 Dashboard 服务"
  - **原因**: API 服务器没有运行或网络不通
  - **修复**: 启动服务器，检查网络

- **症状**: 连接正常但流不自动启动
  - **原因**: Dashboard 没有更新 API，或 Electron 没有检测到变化
  - **修复**: 检查 api-manager.js 中的 fetch 调用

- **症状**: 看到控制台错误"electronAPI is not defined"
  - **原因**: preload.js 未正确加载
  - **修复**: 验证 main.js 中的 preload 路径

## 下一步操作

1. **验证修复**: 运行上述验证清单
2. **测试自动流启动**: 点击 Dashboard"开始飞行"，观察 Electron 自动显示流
3. **收集日志**: 如果出现问题，收集完整的控制台日志供调试
4. **报告结果**: 确认是否完全工作

---

**最后更新**: 2025-12-11  
**关键修复日期**: 网络地址修复、IPC 通信修复、fetch 超时修复
