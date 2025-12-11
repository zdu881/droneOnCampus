# 基站运维检测功能使用指南

## 功能概述

基站运维检测是droneOnCampus自动驾驶场景中的一项核心功能，用于在边缘节点上进行智能推理和异常检测。

## 工作流程

```
用户操作 → 前端UI → API请求 → 后端任务管理 → 推理执行 → 结果返回 → UI展示
```

## 快速开始

### 1. 启动系统

```bash
# 激活Ray环境
conda activate ray

# 启动后端CastRay服务
cd /data/home/sim6g/rayCode/droneOnCampus
python3 -m uvicorn services.castray.main:app --host 0.0.0.0 --port 8000

# 在新终端启动前端HTTP服务
cd /data/home/sim6g/rayCode/droneOnCampus
python3 -m http.server 8080
```

### 2. 访问系统

打开浏览器访问: http://10.30.2.11:8080/dashboard.html

### 3. 使用基站运维功能

1. **切换到自动驾驶场景**
   - 点击顶部的"自动驾驶"按钮
   - 界面会自动切换到基站运维页面

2. **选择检测节点**
   - 在右侧"选择检测节点"卡片中选择一个节点
   - 支持多个边缘节点（M1、M2、M3等）

3. **启动检测**
   - 点击"开始检测"按钮：自动模式，处理实时数据
   - 点击"案例检测"按钮：示例模式，处理样本数据

4. **查看进度**
   - 检测期间显示实时进度条
   - 显示当前检测步骤和进度百分比

5. **查看结果**
   - 检测完成后自动显示结果卡片
   - 展示：总样本数、高置信度样本、低置信度样本、推理耗时

6. **重新检测**
   - 点击"重新检测"按钮重置UI
   - 可进行新的检测任务

## API文档

### 启动检测任务

**请求**
```
POST /api/station-maintenance/detect
Content-Type: application/json

{
  "node_id": "node-1",
  "mode": "example",  # 'auto' 或 'example'
  "data_source": "example"  # 'realtime' 或 'example'
}
```

**响应**
```json
{
  "task_id": "372e474c",
  "status": "started",
  "message": "检测任务已启动"
}
```

### 查询任务状态

**请求**
```
GET /api/station-maintenance/status/{task_id}
```

**响应**
```json
{
  "task_id": "372e474c",
  "node_id": "node-1",
  "mode": "example",
  "status": "completed",
  "progress": 100,
  "message": "检测完成",
  "completed": true,
  "results": {
    "total_samples": 50,
    "high_confidence": 42,
    "low_confidence": 8,
    "confidence_threshold": 0.9,
    "inference_time": 2350,
    "node_id": "node-1",
    "detection_mode": "example",
    "timestamp": "2025-12-04T11:22:56.324148"
  }
}
```

## 结果解读

| 字段 | 含义 | 说明 |
|------|------|------|
| total_samples | 总样本数 | 检测处理的总样本数 |
| high_confidence | 高置信度样本 | 置信度≥0.9的样本，可直接判定 |
| low_confidence | 低置信度样本 | 置信度<0.9的样本，需服务器二次判定 |
| confidence_threshold | 置信度阈值 | 用于区分高低置信度的阈值 |
| inference_time | 推理耗时 | 完整推理过程耗时（毫秒） |

## 测试脚本

运行自动化测试：

```bash
cd /data/home/sim6g/rayCode/droneOnCampus
bash test_station_maintenance.sh
```

测试脚本会：
1. 启动一个检测任务
2. 立即查询任务状态（观察进行中的状态）
3. 等待5秒后查询最终结果
4. 验证结果正确性

## 后端实现细节

### 检测流程

1. **初始化阶段** (10% 进度)
   - 初始化CM-ZSB服务
   - 耗时约0.5秒

2. **数据加载阶段** (25% 进度)
   - 加载指定节点的数据
   - 耗时约1秒

3. **推理分析阶段** (60% 进度)
   - 运行LightGBM推理
   - 计算置信度
   - 耗时约1.5秒

4. **结果生成阶段** (90-100% 进度)
   - 整理推理结果
   - 生成最终报告
   - 耗时约1.5秒

总耗时约4-5秒（模拟实现）

### 任务存储

所有任务状态存储在内存中（`detection_tasks` 字典）：
- 支持并发执行多个检测任务
- 任务ID唯一标识每个检测任务
- 完成后任务结果保留在内存中便于查询

## 前端实现细节

### 自动驾驶场景切换

```javascript
// 通过 switchScenario() 方法切换
dashboard.switchScenario('vehicle')  // 切换到自动驾驶
dashboard.switchScenario('drone')    // 切换回无人机
```

### 节点动态加载

```javascript
// setupDetectionUI() 从Ray集群或配置加载节点列表
const nodes = [
  { id: 'node-1', name: '边缘节点 M1', ip: '10.30.2.11' },
  { id: 'node-2', name: '边缘节点 M2', ip: '10.30.2.12' }
];
```

### 状态轮询

```javascript
// pollDetectionStatus() 每1秒查询一次任务状态
// 直到任务完成或超时（120秒）
setInterval(() => {
  fetch(`/api/station-maintenance/status/${taskId}`)
}, 1000);
```

## 常见问题

### Q1: 如何使用真实数据进行检测？

A: 在启动任务时指定 `mode: 'auto'` 和 `data_source: 'realtime'`，系统将使用实时数据源（需要配置数据连接）。

### Q2: 如何扩展为多节点并行检测？

A: 可在UI中选择多个节点，并对每个节点并行启动检测任务，前端会同时轮询多个 task_id。

### Q3: 如何集成真实的CM-ZSB推理服务？

A: 修改 `_run_detection_task()` 中的推理部分，调用实际的CM-ZSB推理管道而不是模拟数据。

### Q4: 结果如何持久化？

A: 当前结果存储在内存中，需要持久化可改为写入数据库或文件系统。

## 完成清单

- ✅ 后端API实现
  - ✅ POST /api/station-maintenance/detect
  - ✅ GET /api/station-maintenance/status/{task_id}
  - ✅ 异步任务管理
  - ✅ 进度追踪

- ✅ 前端UI实现
  - ✅ 自动驾驶场景页面
  - ✅ 基站运维卡片
  - ✅ 节点选择器
  - ✅ 进度显示
  - ✅ 结果展示

- ✅ 功能验证
  - ✅ API测试
  - ✅ 前后端集成
  - ✅ 任务流程测试

## 下一步改进

1. **真实推理集成** - 接入CM-ZSB实际推理管道
2. **数据库存储** - 使用数据库持久化任务结果
3. **多节点并行** - 支持同时对多个节点进行检测
4. **结果导出** - 支持下载检测结果为CSV/JSON
5. **告警机制** - 低置信度样本数过多时触发告警
6. **可视化报表** - 生成详细的检测报告图表

