# 端口配置说明

## 当前端口使用情况

### 后端服务

| 端口 | 服务 | 状态 | 说明 |
|------|------|------|------|
| **8000** | rayoutput.py | ✅ 运行中 | 旧的Ray输出服务，提供节点信息 |
| **8001** | CastRay (services/castray/main.py) | ❌ 未运行 | 新的CastRay服务（文件传输功能） |
| 8265 | Ray Dashboard | ✅ 运行中 | Ray原生Dashboard |
| 8888 | 其他服务 | ✅ 运行中 | - |

### 前端配置

| 组件 | 当前配置 | 说明 |
|------|---------|------|
| **ray-cluster-manager.js** | 8000 | 获取集群节点信息 |
| **file-transfer-manager.js** | 8000 | 文件传输API（已修正） |
| **dashboard.html** | 8000 | 主Dashboard |

---

## 修复说明

### 问题
前端file-transfer-manager.js最初配置为使用8001端口（CastRay服务），但该服务未运行，导致：
- 无法获取节点列表（源节点、目标节点选项为0）
- 无法上传文件
- 无法进行文件传输

### 解决方案
将file-transfer-manager.js的baseURL改回8000端口，与现有运行的服务保持一致。

```javascript
// 修改前（指向未运行的服务）
this.baseURL = 'http://10.30.2.11:8001';

// 修改后（指向运行中的服务）
this.baseURL = 'http://10.30.2.11:8000';
```

---

## 两种部署方案

### 方案A: 使用现有rayoutput.py服务（推荐）

**优点:**
- 无需额外配置
- 服务已稳定运行
- 节点信息实时可用

**配置:**
```javascript
// file-transfer-manager.js
this.baseURL = 'http://10.30.2.11:8000';
```

**验证:**
```bash
curl http://10.30.2.11:8000/api/ray-dashboard
curl http://10.30.2.11:8000/api/status
```

---

### 方案B: 启动CastRay服务（未来迁移）

如果将来需要使用完整的CastRay服务（包含增强的文件传输功能）：

**步骤:**

1. **启动CastRay服务**
```bash
cd /data/home/sim6g/rayCode/droneOnCampus
conda activate ray

# 设置端口（可选）
export CASTRAY_PORT=8001

# 启动服务
python -m services.castray.main
```

2. **修改前端配置**
```javascript
// file-transfer-manager.js
this.baseURL = 'http://10.30.2.11:8001';
```

3. **验证服务**
```bash
curl http://10.30.2.11:8001/api/status
curl http://10.30.2.11:8001/api/ray-dashboard
```

**注意:** CastRay服务提供了更多功能：
- 增强的文件传输状态管理
- 详细的传输统计
- 节点间直接传输
- WebSocket实时更新

---

## API端点对比

### rayoutput.py (8000端口)

| 端点 | 可用性 | 说明 |
|------|--------|------|
| `/api/ray-dashboard` | ✅ | 节点信息 |
| `/api/status` | ✅ | 服务状态 |
| `/api/file-transfer/*` | ❌ | 不支持 |

### CastRay (8001端口)

| 端点 | 可用性 | 说明 |
|------|--------|------|
| `/api/ray-dashboard` | ✅ | 增强的节点信息 |
| `/api/status` | ✅ | 详细状态 |
| `/api/file-transfer/upload` | ✅ | 文件上传 |
| `/api/file-transfer/node-to-node` | ✅ | 节点间传输 |
| `/api/file-transfers/status` | ✅ | 传输状态（详细） |
| `/api/file-transfers/manual` | ✅ | 手动触发传输 |

---

## 当前配置（修复后）

✅ 所有前端组件使用8000端口  
✅ 节点列表正常加载  
✅ 文件传输功能可用  
✅ Dashboard正常显示  

---

## 故障排查

### 问题: 源节点和目标节点选项为0

**原因:**
- API服务未运行
- 端口配置错误
- 网络连接问题

**检查:**
```bash
# 检查服务是否运行
curl http://10.30.2.11:8000/api/status
curl http://10.30.2.11:8000/api/ray-dashboard

# 检查端口监听
netstat -tulpn | grep 8000

# 检查浏览器Console
# 应该看到节点数据加载成功
```

**解决:**
1. 确认服务运行在正确端口
2. 检查前端baseURL配置
3. 清除浏览器缓存（Ctrl+F5）

### 问题: 无法上传文件

**原因:**
- 上传API端点不存在（8000端口的rayoutput.py不支持）
- 需要CastRay服务的完整功能

**解决:**
- 选项1: 实现上传功能到rayoutput.py
- 选项2: 启动CastRay服务（方案B）

---

## 建议

### 短期（当前）
✅ 使用8000端口（rayoutput.py）  
✅ 节点管理和查看功能完整  
⚠️ 文件上传需要额外实现  

### 长期（迁移）
- 迁移到CastRay服务（8001）
- 获得完整的文件传输功能
- 统一API接口
- 更好的状态管理

---

## 更新日期
2025-11-27

## 相关文档
- FRONTEND_TRANSFER_FIX.md - 前端修复说明
- TRANSFER_FIX_README.md - 修复总览
- TESTING_GUIDE.md - 测试指南
