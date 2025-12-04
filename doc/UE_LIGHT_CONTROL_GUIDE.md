# UE 灯光控制 API 集成指南

## 概述

本文档说明了如何在自动驾驶场景中集成 Unreal Engine (UE) 灯光控制功能，用于实时显示基站工作状态（红/绿/黄三色信号灯）。

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│           Dashboard UI (dashboard.html)                  │
│  - 灯光控制界面                                           │
│  - 灯光状态显示                                           │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐   ┌────────▼──────────┐
│ API Manager    │   │ Dashboard Manager │
│ (api-manager)  │   │ (dashboard-manager)
│ 灯光API调用    │   │ 事件处理和逻辑    │
└────────┬────────┘   └──────────────────┘
         │
         │ HTTP PUT Request
         │
    ┌────▼──────────────────────────────────┐
    │  UE Remote Control API                 │
    │  (http://localhost:30010/remote/...)   │
    └────┬──────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────┐
    │  Unreal Engine 场景                    │
    │  - Light Objects                       │
    │  - ChangeColorAPI 函数                 │
    └────────────────────────────────────────┘
```

## 功能模块

### 1. UE Light Manager (ue-light-manager.js)

独立的灯光管理器类，提供以下功能：

**主要方法:**
- `changeLightColor(lightId, color)` - 改变灯光颜色
- `setGreen(lightId)` - 设置为绿色（正常）
- `setRed(lightId)` - 设置为红色（错误/检测中）
- `setYellow(lightId)` - 设置为黄色（警告/处理中）
- `blinkLight(lightId, color, count, interval)` - 灯光闪烁
- `lightSequence(color, interval)` - 顺序点亮灯光
- `setStatusLight(lightId, status)` - 根据状态自动设置颜色
- `testConnection()` - 测试连接
- `getStatus()` - 获取灯光状态

### 2. API Manager 扩展 (api-manager.js)

在现有 `UnrealEngineAPIManager` 类中添加以下方法：

**灯光对象路径:**
```javascript
this.lightPaths = {
  light1: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9CFA302_2066102057",
  light2: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1321381589",
  light3: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1393896590"
};
```

**新增方法:**
- `changeBaseStationLight(lightIndex, colorCode)` - 改变基站灯光
- `setBaseStationGreen(lightIndex)` - 设为绿色
- `setBaseStationRed(lightIndex)` - 设为红色
- `setBaseStationYellow(lightIndex)` - 设为黄色
- `setBaseStationStatusLight(lightIndex, status)` - 根据状态设置
- `blinkBaseStationLight(lightIndex, colorCode, count, interval)` - 灯光闪烁
- `getBaseStationLightPaths()` - 获取灯光对象路径

### 3. Dashboard Manager 扩展 (dashboard-manager.js)

在 `DashboardManager` 类中添加以下功能：

**新增方法:**
- `setupLightControlListeners()` - 初始化灯光控制事件监听
- `updateLightStatus()` - 更新灯光状态显示

**事件监听:**
- 灯光选择按钮 `.light-select-btn`
- 颜色选择按钮 `.color-btn`
- 高级操作按钮（闪烁、序列、测试）
- 快速控制按钮（全部绿/红/黄）

### 4. 前端UI (dashboard.html)

新增灯光控制界面：

**灯光控制区域：**
```html
<div class="light-control-area">
  <!-- 灯光选择 -->
  <div class="light-selector">
    <button class="light-select-btn" data-light="all">全部灯光</button>
    <button class="light-select-btn" data-light="1">灯光1</button>
    <button class="light-select-btn" data-light="2">灯光2</button>
    <button class="light-select-btn" data-light="3">灯光3</button>
  </div>

  <!-- 颜色选择 -->
  <div class="color-buttons">
    <button class="color-btn red-btn" data-color="0">红色</button>
    <button class="color-btn green-btn" data-color="1">绿色</button>
    <button class="color-btn yellow-btn" data-color="2">黄色</button>
  </div>

  <!-- 高级操作 -->
  <div class="advanced-buttons">
    <button id="light-blink-btn">闪烁</button>
    <button id="light-sequence-btn">序列点亮</button>
    <button id="light-test-btn">测试连接</button>
  </div>

  <!-- 灯光状态显示 -->
  <div class="light-status-display">
    <div class="status-item">
      <span class="status-name">灯光1:</span>
      <span class="status-color" id="light1-status">绿色</span>
    </div>
    <!-- ... -->
  </div>
</div>
```

### 5. 样式表 (dashboard-styles.css)

新增 400+ 行灯光控制相关样式：
- `.light-control-area` - 灯光控制区域样式
- `.light-selector` - 灯光选择按钮样式
- `.color-btn` - 颜色按钮样式（红/绿/黄）
- `.light-status-display` - 灯光状态显示样式
- `.light-control-card` - 独立灯光控制卡片样式
- `.light-bulb` - 灯泡指示器样式

## UE Remote Control API 规范

### 端点
```
POST http://10.30.2.11:30010/remote/object/call
```

### 请求格式
```json
{
  "objectPath": "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_xxx",
  "functionName": "ChangeColorAPI",
  "parameters": {
    "Active": 0  // 0=红, 1=绿, 2=黄
  },
  "generateTransaction": true
}
```

### 灯光对象信息

| 灯光ID | 对象路径 | 函数名 | 参数 |
|--------|--------|--------|------|
| Light 1 | `/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9CFA302_2066102057` | `ChangeColorAPI` | `Active: 0/1/2` |
| Light 2 | `/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1321381589` | `ChangeColorAPI` | `Active: 0/1/2` |
| Light 3 | `/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1393896590` | `ChangeColorAPI` | `Active: 0/1/2` |

### 颜色映射

| 颜色值 | 颜色代码 | 含义 |
|--------|---------|------|
| Red (红) | 0 | 错误/异常/检测中 |
| Green (绿) | 1 | 正常/空闲/成功 |
| Yellow (黄) | 2 | 警告/处理中/待处理 |

## 使用示例

### 基础使用

```javascript
// 改变灯光颜色
await ueApiManager.changeBaseStationLight(1, 0); // 灯光1设为红色

// 快速操作
await ueApiManager.setBaseStationGreen(0);   // 全部设为绿色
await ueApiManager.setBaseStationRed(2);     // 灯光2设为红色
await ueApiManager.setBaseStationYellow(3);  // 灯光3设为黄色

// 闪烁效果
await ueApiManager.blinkBaseStationLight(1, 0, 3, 300); // 灯光1闪烁3次

// 根据状态自动设置
await ueApiManager.setBaseStationStatusLight(1, "detecting"); // 设为黄色
```

### 与检测任务集成

```javascript
async startDetection(mode) {
  // 启动检测前，设灯光为黄色（检测中）
  await ueApiManager.setBaseStationYellow(0);

  try {
    // 执行检测任务...
    const result = await this.runDetectionTask(mode);

    // 检测成功，设灯光为绿色
    if (result.success) {
      await ueApiManager.setBaseStationGreen(0);
    }
  } catch (error) {
    // 检测失败，设灯光为红色并闪烁
    await ueApiManager.blinkBaseStationLight(0, 0, 3, 300);
  }
}
```

### 状态表示

```javascript
// 节点空闲状态
await ueApiManager.setBaseStationStatusLight(nodeId, "idle");      // 绿色

// 节点检测中
await ueApiManager.setBaseStationStatusLight(nodeId, "detecting"); // 黄色

// 节点发送数据
await ueApiManager.setBaseStationStatusLight(nodeId, "sending");   // 红色

// 节点出现错误
await ueApiManager.setBaseStationStatusLight(nodeId, "error");     // 红色+闪烁
```

## 测试工具

### test_light_control.html

完整的灯光控制测试工具，包含：

- **单个灯光控制**
  - 灯光选择（1、2、3、全部）
  - 颜色设置（红、绿、黄）
  - 高级操作（闪烁、序列、测试连接）

- **快速操作**
  - 一键全部绿色/红色/黄色
  - 连接测试

- **自定义操作**
  - 颜色循环测试
  - 全部灯光闪烁
  - 配置参数（闪烁次数、间隔）

- **控制台输出**
  - 实时日志显示
  - 成功/失败/错误提示

**访问方式:**
```
http://localhost:8080/droneOnCampus/test_light_control.html
```

## 集成检查清单

- [x] 创建 `ue-light-manager.js` - 独立灯光管理器
- [x] 更新 `api-manager.js` - 添加灯光控制方法
- [x] 更新 `dashboard.html` - 添加灯光控制UI
- [x] 更新 `dashboard-styles.css` - 添加灯光控制样式
- [x] 更新 `dashboard-manager.js` - 添加事件监听
- [x] 创建测试页面 `test_light_control.html`
- [x] 验证API调用正确性

## 故障排除

### 连接失败
**问题:** 无法连接到UE Remote Control API
**解决:**
1. 确认UE服务器运行且开放端口 30010
2. 检查防火墙设置
3. 确认URL正确：`http://localhost:30010/remote/object/call`
4. 查看浏览器控制台错误信息

### 灯光不亮
**问题:** API调用成功但灯光没有反应
**解决:**
1. 验证灯光对象路径是否正确
2. 检查UE中灯光对象是否存在
3. 确认 `ChangeColorAPI` 函数在灯光对象中实现
4. 查看UE输出日志获取更多信息

### 部分灯光无响应
**问题:** 某些灯光不工作
**解决:**
1. 检查该灯光的对象路径是否正确
2. 尝试单独控制该灯光
3. 在UE编辑器中验证对象是否存在

## 扩展建议

1. **状态同步:** 定期轮询灯光状态与UE场景同步
2. **动画效果:** 支持更复杂的灯光动画（渐变、彩虹等）
3. **数据反馈:** 灯光变化时回传确认信息
4. **录制回放:** 记录灯光状态变化过程便于分析
5. **多场景支持:** 支持不同场景的灯光配置

## 参考文件

- `api-manager.js` - 核心API管理器
- `dashboard.html` - UI界面
- `dashboard-styles.css` - 样式表
- `dashboard-manager.js` - 事件管理
- `ue-light-manager.js` - 灯光管理器
- `test_light_control.html` - 测试工具

## 版本信息

- **创建时间:** 2024-12
- **UE API 版本:** Remote Control API (HTTP)
- **支持灯光数:** 3个基站灯光
- **支持颜色:** 红、绿、黄（共3种）

## 相关文档

- API_INTEGRATION.md - API集成文档
- MONITORING_API_GUIDE.md - 监测API指南
- QUICK_START.md - 快速开始
- IMPLEMENTATION_SUMMARY.md - 实现总结
