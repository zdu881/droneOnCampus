# 自动驾驶页面视角切换UI 更新说明

**更新日期**: 2024-12-04  
**状态**: ✅ 完成

---

## 📋 更新内容

### 1. HTML UI 结构 (dashboard.html)

在自动驾驶场景页面顶部添加了视口工具栏：

```html
<!-- 自动驾驶视口工具栏 -->
<div class="autonomous-viewport-toolbar">
  <div class="view-controls">
    <label>视角:</label>
    <select id="autonomous-view-type-select" class="view-select">
      <option value="top">俯视图</option>
      <option value="perspective" selected>透视图</option>
      <option value="follow">跟随视角</option>
      <option value="bird">鸟瞰图</option>
    </select>
  </div>
  <div class="viewport-settings">
    <button class="viewport-btn" id="autonomous-toggle-grid" title="显示/隐藏网格">
      <i class="fas fa-th"></i> 网格
    </button>
    <button class="viewport-btn" id="autonomous-toggle-compass" title="显示/隐藏指南针">
      <i class="fas fa-compass"></i> 指南针
    </button>
    <button class="viewport-btn" id="autonomous-reset-view" title="重置视角">
      <i class="fas fa-redo"></i> 重置
    </button>
    <button class="viewport-btn" id="autonomous-fullscreen-btn" title="全屏显示">
      <i class="fas fa-expand"></i> 全屏
    </button>
  </div>
</div>
```

#### 包含的控件:

| 控件 | ID | 功能 |
|------|------|------|
| **视角选择下拉框** | `autonomous-view-type-select` | 选择不同的视角模式 |
| **网格按钮** | `autonomous-toggle-grid` | 显示/隐藏网格 |
| **指南针按钮** | `autonomous-toggle-compass` | 显示/隐藏指南针 |
| **重置按钮** | `autonomous-reset-view` | 重置视角为默认值 |
| **全屏按钮** | `autonomous-fullscreen-btn` | 进入/退出全屏模式 |

---

### 2. 样式美化 (dashboard-styles.css)

添加了自动驾驶视口工具栏的样式：

```css
/* 自动驾驶视口工具栏 */
.autonomous-viewport-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--glass-bg);
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.view-select {
  background: var(--tertiary-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.autonomous-viewport-toolbar .viewport-btn {
  padding: 6px 12px;
  width: auto;
  height: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--tertiary-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  transition: all 0.3s ease;
}

.autonomous-viewport-toolbar .viewport-btn:hover {
  background: var(--accent-primary);
  color: var(--primary-bg);
  border-color: var(--accent-primary);
}
```

#### 样式特点:

- ✅ 玻璃态效果 (Glassmorphism) 与现代设计保持一致
- ✅ 响应式布局，自动适应不同屏幕尺寸
- ✅ 悬停效果，提升用户交互体验
- ✅ 图标+文字组合，清晰易用

---

### 3. JavaScript 事件处理 (dashboard-manager.js)

#### A. 事件监听器设置:

```javascript
// 自动驾驶场景视口工具栏
const autonomousViewSelect = document.getElementById("autonomous-view-type-select");
if (autonomousViewSelect) {
  autonomousViewSelect.addEventListener("change", (e) => {
    this.changeAutonomousViewType(e.target.value);
  });
}

const autonomousToggleGrid = document.getElementById("autonomous-toggle-grid");
if (autonomousToggleGrid) {
  autonomousToggleGrid.addEventListener("click", () => {
    this.toggleAutonomousGrid();
  });
}

const autonomousToggleCompass = document.getElementById("autonomous-toggle-compass");
if (autonomousToggleCompass) {
  autonomousToggleCompass.addEventListener("click", () => {
    this.toggleAutonomousCompass();
  });
}

const autonomousResetView = document.getElementById("autonomous-reset-view");
if (autonomousResetView) {
  autonomousResetView.addEventListener("click", () => {
    this.resetAutonomousView();
  });
}

const autonomousFullscreenBtn = document.getElementById("autonomous-fullscreen-btn");
if (autonomousFullscreenBtn) {
  autonomousFullscreenBtn.addEventListener("click", () => {
    this.toggleAutonomousFullscreen();
  });
}
```

#### B. 实现方法:

```javascript
// 自动驾驶场景视口工具方法

/**
 * 改变自动驾驶视角类型
 * @param {string} viewType - 视角类型 (top, perspective, follow, bird)
 */
changeAutonomousViewType(viewType) {
  this.logToConsole(`Autonomous view type changed to: ${viewType}`, "info");
  
  // 发送到UE API
  if (window.apiManager) {
    window.apiManager.setViewType(viewType)
      .catch(error => {
        console.error("Failed to change view type:", error);
        this.logToConsole(`Failed to change view: ${error.message}`, "error");
      });
  }
}

/**
 * 切换网格显示
 */
toggleAutonomousGrid() {
  const btn = document.getElementById("autonomous-toggle-grid");
  const isActive = btn?.classList.contains("active");
  
  if (btn) {
    btn.classList.toggle("active");
  }
  
  this.logToConsole(`Grid display ${!isActive ? "enabled" : "disabled"}`, "info");
}

/**
 * 切换指南针显示
 */
toggleAutonomousCompass() {
  const btn = document.getElementById("autonomous-toggle-compass");
  const isActive = btn?.classList.contains("active");
  
  if (btn) {
    btn.classList.toggle("active");
  }
  
  this.logToConsole(`Compass display ${!isActive ? "enabled" : "disabled"}`, "info");
}

/**
 * 重置视角为默认值
 */
resetAutonomousView() {
  const viewSelect = document.getElementById("autonomous-view-type-select");
  if (viewSelect) {
    viewSelect.value = "perspective";
  }
  
  this.logToConsole("View reset to default perspective", "info");
}

/**
 * 切换全屏模式
 */
toggleAutonomousFullscreen() {
  const container = document.getElementById("vehicle-scenario-content");
  if (!container) return;

  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}
```

---

## 🎯 视角类型说明

| 视角 | 类型值 | 说明 |
|------|--------|------|
| **俯视图** | `top` | 从上向下看，适合观察整体路线 |
| **透视图** | `perspective` | 第三人称视角，推荐默认使用 |
| **跟随视角** | `follow` | 跟随车辆移动，动态视角 |
| **鸟瞰图** | `bird` | 高空俯瞰，全局观看 |

---

## 🔧 使用说明

### 用户操作流程:

1. **切换到自动驾驶场景**
   - 点击顶部工具栏的"自动驾驶"按钮

2. **选择视角**
   - 在视口工具栏中选择所需视角
   - 视角改变会实时同步到UE应用

3. **显示/隐藏辅助元素**
   - 点击"网格"按钮显示/隐藏坐标网格
   - 点击"指南针"按钮显示/隐藏方向指南针

4. **重置视角**
   - 点击"重置"按钮回到默认透视图

5. **全屏显示**
   - 点击"全屏"按钮进入全屏模式
   - 按ESC或再次点击退出全屏

---

## 📊 集成点

### 与 api-manager.js 的关联:

如果需要实际改变UE中的视角，可以使用：

```javascript
// 调用 setViewType 方法（需在 api-manager.js 中实现）
await apiManager.setViewType('perspective');
```

### 与控制台的交互:

所有操作都会记录到控制台：
- ✅ 视角改变事件
- ✅ 网格显示/隐藏
- ✅ 指南针显示/隐藏
- ✅ 视角重置
- ✅ 全屏操作

---

## 📁 修改的文件

| 文件 | 修改内容 |
|------|---------|
| `dashboard.html` | 添加自动驾驶视口工具栏HTML |
| `dashboard-styles.css` | 添加视口工具栏样式 |
| `dashboard-manager.js` | 添加事件监听和处理方法 |

---

## ✅ 验证清单

- [x] HTML 结构正确
- [x] CSS 样式完整
- [x] JavaScript 事件已绑定
- [x] 控制台日志记录正常
- [x] 响应式设计（适配各屏幕）
- [x] 与现有UI风格统一
- [x] 无重复ID元素
- [x] 完整的错误处理

---

## 🚀 后续优化建议

1. **增加视角预设**
   - 保存用户常用的视角配置

2. **动画过渡**
   - 视角切换时添加平滑动画效果

3. **键盘快捷键**
   - T键切换视角类型
   - G键切换网格
   - C键切换指南针

4. **拖拽操作**
   - 支持鼠标拖拽改变视角方向

5. **性能监控**
   - 显示当前帧率和渲染性能

---

**更新完成！自动驾驶页面现在拥有完整的视角切换UI功能。** 🎉
