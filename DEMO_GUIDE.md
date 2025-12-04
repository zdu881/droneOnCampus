# 🚁 UE5.3无人机系统 - 快速演示指南

## 演示流程

### 第一步：打开仪表板
```
1. 在浏览器打开 dashboard.html
2. 等待系统加载完成（检查 Console 日志）
3. 应该看到 "Dashboard Manager initialized" 消息
```

### 第二步：切换到自动驾驶场景
```
1. 在顶部找到"自动驾驶"按钮（Autonomous Driving）
2. 点击切换到该场景
3. 应该看到灯光控制卡片和无人机飞行控制卡片
```

---

## 功能演示 A：灯光控制

### 灯光区域位置
```
自动驾驶场景 → 左侧卡片区 → "基站灯光控制"
```

### 演示步骤
```
1️⃣ 查看灯光指示区域
   - 应该看到3个灯泡指示器（light1, light2, light3）
   - 默认颜色为绿色（正常）

2️⃣ 点击灯光按钮改变颜色
   选项A - 逐个改变：
   - 点击 "灯光1" 区域按钮 → 变为红色
   - 点击 "灯光2" 区域按钮 → 变为黄色
   - 点击 "灯光3" 区域按钮 → 变为绿色

   选项B - 快速操作（如果有）：
   - 点击 "全部绿色" 按钮 → 3个灯都变绿
   - 点击 "全部红色" 按钮 → 3个灯都变红
   - 点击 "全部黄色" 按钮 → 3个灯都变黄

3️⃣ 查看控制台日志
   应该看到：
   ✓ 调用函数 'ChangeColorAPI' 在对象: [light1/light2/light3]
   ✓ 响应状态码: 200
   ✓ 请求成功!
```

---

## 功能演示 B：无人机飞行控制

### 飞行控制卡片位置
```
自动驾驶场景 → 中间卡片区 → "🚁 无人机飞行控制"
```

### 演示方案 1：使用预设位置（推荐）
```
1️⃣ 打开预设位置下拉菜单
   - 看到三个选项：
     • 图书馆 (0, 0, 100) → (-850, -30, 62)
     • 宿舍 (0, 0, 100) → (500, 400, 80)
     • 食堂 (0, 0, 100) → (-200, 300, 75)

2️⃣ 选择"图书馆"
   - 坐标自动填充：
     起点: X=0, Y=0, Z=100
     终点: X=-850, Y=-30, Z=62

3️⃣ 点击"开始飞行"按钮
   - 飞行状态显示 "飞行中..."
   - 完成后显示 "飞行完成!"

4️⃣ 查看控制台日志
   应该看到：
   ✓ 调用函数 'SetLocation' 在对象: [...NewMap_C_3]
   ✓ 响应状态码: 200
   ✓ 位置已设置
   ✓ 调用函数 'Fly' 在对象: [...NewMap_C_3]
   ✓ 飞行已执行
```

### 演示方案 2：手动输入坐标
```
1️⃣ 在"起点设置"区域输入：
   X: 100
   Y: 50
   Z: 120

2️⃣ 在"终点设置"区域输入：
   X: 400
   Y: 300
   Z: 150

3️⃣ 点击"开始飞行"按钮

4️⃣ 等待飞行完成
```

---

## 功能演示 C：CM-ZSB 节点灯光映射（自动）

### 工作原理
```
后台程序每3秒自动：
1. 检测3个节点的状态
2. 根据状态决定灯光颜色
3. 调用灯光控制 API 更新显示
```

### 查看效果
```
1️⃣ 打开浏览器 Console（F12）
   - 看到持续的节点检测日志：
     ✓ 节点 node-1 状态: idle → 灯光1变为颜色1 (绿色)
     ✓ 节点 node-2 状态: detecting → 灯光2变为颜色0 (红色)
     ✓ 节点 node-3 状态: transmitting → 灯光3变为颜色2 (黄色)

2️⃣ 观察灯光指示器
   - 灯光颜色应该每3秒自动变化一次
   - 反映节点的实时状态
```

### 节点状态映射
```
节点状态 → 灯光颜色
├─ idle (正常)      → 绿色 (1)
├─ detecting (检测) → 红色 (0)
├─ transmitting (发送) → 黄色 (2)
└─ error (错误)     → 红色 (0)
```

---

## 完整演示流程（建议顺序）

### 时间：5分钟

```
[0:00] 打开仪表板
      - 等待加载完成，检查 console

[1:00] 切换到自动驾驶场景
      - 展示灯光控制卡片
      - 展示飞行控制卡片

[1:30] 灯光控制演示
      - 展示预设快速操作（全绿、全红、全黄）
      OR
      - 手动改变各个灯光颜色
      - 展示 Console 中的 API 调用日志

[3:00] 无人机飞行演示
      - 方案 A：选择"图书馆"预设，开始飞行
      - 展示飞行状态变化
      - 展示 Console 中的 SetLocation 和 Fly 调用

[4:30] CM-ZSB 节点映射演示
      - 打开 Console
      - 展示自动节点检测和灯光更新
      - 解释状态映射关系

[5:00] 演示完成
      - 总结三个功能
      - 回答问题
```

---

## 故障排查

### 问题 1：灯光控制无反应
```
检查项：
□ API 地址是否正确: http://10.30.2.11:30010/remote/object/call
□ UE 应用是否在运行
□ Console 是否显示错误信息
□ 网络连接是否正常

解决方案：
1. 检查 Console 错误信息
2. 验证 10.30.2.11 是否可以 ping 通
3. 检查 UE Remote Control API 是否已启用
```

### 问题 2：飞行控制失败
```
检查项：
□ 无人机路径是否正确: /Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_3
□ 坐标输入是否有效
□ SetLocation 调用是否成功
□ Fly 调用是否成功

解决方案：
1. 查看 Console 中的具体错误信息
2. 尝试其他预设位置
3. 验证坐标范围（通常 X/Y 在 -1000 到 1000，Z 在 50 到 300）
```

### 问题 3：节点映射没有效果
```
检查项：
□ nodeDetectionInterval 是否已启动
□ checkNodeStatusAndUpdateLights 是否被调用
□ 灯光 API 是否正确响应

解决方案：
1. 检查 Console 是否有 "节点检测" 日志
2. 手动调用灯光 API 测试
3. 增加检测间隔时间便于观察
```

---

## API 测试工具

### 使用 Postman/curl 测试灯光 API

```bash
# 改变灯光1为红色
curl -X PUT http://10.30.2.11:30010/remote/object/call \
  -H "Content-Type: application/json" \
  -d '{
    "objectPath": "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9CFA302_2066102057",
    "functionName": "ChangeColorAPI",
    "parameters": { "Active": 0 }
  }'

# 改变灯光1为绿色
curl -X PUT http://10.30.2.11:30010/remote/object/call \
  -H "Content-Type: application/json" \
  -d '{
    "objectPath": "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9CFA302_2066102057",
    "functionName": "ChangeColorAPI",
    "parameters": { "Active": 1 }
  }'
```

### 使用 JavaScript 控制台测试

```javascript
// 测试灯光
apiManager.changeBaseStationLight(1, 0);  // 灯光1变红
apiManager.changeBaseStationLight(2, 1);  // 灯光2变绿
apiManager.changeBaseStationLight(3, 2);  // 灯光3变黄

// 测试无人机
flightPathManager.setStartLocation(0, 0, 100);
flightPathManager.setTargetLocation(-850, -30, 62);
flightPathManager.startFlight();

// 查看路径描述
console.log(flightPathManager.getPathDescription());
```

---

## 性能指标

| 指标 | 值 | 说明 |
|-----|-----|------|
| 灯光响应时间 | < 500ms | API 调用 + 绘制时间 |
| 飞行执行时间 | 1-2秒 | SetLocation + Fly |
| 节点检测间隔 | 3秒 | 可配置 |
| 网络延迟 | 10-50ms | 局域网内 |

---

## 技术栈

- **前端**: HTML5 + CSS3 + Vanilla JavaScript
- **后端**: UE5.3 Remote Control API + Blueprints
- **通信**: HTTP/REST (PUT 方法)
- **实时通信**: WebSocket (PixelStreaming)

---

## 相关文档

- 📄 [UE5.3 集成总结](UE5_INTEGRATION_SUMMARY.md)
- 📄 [API 参考](api-manager.js)
- 🔗 [官方 Remote Control API 文档](https://dev.epicgames.com/documentation/zh-cn/unreal-engine/remote-control-api-http-reference-for-unreal-engine?application_version=5.5)

---

**演示日期**: 2025年12月4日  
**版本**: 1.0 生产版  
**状态**: ✅ 准备就绪
