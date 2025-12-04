# CastRay服务重启指南

## 问题说明

当前8000端口运行的CastRay服务是**旧版本**（启动于11月20日），不包含文件上传功能。
新添加的 `/api/file-transfer/upload` 端点需要重启服务才能生效。

## 当前状态

```bash
# 运行中的服务（旧版本）
进程: python -m uvicorn services.castray.main:app --host 0.0.0.0 --port 8000
启动时间: 11月20日
PID: 2734078

# 可用端点（缺少upload）
/api/file-transfers/status
/api/file-transfers/manual
/api/files
# ❌ /api/file-transfer/upload  <-- 缺失
```

## 解决方案

### 方案A: 重启CastRay服务（推荐）

**步骤:**

1. **停止旧服务**
```bash
# 找到进程
ps aux | grep "castray.main" | grep -v grep

# 停止服务
kill 2734078

# 或者
pkill -f "castray.main"
```

2. **启动新服务**
```bash
cd /data/home/sim6g/rayCode/droneOnCampus
conda activate ray

# 启动服务
python -m services.castray.main

# 或者后台运行
nohup python -m services.castray.main > castray.log 2>&1 &
```

3. **验证新端点**
```bash
# 检查上传端点是否可用
curl -s http://10.30.2.11:8000/openapi.json | grep -i upload

# 测试上传
echo "test" > /tmp/test.txt
curl -X POST http://10.30.2.11:8000/api/file-transfer/upload \
  -F "file=@/tmp/test.txt" \
  -F "target_node=10.30.2.11" \
  -F "target_path=/tmp/test"
```

**预期结果:**
```json
{
  "success": true,
  "message": "文件上传成功",
  "filename": "test.txt",
  "size": 5,
  "target_node": "10.30.2.11",
  "target_path": "/tmp/test"
}
```

---

### 方案B: 使用现有API（临时方案）

如果暂时不能重启服务，可以使用现有的文件传输API：

**前端修改:**

前端不使用upload端点，而是使用 `/api/file-transfers/manual` 端点：

```javascript
// file-transfer-manager.js 中修改 uploadFile 方法

async uploadFile(file, targetNode) {
  // ... 前面代码相同 ...
  
  try {
    // 临时方案：使用手动传输API
    // 需要先将文件保存到某个节点的demo_files目录
    
    // 暂时禁用文件上传，提示用户
    this.dashboard.logToConsole(
      '文件上传功能需要重启CastRay服务才能使用，请联系管理员',
      'warning'
    );
    
    transfer.status = 'failed';
    this.transfers.active = this.transfers.active.filter(t => t.id !== transferId);
    this.transfers.failed.push(transfer);
    this.updateTabCounts();
    return;
  }
}
```

---

## 重启服务详细步骤

### 1. 准备工作

```bash
# 进入项目目录
cd /data/home/sim6g/rayCode/droneOnCampus

# 激活conda环境
conda activate ray

# 验证当前代码
grep -n "file-transfer/upload" services/castray/main.py
# 应该看到 782:@app.post("/api/file-transfer/upload")
```

### 2. 停止旧服务

```bash
# 查找进程
ps aux | grep "castray.main"

# 方法1: 使用kill（温和）
kill 2734078

# 方法2: 如果kill无效
kill -9 2734078

# 方法3: 使用pkill
pkill -f "services.castray.main"

# 验证已停止
ps aux | grep "castray.main" | grep -v grep
# 应该没有输出
```

### 3. 启动新服务

```bash
# 确保在正确目录
cd /data/home/sim6g/rayCode/droneOnCampus

# 前台启动（用于调试）
python -m services.castray.main

# 或后台启动（推荐）
nohup python -m services.castray.main > /tmp/castray_$(date +%Y%m%d).log 2>&1 &

# 查看日志
tail -f /tmp/castray_$(date +%Y%m%d).log
```

### 4. 验证服务

```bash
# 检查进程
ps aux | grep "castray.main"

# 检查端口
netstat -tulpn | grep 8000

# 测试根路径
curl http://10.30.2.11:8000/

# 检查OpenAPI文档
curl -s http://10.30.2.11:8000/openapi.json | grep -i upload
# 应该看到 "/api/file-transfer/upload"

# 测试上传
echo "test upload" > /tmp/test_upload.txt
curl -X POST http://10.30.2.11:8000/api/file-transfer/upload \
  -F "file=@/tmp/test_upload.txt" \
  -F "target_node=10.30.2.11" \
  -F "target_path=/tmp/test_upload" \
  -v
```

---

## 故障排查

### 问题1: 端口已被占用

**症状:**
```
OSError: [Errno 98] Address already in use
```

**解决:**
```bash
# 查找占用端口的进程
lsof -i :8000

# 停止进程
kill <PID>
```

### 问题2: 服务启动失败

**检查:**
```bash
# 查看日志
tail -50 /tmp/castray_*.log

# 检查Ray是否运行
ray status

# 检查Python环境
conda activate ray
python -c "import fastapi, uvicorn, ray; print('All imports OK')"
```

### 问题3: 404错误仍然存在

**原因:** 浏览器缓存

**解决:**
1. 强制刷新: Ctrl + F5
2. 清除缓存
3. 重新打开浏览器

---

## 前端测试

重启服务后，在浏览器中测试：

1. **打开Dashboard**
   ```
   http://10.30.2.11/dashboard.html
   ```

2. **打开开发者工具**
   - 按 F12
   - 切换到 Console 和 Network 标签

3. **测试上传**
   - 切换到"文件传输"面板
   - 选择目标节点
   - 拖拽文件上传

4. **检查Network请求**
   - 应该看到 POST 到 `/api/file-transfer/upload`
   - 状态应该是 200 OK
   - 响应应该包含 `"success": true`

5. **检查Console输出**
   ```javascript
   Transfer xxx completed and moved to completed list
   上传完成: filename.jpg
   ```

---

## 自动重启脚本（可选）

创建一个重启脚本：

```bash
cat > /data/home/sim6g/rayCode/droneOnCampus/restart_castray.sh << 'EOF'
#!/bin/bash

echo "Restarting CastRay service..."

# 停止旧服务
pkill -f "services.castray.main"
sleep 2

# 进入目录
cd /data/home/sim6g/rayCode/droneOnCampus

# 激活环境
source ~/miniconda3/etc/profile.d/conda.sh
conda activate ray

# 启动新服务
nohup python -m services.castray.main > /tmp/castray_$(date +%Y%m%d_%H%M%S).log 2>&1 &

echo "Service restarted. PID: $!"
echo "Log file: /tmp/castray_$(date +%Y%m%d_%H%M%S).log"

# 等待服务启动
sleep 3

# 验证
if curl -s http://10.30.2.11:8000/api/status > /dev/null; then
    echo "✓ Service is running"
else
    echo "✗ Service failed to start"
fi
EOF

chmod +x restart_castray.sh
```

使用：
```bash
./restart_castray.sh
```

---

## 更新日期
2025-11-27

## 相关文档
- PORT_CONFIGURATION.md - 端口配置说明
- FRONTEND_TRANSFER_FIX.md - 前端修复文档
- services/castray/main.py - 服务代码
