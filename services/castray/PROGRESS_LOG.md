# CastRay 迁移与稳定化工程日志

更新时间：2025-11-12

## 背景与目标
- 将原 CastRay 项目完整迁移至仓库路径 `droneOnCampus/services/castray`，并与现有前端、脚本等整合。
- 修复启动阻塞、文件传输统计等历史问题，提升健壮性与可观测性。
- 在存在外部 Ray 集群时，应用应“只连接不自启”，并优先使用环境变量 `RAY_ADDRESS`。

## 里程碑时间线（精简）

- 前端模块化
  - 从 `unified-node-manager.js` 中抽离节点合并逻辑为 `src/frontend/js/core/node-merger.js`，改善可维护性与复用。

- 后端重构与迁移
  - 新建包 `droneOnCampus/services/castray`，迁移并改造核心模块：
    - `main.py`（FastAPI 入口与路由）
    - `ray_casting.py`（集群与 Actor 管理）
    - `file_transfer.py`（文件传输与统计）
    - `ray_cluster_discovery.py`（外部集群发现）
    - `models.py`、静态资源与测试用例等
  - 统一相对导入，修复路径与包名问题。

- 启动与事件循环安全
  - 将潜在阻塞操作从 FastAPI 启动阶段移出或包裹在非阻塞逻辑中，避免卡住应用启动。

- 安全启动策略（不强制本地 Ray）
  - 为 `CastingCluster.initialize_ray(...)` 增加 `allow_local_start` 参数。
  - 在 `main.py` 启动时设置 `allow_local_start=False`，避免误启本地 Ray，优先外部连接。

- 优先使用 `RAY_ADDRESS`
  - `main.py` 启动读取 `RAY_ADDRESS` 环境变量并优先于配置文件。
  - `ray_casting.py` 在未发现外部集群时回退读取 `RAY_ADDRESS` 并尝试连接。

- 运行验证与反复排障（问题 → 证据 → 对策）
  - 现象1：uvicorn 启动后很快 "Shutting down"；`/api/status` 连接被拒绝。
    - 证据：日志多次出现退出码 143（SIGTERM），与一次性串接的 shell 命令尾部回收相关。
    - 对策：改为真正的后台/长驻方式启动，不再在同一 pipeline 里 tail/curl。
  - 现象2：`initialize_ray` 被 KeyboardInterrupt 中断。
    - 证据：手动调用显示中断发生在 Ray runtime_env 对 working_dir 打包/哈希阶段。
    - 根因：对外部地址连接时仍设置了 `working_dir=os.getcwd()`，大仓库导致耗时与中断。
    - 对策：对“外部地址”连接时不再设置 working_dir，仅传入必要 `env_vars`。

- 关键修复（2025-11-12）
  - `ray_casting.py/connect_to_ray_cluster`：
    - 对外部地址连接仅设置 `runtime_env={"env_vars": {...}}`，避免打包大目录。
    - 新增 `allow_local_fallback`，当禁用本地启动时，也禁用本地回退。
  - `ray_casting.py/initialize_ray`：贯穿传递 `allow_local_fallback`，并在直连失败→发现→`RAY_ADDRESS` 回退时保持一致策略。
  - `main.py`：启动日志明确输出最终使用的 Ray 地址与 namespace。

## 成果与当前状态
- 通过后台稳定启动 uvicorn 并设置 `RAY_ADDRESS=10.30.2.11:6379`：
  - 成功直连外部 Ray 集群（Dashboard: `10.30.2.11:8265`）。
  - 发现并映射 23 个外部 Ray 节点。
  - 自动创建演示节点 `demo_node_1`、`demo_node_2`，端口就绪。
  - 应用稳定运行，`/api/status` 可用（服务非降级）。

## 前端监控整合（cluster.html）
为统一展示 Ray 计算节点与 CastRay 传输节点，引入新的集成页面：`src/frontend/cluster.html`

### 页面作用
- 汇总原 `diaplayRayCluster/index.html` 的集群统计、节点列表与文件传输面板。
- 复用现有脚本：`ray_monitor.js`（Ray节点解析与展示）、`castray_integration.js`（文件传输 & CastRay 节点）、`unified-node-manager.js`（统一节点合并与高级卡片）。
- 通过内联 `window.appConfig` 自动指向当前服务域名，减少硬编码外部地址。

### 新增后端路由
- `/api/ray-dashboard`：在 `main.py` 中加入，与原独立脚本 `rayoutput.py` 输出结构兼容（`data.result.result`, `data.nodes`, `summary` 等字段）。前端保持向后兼容，不再需要独立的 `rayoutput.py` HTTPServer 启动脚本。

### 与旧脚本的差异
| 项目 | 旧实现 | 集成后 |
|------|--------|--------|
| Ray 数据聚合 | 独立脚本 `rayoutput.py` 起 HTTPServer (端口扫描) | FastAPI 路由 `/api/ray-dashboard` |
| 前端入口 | `diaplayRayCluster/index.html` | `src/frontend/cluster.html` |
| 样式文件 | `diaplayRayCluster/styles.css` | `src/frontend/css/cluster-styles.css`（精简版） |
| 节点合并 | 分散逻辑 | 统一在 `unified-node-manager.js` + `core/node-merger.js` |
| 配置 | 硬编码地址 | `window.appConfig` 注入动态源 |

### 访问方式
部署后访问：`http://<host>:<port>/static/../frontend/cluster.html`（视部署的静态资源映射方式而定；当前可直接在前端构建目录打开）。若需要通过 FastAPI 提供静态托管，可在后续将 `src/frontend` 挂载到 `/frontend` 路径。

### 后续可改进
1. 将 `/api/ray-dashboard` 输出的模拟使用率替换为真实指标（可通过 Ray Metrics 或 node health API 收集）。
2. 在统一视图中合并文件传输状态（对每个节点显示近期传输吞吐量）。
3. 增加 WebSocket 推送（集群节点变化与传输进度）。
4. 支持多集群切换：通过查询参数或配置列出可用集群地址列表。

标记：旧仓库 `diaplayRayCluster` 中的 `index.html` / `styles.css` / `ray_monitor.js` / `castray_integration.js` 已被整合；`rayoutput.py` 推荐改为“已集成功能”状态，不再直接运行。

## 关键文件与改动摘要
- `droneOnCampus/services/castray/main.py`
  - 启动时优先读取 `RAY_ADDRESS`；增加启动日志；在 `allow_local_start=False` 下初始化。
- `droneOnCampus/services/castray/ray_casting.py`
  - `connect_to_ray_cluster(ray_address, namespace, allow_local_fallback)`：
    - 外部直连：不设置 working_dir，只传 env_vars，显著降低连接等待；
    - 本地/auto：保留 working_dir 以方便本机代码加载；
    - 失败时是否本地回退由 `allow_local_fallback` 决定。
  - `CastingCluster.initialize_ray(...)`：
    - 优先直连给定地址；
    - 失败后尝试外部发现；
    - 再失败读取 `RAY_ADDRESS` 回退尝试；
    - 最终若 `allow_local_start=False` 则不启本地，避免误操作。
- 前端：`src/frontend/js/core/node-merger.js` 提取复用逻辑。

## 经验与教训
- 启动/调试脚本要与“长驻服务”模式兼容，避免因 pipeline 结束给子进程发送 SIGTERM。
- Ray 直连外部集群时切忌随意带上 working_dir，否则会触发大目录打包与上传，严重影响初始化时延与稳定性。
- 将“是否允许本地启动/回退”与“发现/直连策略”解耦，有助于在多环境下保持一致行为。

## 质量门禁（本次会话）
- Build：PASS（应用可成功启动并保持运行）。
- Lint/Typecheck：PASS（有少量对 `ray.util.state` 的可选导入告警，不影响运行路径）。
- Tests：未在本次会话中执行；后续可补充 e2e 与集成测试。

## 后续建议（Next）
- 提供 `/api/reconnect` 端点与后台重试任务：当首次连接失败时延迟重连，支持手动触发。
- 更细粒度的连接耗时与错误分类型日志，辅助跨集群排障。
- 增加端到端用例（创建节点、文件传输、统一状态查询）以覆盖主路径回归。

---
本文档旨在记录从迁移、排障到稳定运行的关键节点与决策，便于后续团队成员快速了解来龙去脉与设计取舍。