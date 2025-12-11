# 校园无人机系统 (DroneOnCampus)

## 🚀 快速启动

### 一键启动所有服务
```bash
cd /data/home/sim6g/rayCode/droneOnCampus/scripts
bash start_complete_system.sh
```

### 已启动的核心服务
| 服务 | 端口 | 地址 | 状态 |
|------|------|------|------|
| UE Program v1.2 | 30010 | http://10.30.2.11:30010 | 运行中 |
| Cirrus 信令服务 | 8888 | ws://localhost:8888 | 运行中 |
| CastRay 后端 | 28823 | http://10.30.2.11:28823 | 运行中 |
| 前端仪表板 | 8080 | http://localhost:8080 | 运行中 |
| Ray 输出 API | 9999 | http://10.30.2.11:9999 | 运行中 |

## 🌐 访问地址

### 主要界面
- **主仪表板**: http://localhost:8080/dashboard.html
- **UE 诊断工具**: http://localhost:8080/ue_api_diagnostic.html
- **LED 演示**: http://localhost:8080/diagnostic-demo.html

### 后端 API
- **CastRay Swagger 文档**: http://10.30.2.11:28823/docs
- **UE Remote Control API**: http://10.30.2.11:30010/remote/info

## 📊 系统架构

```
┌─────────────────────────────────────────────────────┐
│           Web Browser (Port 8080)                  │
│  ├─ Dashboard (Ray & Drone Control)                │
│  ├─ UE Diagnostic Tools                            │
│  └─ LED Enhancement Demo                           │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐   ┌────────▼─────────┐
│  Cirrus        │   │  CastRay         │
│  (Port 8888)   │   │  (Port 28823)    │
│  PixelStream   │   │  Ray Compute     │
└────────┬───────┘   └────────┬─────────┘
         │                    │
         └─────────┬──────────┘
                   │
              ┌────▼──────┐
              │  UE v1.2  │
              │ (Port 30010)
              │  RemoteAPI
              └───────────┘
```

## 🔧 配置文件

- **系统配置**: `config/system_config.json`
- **应用配置**: `app.js`
- **启动脚本**: `scripts/start_complete_system.sh`

## 📝 文档

详细文档已归档至 `doc_archive/` 目录：
- `doc_archive/DIAGNOSTIC_LED_ENHANCEMENT.md` - LED 增强功能
- `doc_archive/COLOR_MAPPING_CHECK.md` - 颜色映射验证
- `doc_archive/IMPLEMENTATION_CHECKLIST.md` - 实现清单

## 🧪 快速测试

### 测试 Remote Control API
```bash
curl http://10.30.2.11:30010/remote/info
```

### 测试灯光控制
```bash
curl -X PUT http://10.30.2.11:30010/remote/object/call \
  -H "Content-Type: application/json" \
  -d '{
    "objectPath": "/Game/NewMap.NewMap:PersistentLevel.NewMap_C_3",
    "functionName": "ChangeColor",
    "parameters": {"Active": 0}
  }'
```

### 测试 CastRay
```bash
curl http://10.30.2.11:28823/status
```

## 📋 故障排查

### 查看日志
```bash
# UE 程序
tail -f /tmp/ue_project.log

# Cirrus 信令服务
tail -f /tmp/cirrus.log

# CastRay 后端
tail -f /tmp/castray_internal.log

# 前端服务
tail -f /tmp/frontend.log
```

### 检查端口
```bash
netstat -tlnp | grep -E "30010|8888|28823|8080|9999"
```

## 🎯 项目状态

✅ UE Program v1.2 (已升级)
✅ Cirrus 像素流送基础设施
✅ CastRay 内嵌服务
✅ LED 状态指示增强
✅ 颜色映射验证

## 📞 支持

所有核心服务已启动且运行正常。项目准备好进行功能验证和演示。
