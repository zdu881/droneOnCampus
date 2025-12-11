# 自动驾驶视角切换UI - 快速参考

## 🎮 控件元素

| 元素 | ID | 类型 | 功能 |
|------|------|------|------|
| 视角选择 | `autonomous-view-type-select` | 下拉框 | 选择4种视角模式 |
| 网格切换 | `autonomous-toggle-grid` | 按钮 | 显示/隐藏网格 |
| 指南针切换 | `autonomous-toggle-compass` | 按钮 | 显示/隐藏指南针 |
| 重置视角 | `autonomous-reset-view` | 按钮 | 恢复默认透视图 |
| 全屏按钮 | `autonomous-fullscreen-btn` | 按钮 | 进入/退出全屏 |

## 📍 视角选项

```
俯视图 (top)
  └─ 从上往下查看整个场景
  
透视图 (perspective) ⭐ 默认
  └─ 第三人称角度，最常用
  
跟随视角 (follow)
  └─ 动态跟随车辆移动
  
鸟瞰图 (bird)
  └─ 高空俯瞰全局视角
```

## 🛠️ JavaScript 方法

```javascript
// 视角切换
changeAutonomousViewType(viewType)
  └─ 参数: 'top' | 'perspective' | 'follow' | 'bird'

// 网格显示切换
toggleAutonomousGrid()
  └─ 切换 .active 类

// 指南针显示切换  
toggleAutonomousCompass()
  └─ 切换 .active 类

// 重置为默认视角
resetAutonomousView()
  └─ 恢复为 'perspective'

// 全屏模式
toggleAutonomousFullscreen()
  └─ 调用 Fullscreen API
```

## 🎨 CSS 类名

```css
.autonomous-viewport-toolbar    /* 工具栏容器 */
.view-controls                  /* 视角控制区 */
.view-select                    /* 下拉框样式 */
.viewport-settings              /* 按钮组区域 */
.viewport-btn                   /* 按钮通用样式 */
.viewport-btn:hover             /* 按钮悬停效果 */
```

## 📝 使用示例

### HTML 属性

```html
<select id="autonomous-view-type-select" class="view-select">
  <option value="top">俯视图</option>
  <option value="perspective" selected>透视图</option>
  <option value="follow">跟随视角</option>
  <option value="bird">鸟瞰图</option>
</select>

<button id="autonomous-toggle-grid" class="viewport-btn">
  <i class="fas fa-th"></i> 网格
</button>
```

### JavaScript 调用

```javascript
// 在浏览器控制台中调用
dashboardManager.changeAutonomousViewType('top');
dashboardManager.toggleAutonomousGrid();
dashboardManager.toggleAutonomousCompass();
dashboardManager.resetAutonomousView();
dashboardManager.toggleAutonomousFullscreen();
```

## 📊 事件流

```
用户交互
  ↓
HTML 事件触发 (click/change)
  ↓
JavaScript 事件处理函数
  ↓
更新 DOM 和日志
  ↓
发送 API 请求 (如果需要)
  ↓
控制台输出记录
```

## 🔌 集成点

### 与 api-manager.js 的关联

```javascript
// 如需实际改变UE中的视角
if (window.apiManager) {
  window.apiManager.setViewType(viewType)
    .catch(error => console.error(error));
}
```

### 控制台日志示例

```
✓ "Autonomous view type changed to: perspective"
✓ "Grid display enabled"
✓ "Compass display disabled"
✓ "View reset to default perspective"
```

## ⚠️ 常见问题

**Q: 视角改变后UE应用没有反应？**
A: 需要在 api-manager.js 中实现 setViewType() 方法

**Q: 全屏按钮不工作？**
A: 检查浏览器是否允许全屏，某些浏览器需要用户交互触发

**Q: 网格和指南针状态未保存？**
A: 刷新页面后状态重置，可添加 localStorage 保存用户偏好

**Q: 样式看起来不对？**
A: 确保 dashboard-styles.css 已正确加载，检查浏览器缓存

## 🚀 性能优化建议

- 避免频繁改变视角导致帧率下降
- 网格和指南针只在需要时显示
- 全屏时关闭其他不必要的 UI 元素
- 使用 RequestAnimationFrame 优化动画

## 📱 响应式设计

```css
/* 在小屏幕上自动调整 */
@media (max-width: 768px) {
  .autonomous-viewport-toolbar {
    flex-direction: column;
    gap: 8px;
  }
  
  .viewport-btn {
    padding: 4px 8px;
    font-size: 12px;
  }
}
```

## 🔐 安全性考虑

- 所有用户输入都通过选择框/按钮，无直接文本输入
- API 调用包含错误捕获
- 不执行任何动态代码

## 📈 统计

- **新增 HTML 元素**: 6 个
- **新增 CSS 规则**: 8 个
- **新增 JavaScript 方法**: 5 个
- **新增事件监听器**: 5 个
- **代码总行数**: ~170 行

---

**快速开始**: 打开自动驾驶页面，使用顶部工具栏选择视角和显示选项！
