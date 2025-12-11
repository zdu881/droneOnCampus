# 统一面板系统设计文档

## 概述

新的统一面板系统将所有功能面板整合到一个可切换的控制面板中，彻底解决了面板重叠问题，提供了更清晰和一致的用户界面。

## 系统架构

### 1. 设计理念

- **单一面板容器**: 所有功能面板都在同一个容器中显示
- **下拉选择切换**: 通过下拉菜单选择要显示的功能面板
- **场景感知**: 根据当前场景（无人机/车辆）自动过滤可用面板
- **响应式设计**: 适配不同屏幕尺寸

### 2. 布局结构

```
+------------------------------------------------+
|           [Scenario Selector - Top]           |
+------------------------------------------------+
|                                                |
|                Video Container                 |
|                                                |
|                              +----------------+
|                              | Panel Selector |
|                              +----------------+
|                              |                |
|                              | Panel Content  |
|                              |   (Dynamic)    |
|                              |                |
|                              +----------------+
+------------------------------------------------+
|              [Control Panel - Bottom]         |
+------------------------------------------------+
```

### 3. 核心组件

#### 3.1 统一控制面板容器 (.unified-control-panel)

- **位置**: 右侧固定位置
- **尺寸**: 380px × (视口高度 - 120px)
- **特性**: 半透明背景、毛玻璃效果、响应式
- **层级**: z-index: 20

#### 3.2 面板选择器 (.panel-selector)

- **功能**: 下拉菜单选择要显示的面板
- **场景感知**: 根据当前场景过滤选项
- **样式**: 现代化下拉选择器设计

#### 3.3 面板内容区域 (.panel-content)

- **功能**: 动态显示选中的面板内容
- **特性**: 滚动支持、动画过渡
- **高度**: 自适应，最大 calc(100vh - 220px)

## 面板映射

### 4. 无人机场景面板

| 面板 ID                 | 显示名称   | 内容 ID                         | 功能描述                     |
| ----------------------- | ---------- | ------------------------------- | ---------------------------- |
| network-kpi             | 网络 KPI   | network-kpi-content             | 带宽、延迟、丢包率等网络指标 |
| signal-quality          | 信号质量   | signal-quality-content          | 位置、信号强度、连接质量     |
| camera-presets          | 摄像头预设 | camera-presets-content          | 摄像头视角控制按钮           |
| station-management      | 站点管理   | station-management-content      | 活跃站点、配送统计           |
| base-station-management | 基站管理   | base-station-management-content | 基站设备添加、监控、状态管理 |
| task-control            | 任务控制   | task-control-content            | 当前任务、进度显示           |

### 5. 车辆场景面板

| 面板 ID         | 显示名称     | 内容 ID                 | 功能描述                    |
| --------------- | ------------ | ----------------------- | --------------------------- |
| mec-servers     | MEC 服务器   | mec-servers-content     | 多区域 MEC 服务器状态和连接 |
| vehicle-control | 车辆控制     | vehicle-control-content | 位置、速度、路线控制        |
| network-slice   | 网络切片控制 | network-slice-content   | 5QI 配置、QoS 优化按钮      |
| agent-decision  | Agent 决策   | agent-decision-content  | AI 决策引擎状态和日志       |

## JavaScript 架构

### 6. UnifiedPanelManager 类

#### 6.1 核心属性

```javascript
{
  currentPanel: "network-kpi",      // 当前显示的面板
  currentScenario: "drone",         // 当前场景
  panelMapping: {...},              // 面板ID到内容ID的映射
  scenarioPanels: {...}             // 场景到面板列表的映射
}
```

#### 6.2 核心方法

- `init()`: 初始化事件监听和默认状态
- `switchScenario(scenario)`: 切换场景并更新可用面板
- `switchPanel(panelId)`: 切换到指定面板
- `showPanel(panelId)`: 显示面板内容（内部方法）
- `updatePanelOptions()`: 更新下拉选择器选项
- `showSpecificPanel(panelId)`: 程序化切换面板（API）

### 7. 场景切换逻辑

#### 7.1 场景感知过滤

```javascript
// 根据当前场景隐藏不相关的选项
body.drone-scenario .vehicle-panel { display: none !important; }
body.vehicle-scenario .drone-panel { display: none !important; }
```

#### 7.2 默认面板切换

- 切换到无人机场景 → 自动显示"网络 KPI"面板
- 切换到车辆场景 → 自动显示"MEC 服务器"面板

## CSS 设计

### 8. 关键样式类

#### 8.1 容器样式

```css
.unified-control-panel {
  position: absolute;
  top: 70px;
  right: 20px;
  width: 380px;
  backdrop-filter: blur(12px);
  z-index: 20;
}
```

#### 8.2 面板切换动画

```css
.panel-item.active {
  animation: fadeIn 0.3s ease-in-out;
}
```

#### 8.3 响应式断点

- 1200px 以下: 面板宽度缩小到 350px
- 768px 以下: 面板变为全宽，相对定位

## 优势

### 9. 解决的问题

1. **完全消除重叠**: 只有一个面板容器，不可能重叠
2. **清晰的组织**: 所有功能都在统一的界面中
3. **更好的空间利用**: 不再需要预留多个面板区域
4. **一致的用户体验**: 统一的交互模式

### 10. 用户体验改进

- **直观的导航**: 下拉菜单清晰显示所有可用功能
- **上下文感知**: 只显示当前场景相关的面板
- **平滑过渡**: 面板切换有动画效果
- **响应式设计**: 在所有设备上都有良好的体验

## 扩展性

### 11. 添加新面板

1. 在 HTML 中添加面板内容 div
2. 在下拉选择器中添加 option
3. 在 UnifiedPanelManager 中更新映射关系
4. 添加必要的 CSS 样式

### 12. 集成指南

其他模块可以通过以下方式与统一面板系统交互：

```javascript
// 切换到特定面板
window.unifiedPanelManager.showSpecificPanel("network-kpi");

// 获取当前状态
const currentPanel = window.unifiedPanelManager.getCurrentPanel();
const currentScenario = window.unifiedPanelManager.getCurrentScenario();
```

## 测试验证

### 13. 测试要点

1. 场景切换正确过滤面板选项
2. 面板内容正确显示和隐藏
3. 响应式布局在不同屏幕尺寸下正常工作
4. 动画过渡流畅
5. 与现有功能模块的兼容性

### 14. 浏览器兼容性

- 现代浏览器(Chrome 60+, Firefox 55+, Safari 12+)
- 支持 CSS Grid 和 Flexbox
- 支持 backdrop-filter 属性

## 结论

统一面板系统提供了一个现代化、可维护的 UI 架构，完全解决了之前的面板重叠问题，同时提供了更好的用户体验和开发体验。系统具有良好的扩展性，便于未来添加新功能。

## 附录：基站管理功能

### A.1 基站管理面板特性

基站管理面板集成到统一面板系统中，提供完整的基站设备管理功能：

#### A.1.1 支持的基站类型

- 🔋 **充电基站**: 无人机充电和停靠点
- 📡 **通信基站**: 信号中继和数据传输
- 🌡️ **气象站**: 环境数据监测
- 🛡️ **安全基站**: 监控和报警设备

#### A.1.2 核心功能

- **基站添加**: 选择类型、设置 3D 坐标位置、自定义命名
- **状态管理**: 实时显示在线/离线/故障状态
- **批量操作**: 支持启用/停用/删除操作
- **统计面板**: 显示总基站数、在线数量、故障数量
- **API 集成**: 与后端 API 同步，支持远程基站管理

#### A.1.3 技术实现

- **控制器**: `UnifiedBaseStationManager` 类
- **数据存储**: Map 结构存储基站信息
- **UI 组件**: 响应式表单和列表显示
- **状态同步**: 与后端 API 双向同步

#### A.1.4 面板集成

- **面板 ID**: `base-station-management`
- **内容 ID**: `base-station-management-content`
- **场景归属**: 无人机场景专用
- **CSS 类**: 继承统一面板样式系统

这样，基站管理就完全集成到了统一面板系统中，用户可以通过下拉菜单轻松访问和管理所有基站设备。
