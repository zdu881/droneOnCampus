# UE 对象路径诊断 - 切换视角功能

## 问题现象
❌ 切换视角按钮不起作用  
❌ 错误信息：`Object: /Game/NewMap.NewMap:PersistentLevel.NewMap_C_3 does not exist.`

## 根本原因
- UE v1.2 程序中，预期的对象路径 `NewMap_C_3` 不存在
- 可能原因：
  1. **版本差异**：从 v1.1 升级到 v1.2 后，蓝图对象路径可能已变更
  2. **蓝图未打包**：ChangeView 函数可能未正确打包到发布版本中
  3. **打包设置**：可能需要在 UE 编辑器中调整对象路径白名单

## 诊断步骤

### 1. 查找实际的蓝图对象路径

在 UE 编辑器中或通过 Remote Control API 列表查找：

```bash
# 尝试不同的可能路径
for path in "/Game/NewMap:NewMap_C" "/Game/NewMap:BP_NewMap_C" "/Game/Levels/NewMap:NewMap_C" "/Level:Level_C"; do
  echo "测试: $path"
  curl -s -X PUT http://10.30.2.11:30010/remote/object/call \
    -H "Content-Type: application/json" \
    -d "{\"objectPath\":\"$path\",\"functionName\":\"GetFunctionNames\",\"parameters\":{}}"
done
```

### 2. 查看 UE 程序的启动日志

```bash
# 查看 UE 程序是否报告了对象注册信息
journalctl -u ue-program -n 100  # 如果有 systemd 服务
# 或直接查看进程输出
ps aux | grep -i "Project\|NewMap" | grep -v grep
```

### 3. 检查 api-manager.js 中的路径配置

**当前配置**（第 13-14 行）:
```javascript
this.droneActorPath = "/Game/NewMap.NewMap:PersistentLevel.FbxScene_Drone_C_UAID_107C61AAC641276C02_1958446408";
this.levelScriptActorPath = "/Game/NewMap.NewMap:PersistentLevel.NewMap_C_3";
```

**可能的替代路径**：
- `/Game/NewMap:NewMap_C` (去掉 `.NewMap` 前缀)
- `/Game/NewMap:BP_NewMap_C` (如果是蓝图类)
- `/Game/Levels/NewMap:NewMap_C` (如果在 Levels 文件夹)
- `/Level:Level_C` (标准关卡蓝图)

## 临时解决方案

### 方案 A：在 UE 编辑器中重新导出对象路径

1. 在 UE 5.3 编辑器中打开项目
2. 右键点击 NewMap 关卡蓝图
3. 复制完整的蓝图引用路径
4. 更新 `api-manager.js` 第 14 行的 `levelScriptActorPath`
5. 重新打包项目

### 方案 B：模拟切换视角功能

编辑 `dashboard-manager.js` 第 1904 行的 `changeView()` 方法，添加客户端模拟：

```javascript
async changeView() {
  try {
    // 客户端模拟视角切换（因为 UE 对象路径不可用）
    this.currentViewMode = (this.currentViewMode || 0) + 1;
    if (this.currentViewMode > 3) this.currentViewMode = 0;
    
    const viewNames = ['第一人称', '第三人称', '俯视图', '跟随视角'];
    this.logToConsole(`视角切换为：${viewNames[this.currentViewMode]}`, 'success');
    
    // 同时尝试调用 UE API（如果对象可用）
    if (window.ueApiManager && window.ueApiManager.changeView) {
      try {
        await window.ueApiManager.changeView();
      } catch (e) {
        // UE API 失败，但客户端已模拟成功
        console.log('UE API 不可用，使用客户端模拟');
      }
    }
  } catch (error) {
    this.logToConsole(`视角切换失败: ${error.message}`, 'error');
  }
}
```

### 方案 C：禁用该功能并显示提示

```javascript
async changeView() {
  this.logToConsole('⚠️ 切换视角功能暂不可用（UE 对象路径未找到）', 'warning');
  console.info('需要更新 UE 程序或在 api-manager.js 中配置正确的对象路径');
}
```

## 下一步行动

1. **立即**：检查浏览器控制台查看具体的错误信息
2. **短期**：使用方案 B 或 C 作为临时修复
3. **长期**：
   - 重新检查 UE 程序版本 (v1.1 vs v1.2)
   - 获取正确的对象路径
   - 重新打包项目

## 相关文件

| 文件 | 行号 | 内容 |
|-----|------|------|
| `api-manager.js` | 14 | levelScriptActorPath 配置 |
| `dashboard-manager.js` | 1904 | changeView() 方法 |
| `dashboard.html` | 310 | 切换视角按钮 |

## 快速测试命令

```bash
# 在 curl 中尝试查找现有函数
curl -X PUT http://10.30.2.11:30010/remote/object/call \
  -H "Content-Type: application/json" \
  -d '{"objectPath":"/Game/NewMap:NewMap_C","functionName":"PrintString","parameters":{"InString":"Test"}}'
```

## 日志级别

当前已添加详细日志到 `dashboard-manager.js` 的 `changeView()` 方法，查看浏览器控制台（F12）可获得：
- ✅ 当前使用的对象路径
- ✅ 具体的错误信息
- ✅ 调试提示
