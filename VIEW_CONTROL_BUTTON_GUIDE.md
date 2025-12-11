# 仪表板切换视角按钮 - 完整定位指南

## 📍 按钮位置信息

### 位置 1：主视角控制卡片（推荐使用）
**文件**: `dashboard.html`  
**行号**: 310-312  
**卡片名**: 视角控制卡片 (View Control Card)

```html
<button class="view-btn" id="view-change-btn" title="切换视角">
  <i class="fas fa-sync-alt"></i>
  <span>切换视角</span>
</button>
```

**位置描述**：
- 在仪表板控制面板中找到"视角控制"卡片（标题前面有摄像头图标 🎥）
- 按钮显示为"切换视角"，带有旋转箭头图标 🔄
- 这是第一个按钮，位于视角控制卡片的左上方

**相邻按钮**（同一卡片中）：
- 右侧：俯视图按钮 (id="view-top-btn")
- 再右：跟随视角按钮 (id="view-follow-btn")
- 最右：FPV 按钮 (id="view-fpv-btn")

### 位置 2：自动驾驶面板
**文件**: `dashboard.html`  
**行号**: 842-843  
**卡片名**: 自动驾驶控制

```html
<button class="view-change-btn" id="autonomous-change-view" title="循环切换视角">
  <i class="fas fa-camera"></i> 视角
</button>
```

---

## ⚙️ 对应代码分析

### 1. HTML 按钮定义 ✅

| 属性 | 值 |
|------|-----|
| **ID** | `view-change-btn` |
| **类名** | `view-btn` |
| **标题** | 切换视角 |
| **图标** | `fa-sync-alt` (旋转箭头) |
| **文件** | dashboard.html, line 310 |

### 2. JavaScript 事件绑定 ✅

**文件**: `dashboard-manager.js`  
**行号**: 1875-1877  
**类**: `DashboardManager`  
**方法**: `initDroneControlPage()`

```javascript
const viewChangeBtn = document.getElementById('view-change-btn');
if (viewChangeBtn) {
  viewChangeBtn.addEventListener('click', () => this.changeView());
}
```

**验证**:
- ✅ 正确获取了 HTML 元素（ID 匹配）
- ✅ 添加了点击事件监听
- ✅ 调用了 `changeView()` 方法

### 3. changeView() 方法实现 ✅

**文件**: `dashboard-manager.js`  
**行号**: 1904-1932  
**类**: `DashboardManager`

```javascript
async changeView() {
  try {
    if (window.ueApiManager) {
      // 诊断：记录对象路径信息
      console.warn('尝试调用 changeView()');
      console.log('当前使用的 levelScriptActorPath:', 
                   window.ueApiManager.levelScriptActorPath);
      
      const result = await window.ueApiManager.changeView();
      if (result && result.success) {
        this.logToConsole('视角已切换', 'success');
      } else if (result && result.error) {
        // 错误处理...
        if (result.error.includes('does not exist')) {
          this.logToConsole('⚠️ 错误：对象路径不存在...', 'warning');
        }
      }
    } else {
      this.logToConsole('视角切换 (模拟)', 'info');
    }
  } catch (error) {
    this.logToConsole(`视角切换失败: ${error.message}`, 'error');
    console.error('视角切换异常:', error);
  }
}
```

**功能**:
- ✅ 异步方法（async）
- ✅ 检查 UE API 管理器是否存在
- ✅ 记录对象路径（用于调试）
- ✅ 调用 UE API 的 `changeView()` 方法
- ✅ 错误处理和用户反馈
- ✅ 在仪表板控制台显示结果

### 4. API 层实现 ✅

**文件**: `api-manager.js`  
**行号**: 100-103  
**类**: `UnrealEngineAPIManager`

```javascript
// 改变摄像头视角 (对应 changeview.py)
async changeView() {
  return await this.sendRequest(
    this.levelScriptActorPath, 
    "ChangeView", 
    {}
  );
}
```

**实现细节**:
- ✅ 调用 `sendRequest()` 发送 HTTP 请求
- ✅ 使用 `levelScriptActorPath`（关卡蓝图路径）
- ✅ 调用 UE 函数 `ChangeView`
- ✅ 参数为空对象 `{}`

### 5. 对象路径配置 ✅

**文件**: `api-manager.js`  
**行号**: 13-14  
**类**: `UnrealEngineAPIManager`  
**构造函数**: `constructor()`

```javascript
// 关卡蓝图路径（打包后）- 更新为 NewMap_C_2（UE v1.2 正确版本）
this.levelScriptActorPath = "/Game/NewMap.NewMap:PersistentLevel.NewMap_C_2";
```

**对象路径说明**:
- ✅ **地址**: `/Game/NewMap.NewMap:PersistentLevel.NewMap_C_2`
- ✅ **类型**: 关卡蓝图（Level Script）
- ✅ **函数**: `ChangeView` 存在并可调用
- ✅ **版本**: UE v1.2 （从 v1.1 升级修正）

### 6. HTTP 请求细节

**URL**: `http://10.30.2.11:30010/remote/object/call`  
**方法**: `PUT`  
**请求体**:
```json
{
  "objectPath": "/Game/NewMap.NewMap:PersistentLevel.NewMap_C_2",
  "functionName": "ChangeView",
  "parameters": {}
}
```

**预期响应**:
```json
{}
```

HTTP 状态码: 200 (成功)

---

## 🔍 代码正确性检查表

| 项目 | 检查 | 结果 | 备注 |
|------|------|------|------|
| HTML 按钮存在 | ID="view-change-btn" 存在 | ✅ | 第 310 行 |
| 事件绑定 | addEventListener 正确 | ✅ | 第 1876 行 |
| 回调函数 | changeView() 实现 | ✅ | 第 1904 行 |
| API 实现 | sendRequest() 调用 | ✅ | api-manager.js 102 行 |
| 对象路径 | NewMap_C_2 存在 | ✅ | API 已验证 |
| HTTP 方法 | 使用 PUT | ✅ | 规范方法 |
| 错误处理 | 有错误处理和日志 | ✅ | 详细的诊断信息 |
| 用户反馈 | logToConsole 反馈 | ✅ | 仪表板显示结果 |

---

## 🧪 测试步骤

### 1. 在浏览器中

1. 打开 `http://10.30.2.11:8080`
2. 在仪表板中找到"视角控制"卡片（左侧控制面板）
3. 点击第一个按钮"切换视角"（带旋转图标）

### 2. 观察结果

- **仪表板控制台**: 应显示"视角已切换" (绿色消息)
- **浏览器控制台** (F12): 应看到：
  ```
  尝试调用 changeView()
  当前使用的 levelScriptActorPath: /Game/NewMap.NewMap:PersistentLevel.NewMap_C_2
  ```
- **UE 程序**: 摄像头视角应发生改变

### 3. 验证 API 调用 (curl)

```bash
curl -s -X PUT http://10.30.2.11:30010/remote/object/call \
  -H "Content-Type: application/json" \
  -d '{"objectPath":"/Game/NewMap.NewMap:PersistentLevel.NewMap_C_2","functionName":"ChangeView","parameters":{}}'

# 预期输出: {} (HTTP 200)
```

---

## 🐛 常见问题

### 按钮不响应

1. **检查**: `view-change-btn` 是否在 HTML 中存在 → ✅ 第 310 行
2. **检查**: `initDroneControlPage()` 是否被调用 → 在浏览器控制台搜索
3. **检查**: `window.ueApiManager` 是否已初始化 → F12 控制台输入 `window.ueApiManager`

### 对象路径错误

- ❌ 旧配置: `NewMap_C_3` (已过时)
- ✅ 新配置: `NewMap_C_2` (已修正)

### 视角未改变

- 检查 UE 程序是否运行：`netstat -tuln | grep 30010`
- 检查 Remote Control API 是否启用：`-RCWebControlEnable` 参数
- 查看 UE 程序的启动日志

---

## 📋 文件交叉引用

| 文件 | 行号 | 内容 | 状态 |
|-----|------|------|------|
| dashboard.html | 303-330 | 视角控制卡片 HTML | ✅ 正确 |
| dashboard-manager.js | 1870-1932 | 事件绑定和方法实现 | ✅ 正确 |
| api-manager.js | 13-14, 100-103 | 对象路径和 API 实现 | ✅ 正确 |

---

## 📞 快速排查流程

```
按钮点击
  ↓
检查 HTML 元素存在？ (dashboard.html:310)
  ↓
检查事件监听注册？ (dashboard-manager.js:1876)
  ↓
检查 changeView() 执行？ (F12 控制台)
  ↓
检查 ueApiManager 初始化？ (F12 输入 window.ueApiManager)
  ↓
检查 API 路径正确？ (curl 测试)
  ↓
检查 UE 程序运行？ (netstat 30010)
  ↓
成功！视角已切换 ✅
```
