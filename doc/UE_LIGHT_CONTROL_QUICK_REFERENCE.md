# UE 灯光控制 - 快速参考

## 🎯 核心功能

### 灯光对象
```
灯光1: light_C_UAID_A0AD9F0755B9CFA302_2066102057
灯光2: light_C_UAID_A0AD9F0755B9D2A302_1321381589
灯光3: light_C_UAID_A0AD9F0755B9D2A302_1393896590
```

### 颜色代码
```
0 = 红色 (Error/Detecting)
1 = 绿色 (Normal/Idle)
2 = 黄色 (Warning/Processing)
```

## 📡 API 调用

### 基础调用
```javascript
// API 端点
POST http://10.30.2.11:30010/remote/object/call

// 请求体
{
  "objectPath": "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_xxx",
  "functionName": "ChangeColorAPI",
  "parameters": {
    "Active": 0  // 颜色代码
  },
  "generateTransaction": true
}
```

### 通过 API Manager
```javascript
// 单个灯光
await ueApiManager.changeBaseStationLight(1, 0);  // 灯光1设为红色
await ueApiManager.changeBaseStationLight(2, 1);  // 灯光2设为绿色
await ueApiManager.changeBaseStationLight(3, 2);  // 灯光3设为黄色

// 全部灯光
await ueApiManager.changeBaseStationLight(0, 1);  // 全部设为绿色

// 快速操作
await ueApiManager.setBaseStationGreen(0);   // 全部绿色
await ueApiManager.setBaseStationRed(1);     // 灯光1红色
await ueApiManager.setBaseStationYellow(2);  // 灯光2黄色
```

### 高级操作
```javascript
// 闪烁效果
await ueApiManager.blinkBaseStationLight(1, 0, 3, 300);
// 参数: 灯光ID, 颜色代码, 次数, 间隔(ms)

// 根据状态设置
await ueApiManager.setBaseStationStatusLight(1, "idle");      // 绿色
await ueApiManager.setBaseStationStatusLight(1, "detecting"); // 黄色
await ueApiManager.setBaseStationStatusLight(1, "error");     // 红色+闪烁
```

## 🖱️ 前端交互

### 灯光选择
```javascript
// HTML 按钮
<button class="light-select-btn" data-light="1">灯光1</button>
<button class="light-select-btn" data-light="all">全部</button>

// 选中的灯光
this.selectedLightIndex  // "1", "2", "3", "all"
```

### 颜色选择
```javascript
// HTML 按钮
<button class="color-btn red-btn" data-color="0">红色</button>
<button class="color-btn green-btn" data-color="1">绿色</button>
<button class="color-btn yellow-btn" data-color="2">黄色</button>

// 事件监听
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    const colorCode = btn.dataset.color;
    await ueApiManager.changeBaseStationLight(
      this.selectedLightIndex,
      parseInt(colorCode)
    );
  });
});
```

## 🧪 测试工具

### 访问测试页面
```
http://localhost:8080/droneOnCampus/test_light_control.html
```

### 测试功能
- 单个灯光控制
- 快速操作（全部绿/红/黄）
- 闪烁测试
- 序列点亮
- 连接测试
- 控制台日志

## 📊 集成示例

### 与检测任务集成
```javascript
async runDetectionTask(mode) {
  // 开始检测：设灯光为黄色
  await ueApiManager.setBaseStationYellow(this.selectedNodeIndex);
  
  try {
    const response = await fetch('http://10.30.2.11:8000/api/station-maintenance/detect', {
      method: 'POST',
      body: JSON.stringify({ node_id: nodeId, mode: mode })
    });
    
    const data = await response.json();
    
    // 轮询状态
    this.pollDetectionStatus(data.task_id);
    
  } catch (error) {
    // 错误：设灯光为红色+闪烁
    await ueApiManager.blinkBaseStationLight(
      this.selectedNodeIndex,
      0,  // 红色
      3,  // 闪烁3次
      300 // 300ms间隔
    );
  }
}

async pollDetectionStatus(taskId) {
  // ... 轮询逻辑
  
  if (status.completed) {
    if (status.error) {
      // 检测失败：红色
      await ueApiManager.setBaseStationRed(this.selectedNodeIndex);
    } else {
      // 检测成功：绿色
      await ueApiManager.setBaseStationGreen(this.selectedNodeIndex);
    }
    this.showDetectionResults(status);
  }
}
```

## 📁 文件清单

| 文件 | 功能 | 修改内容 |
|------|------|--------|
| `ue-light-manager.js` | 灯光管理器 | 新增 |
| `api-manager.js` | API 管理 | 添加灯光控制方法 |
| `dashboard.html` | UI 界面 | 添加灯光控制区域 |
| `dashboard-styles.css` | 样式表 | 添加灯光控制样式 |
| `dashboard-manager.js` | 事件管理 | 添加灯光事件监听 |
| `test_light_control.html` | 测试工具 | 新增 |

## 🔧 配置参数

### API Manager 配置
```javascript
class UnrealEngineAPIManager {
  constructor() {
    this.baseUrl = "http://10.30.2.11:30010/remote/object/call";
    this.method = "PUT";  // 或 "POST"
    this.headers = {
      "Content-Type": "application/json"
    };
  }
}
```

### 灯光状态映射
```javascript
const statusMap = {
  "idle": 1,       // 绿色
  "detecting": 2,  // 黄色
  "sending": 0,    // 红色
  "error": 0       // 红色
};
```

## 🎨 UI 样式

### 主题颜色
```css
--primary-bg: #1a1d23;      /* 深色背景 */
--accent-primary: #00d4ff;  /* 青色主题 */
--success-color: #10b981;   /* 成功/绿色 */
--warning-color: #f59e0b;   /* 警告/黄色 */
--danger-color: #ef4444;    /* 错误/红色 */
```

### 按钮样式
```css
/* 红色按钮 */
.color-btn.red-btn {
  background: rgba(239, 68, 68, 0.15);
  color: #ff6b6b;
  border-color: #ff6b6b;
}

/* 绿色按钮 */
.color-btn.green-btn {
  background: rgba(16, 185, 129, 0.15);
  color: #51cf66;
  border-color: #51cf66;
}

/* 黄色按钮 */
.color-btn.yellow-btn {
  background: rgba(245, 158, 11, 0.15);
  color: #ffd93d;
  border-color: #ffd93d;
}
```

## ⚠️ 常见问题

### Q: 如何改变单个灯光的颜色？
```javascript
await ueApiManager.changeBaseStationLight(1, 0);  // 灯光1设为红色
```

### Q: 如何改变全部灯光的颜色？
```javascript
await ueApiManager.changeBaseStationLight(0, 1);  // 全部设为绿色
```

### Q: 如何实现闪烁效果？
```javascript
await ueApiManager.blinkBaseStationLight(1, 0, 5, 200);
// 灯光1闪烁5次，200ms间隔
```

### Q: 如何测试连接是否正常？
```javascript
const result = await ueApiManager.testConnection();
if (result.success) {
  console.log("连接成功");
} else {
  console.log("连接失败:", result.error);
}
```

### Q: 灯光对象路径在哪里修改？
在 `api-manager.js` 的 `getBaseStationLightPaths()` 方法中修改：
```javascript
getBaseStationLightPaths() {
  return {
    light1: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_...",
    light2: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_...",
    light3: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_..."
  };
}
```

## 📚 进阶用法

### 自定义状态映射
```javascript
async setCustomStatus(lightIndex, status) {
  const customMap = {
    "initializing": 2,  // 黄色
    "running": 1,       // 绿色
    "error": 0,         // 红色
    "stopped": 1        // 绿色
  };
  
  const colorCode = customMap[status];
  return await ueApiManager.changeBaseStationLight(lightIndex, colorCode);
}
```

### 动画序列
```javascript
async playLightSequence() {
  const sequence = [
    { lights: [1], color: 1, duration: 500 },
    { lights: [2], color: 1, duration: 500 },
    { lights: [3], color: 1, duration: 500 },
    { lights: [0], color: 0, duration: 1000 },
    { lights: [0], color: 1, duration: 500 }
  ];
  
  for (const step of sequence) {
    await ueApiManager.changeBaseStationLight(step.lights[0], step.color);
    await new Promise(r => setTimeout(r, step.duration));
  }
}
```

### 批量操作
```javascript
async setBulkStatus(nodeStatuses) {
  // nodeStatuses: { 1: "idle", 2: "detecting", 3: "error" }
  const promises = [];
  
  for (const [nodeId, status] of Object.entries(nodeStatuses)) {
    promises.push(
      ueApiManager.setBaseStationStatusLight(nodeId, status)
    );
  }
  
  return await Promise.all(promises);
}
```

## 🔗 相关链接

- [API Integration Guide](API_INTEGRATION.md)
- [Monitoring API Guide](MONITORING_API_GUIDE.md)
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md)
- [Quick Start](QUICK_START.md)

## 📝 更新日志

### 2024-12
- ✅ 创建灯光管理器 (`ue-light-manager.js`)
- ✅ 添加API Manager灯光方法
- ✅ 实现前端灯光控制UI
- ✅ 添加灯光事件监听
- ✅ 创建测试工具
- ✅ 编写完整文档

---

**最后更新:** 2024-12
**维护者:** CM-ZSB Team
