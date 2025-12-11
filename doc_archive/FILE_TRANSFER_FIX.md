# 文件传输完成状态更新问题修复

## 问题描述
文件传输完成后，任务不会从"传输中"(in-progress)状态转到"已完成"(completed)状态。

## 根本原因
1. 发送端在发送完所有文件块后，没有更新传输状态为"completed"
2. 接收端发送传输完成消息后，发送端没有正确处理该消息
3. 统计数据可能被重复计数或不正确更新

## 修复内容

### 1. 文件: `services/castray/ray_casting.py`

#### 修改1: `_start_sending_chunks` 方法 (第501-534行)
**问题**: 发送完所有块后只记录日志，没有更新状态
**修复**: 
- 发送完所有块后，更新传输状态为"completed"
- 添加结束时间戳
- 调用`mark_transfer_success`更新统计
- 记录完成日志

```python
# 发送完所有块后，更新传输状态为已完成
transfer["status"] = "completed"
transfer["end_time"] = time.time()

# 标记传输成功并更新统计
receiver_id = transfer.get("recipients", ["unknown"])[0]
self.file_transfer_manager.mark_transfer_success(file_id, [receiver_id])
```

#### 修改2: `handle_file_message` - 处理 file_transfer_complete 消息 (第486-513行)
**问题**: 收到完成消息后只记录日志，没有更新发送端的传输状态
**修复**:
- 正确解析完成消息中的file_id、receiver_id和success状态
- 更新传输的completed_by或failed_by列表
- 检查是否所有接收者都已完成
- 相应更新传输状态为"completed"或"partially_completed"

```python
# 更新发送者端的传输状态
transfer = self.file_transfer_manager.get_transfer_status(file_id)
if transfer:
    if success:
        if receiver_id not in transfer.get("completed_by", []):
            transfer["completed_by"].append(receiver_id)
        
        # 检查是否所有接收者都已完成
        if completed_count >= total_recipients:
            transfer["status"] = "completed"
```

#### 修改3: `handle_file_message` - 存储文件信息 (第450-462行)
**问题**: 接收端在处理完成时无法获取原始文件信息
**修复**:
- 接收传输请求时，存储文件信息到`pending_file_info`字典
- 接收完所有块后，使用存储的文件信息而不是临时信息
- 完成后清理`pending_file_info`

#### 修改4: `__init__` 方法 (第185-201行)
**修复**: 初始化`pending_file_info`字典

#### 修改5: `get_status` 方法 (第574-618行)
**问题**: 返回的状态信息不够详细，无法区分不同状态的传输
**修复**:
- 将所有传输分类为active、completed和failed
- 为每个传输返回详细信息（包括completed_by、failed_by等）
- 返回各类传输的计数

### 2. 文件: `services/castray/file_transfer.py`

#### 修改1: `mark_transfer_success` 方法 (第381-410行)
**问题**: 可能重复计数成功的传输
**修复**:
- 只添加尚未标记为完成的接收者（避免重复计数）
- 检查所有接收者是否都已完成
- 只为新完成的接收者增加统计计数
- 添加详细的日志记录

```python
# 只添加尚未标记的接收者
newly_completed = [r for r in successful_recipients if r not in transfer["completed_by"]]
transfer["completed_by"].extend(newly_completed)

# 检查是否所有接收者都完成了
if len(transfer["completed_by"]) >= len(transfer["recipients"]):
    transfer["status"] = "completed"
```

#### 修改2: `get_transfer_status` 方法 (第348-364行)
**问题**: 返回的状态信息不够丰富
**修复**:
- 返回total_recipients、completed_count、failed_count
- 计算并返回progress_percent
- 返回增强的状态信息副本

## 测试验证

### 手动测试步骤:
1. 启动CastRay服务
2. 创建两个演示节点
3. 发起文件传输: `POST /api/file-transfers/manual`
4. 查询传输状态: `GET /api/file-transfers/status`
5. 验证状态从"in-progress"变为"completed"

### 预期结果:
- 传输状态正确从"initiated" -> "in-progress" -> "completed"
- completed_transfers列表包含已完成的传输
- active_transfers列表不再包含已完成的传输
- 统计数据正确累加（不重复计数）

## 影响范围
- 后端: 文件传输状态管理逻辑
- API: `/api/file-transfers/status` 返回更详细的状态信息
- 前端: 可以正确显示已完成的传输任务

## 注意事项
1. 此修复不会破坏现有的传输功能
2. 向后兼容：API响应结构增强但不破坏现有字段
3. 多接收者场景也能正确处理（部分完成/全部完成）

## 后续建议
1. 添加单元测试覆盖传输状态转换逻辑
2. 考虑添加传输超时机制
3. 考虑将已完成的传输从active_transfers移到历史记录
4. 添加传输进度实时更新（WebSocket推送）
