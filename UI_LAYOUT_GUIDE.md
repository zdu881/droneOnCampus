# UI 布局系统设计指南

## 概述

本文档描述了校园 5G 网络多场景控制系统的 UI 布局架构，解决了面板重叠问题并提供了清晰的区域划分。

## 布局架构

### 1. 区域划分 (Zone-Based Layout)

系统采用 4 个主要面板区域 + 1 个固定控制区域的布局：

```
+--------------------------------------------------+
|           [Scenario Selector - Fixed]           |
+--------------------------------------------------+
| [Left Zone]              |    [Right Zone]      |
| - 280px width           |    - 280px width     |
| - Network KPI (Drone)   |    - Signal (Drone)  |
| - MEC Servers (Vehicle) |    - Camera (Drone)  |
|                         |    - Slice (Vehicle) |
+-------------------------+-----------------------|
| [Bottom-Left Zone]      |   [Bottom-Right Zone]|
| - 320px width          |    - 350px width     |
| - Stations (Drone)     |    - Tasks (Drone)   |
| - Vehicle Ctrl (Vehicle)|   - Agent (Vehicle)  |
+-------------------------+-----------------------+
|              [Control Panel - Fixed]            |
|                 - Full Width                     |
|                 - Max 30vh Height               |
+--------------------------------------------------+
```

### 面板映射

#### 无人机场景(.drone-panel)

- **左上**: Network KPI Panel - 网络性能指标
- **右上**: Signal Quality Panel - 信号质量
- **右上 2**: Camera Preset Panel - 摄像头预设
- **左下**: Station Management Panel - 站点管理
- **右下**: Task Control Panel - 任务控制

#### 车辆场景(.vehicle-panel)

- **左上**: MEC Server Panel - MEC 服务器状态
- **右上**: (预留扩展)
- **左下**: Vehicle Control Panel - 车辆控制
- **右下**: Agent Decision Panel - 智能决策

### CSS 区域定义

```css
.left-panel-zone {
  top: 70px;
  left: 15px;
  width: 280px;
}
.right-panel-zone {
  top: 70px;
  right: 15px;
  width: 280px;
}
.bottom-left-zone {
  bottom: 350px;
  left: 15px;
  width: 320px;
}
.bottom-right-zone {
  bottom: 350px;
  right: 15px;
  width: 350px;
}
```

### 场景切换逻辑

```javascript
// 显示车辆场景
document.querySelectorAll(".drone-panel").forEach((panel) => {
  panel.style.display = "none";
});
document.querySelectorAll(".vehicle-panel").forEach((panel) => {
  panel.style.display = "block";
});
```

### 响应式适配

- **桌面**: 四象限布局
- **平板**: 缩小面板尺寸
- **手机**: 垂直堆叠布局

### 优势

1. **无重叠**: 四个固定区域确保面板不会重叠
2. **清晰切换**: 基于 CSS 类的场景管理
3. **可扩展**: 新面板可以轻松添加到对应区域
4. **一致性**: 统一的面板样式和行为
5. **性能**: 减少 DOM 操作，提高渲染效率

### 使用指南

#### 添加新面板

1. 在 HTML 中添加面板结构
2. 使用相应的场景类(.drone-panel 或 .vehicle-panel)
3. 放置在合适的区域容器中
4. 添加对应的 CSS 样式

#### 修改布局

- 调整区域容器的位置和尺寸
- 确保不同场景的面板不会冲突
- 测试响应式表现

这个新的布局系统完全解决了面板重叠问题，提供了清晰的界面组织结构。
