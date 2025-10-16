/**
 * 统一节点管理器 - 整合 Ray 计算节点和 CastRay 传输节点
 * 使用 Ray 节点 ID 作为唯一标识符来关联两个系统的节点数据
 */
class UnifiedNodeManager {
    constructor() {
        this.unifiedNodes = new Map(); // Key: Ray节点ID, Value: 统一节点数据
        // 支持从全局配置读取 API 地址（在 dashboard.html 中可定义 window.appConfig）
        const cfg = (window && window.appConfig) ? window.appConfig : {};
        this.rayApiBase = cfg.rayApiBase || 'http://10.30.2.11:9999';
        this.castrayApiBase = cfg.castrayApiBase || 'http://10.30.2.11:8000';
        this.updateInterval = null;
        this.isInitialized = false;
        
        console.log('初始化统一节点管理器...');
    }

    /**
     * 初始化管理器
     */
    async init() {
        if (this.isInitialized) {
            console.log('统一节点管理器已初始化');
            return;
        }

        try {
            // 创建统一面板UI
            this.createUnifiedPanel();
            
            // 获取初始数据
            await this.fetchAndMergeNodeData();
            
            // 启动定期更新
            this.startPeriodicUpdates();
            
            this.isInitialized = true;
            console.log('统一节点管理器初始化完成');
        } catch (error) {
            console.error('统一节点管理器初始化失败:', error);
        }
    }

    /**
     * 创建统一面板UI
     */
    createUnifiedPanel() {
        const nodesSection = document.querySelector('.nodes-section');
        if (!nodesSection) {
            console.error('找不到节点区域容器');
            return;
        }

        // 清空现有的节点分类
        nodesSection.innerHTML = '';

        // 创建统一节点面板
        const unifiedPanel = document.createElement('div');
        unifiedPanel.className = 'unified-node-category';
        unifiedPanel.innerHTML = `
            <div class="unified-node-header">
                <h3><i class="fas fa-sitemap"></i> 统一节点管理</h3>
                <div class="node-summary" id="node-summary">
                    <span class="summary-item">
                        <i class="fas fa-server"></i>
                        <span id="total-nodes">0</span> 节点
                    </span>
                    <span class="summary-item">
                        <i class="fas fa-check-circle"></i>
                        <span id="active-nodes">0</span> 在线
                    </span>
                    <span class="summary-item">
                        <i class="fas fa-network-wired"></i>
                        <span id="streaming-nodes">0</span> 传输中
                    </span>
                </div>
            </div>
            <div class="unified-node-controls">
                <div class="control-group">
                    <button id="refreshNodesBtn" class="control-btn">
                        <i class="fas fa-sync-alt"></i> 刷新节点
                    </button>
                    <button id="createNodeBtn" class="control-btn">
                        <i class="fas fa-plus"></i> 创建节点
                    </button>
                </div>
            </div>
            <div id="unifiedNodesContainer" class="unified-nodes-container">
                <!-- 统一节点列表将在这里动态生成 -->
            </div>
        `;

        nodesSection.appendChild(unifiedPanel);

        // 设置事件监听器
        this.setupEventListeners();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        const refreshBtn = document.getElementById('refreshNodesBtn');
        const createBtn = document.getElementById('createNodeBtn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.fetchAndMergeNodeData();
            });
        }

        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.showCreateNodeDialog();
            });
        }
    }

    /**
     * 获取并合并节点数据
     */
    async fetchAndMergeNodeData() {
        try {
            console.log('获取统一节点数据...');

            // 并行获取 Ray 和 CastRay 数据
            const [rayData, castrayData] = await Promise.all([
                this.fetchRayNodes(),
                this.fetchCastRayNodes()
            ]);

            // 合并数据（返回 unmatched 信息以便调试）
            const mergeResult = this.mergeNodeData(rayData, castrayData);

            // 更新UI
            this.updateUnifiedView();

            // 如果有未匹配的节点，显示在界面顶部的调试面板
            if (mergeResult && (mergeResult.unmatchedRay.length || mergeResult.unmatchedCastRay.length)) {
                this.showUnmatchedDiagnostics(mergeResult.unmatchedRay, mergeResult.unmatchedCastRay);
            } else {
                this.clearUnmatchedDiagnostics();
            }

        } catch (error) {
            console.error('获取节点数据失败:', error);
            this.showErrorState('无法获取节点数据');
        }
    }

    /**
     * 获取 Ray 节点数据
     */
    async fetchRayNodes() {
        try {
            const response = await fetch(this.rayApiBase, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Ray API 请求失败: ${response.status}`);
            }

            const data = await response.json();
            console.log('Ray 节点数据:', data);
            return data.nodes || [];

        } catch (error) {
            console.warn('获取 Ray 节点数据失败:', error);
            // 返回模拟数据作为备用
            return this.createMockRayData();
        }
    }

    /**
     * 获取 CastRay 节点数据
     */
    async fetchCastRayNodes() {
        try {
            const response = await fetch(`${this.castrayApiBase}/api/nodes`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`CastRay API 请求失败: ${response.status}`);
            }

            const data = await response.json();
            console.log('CastRay 节点数据:', data);
            return data.nodes || [];

        } catch (error) {
            console.warn('获取 CastRay 节点数据失败:', error);
            // 返回模拟数据作为备用
            return this.createMockCastRayData();
        }
    }

    /**
     * 合并 Ray 和 CastRay 节点数据
     */
    mergeNodeData(rayNodes, castrayNodes) {
        // 清空现有数据
        this.unifiedNodes.clear();

    const unmatchedRay = [];
    const unmatchedCastRay = [];
    // 辅助映射：短 id -> full id 列表
    const shortIdMap = new Map();

        // 首先处理 Ray 节点数据
        rayNodes.forEach(rayNode => {
            const nodeId = rayNode.nodeId || rayNode.id;
            if (nodeId) {
                // 存储短 id 映射，便于后续模糊匹配（前 8 或前 12 字符）
                const short8 = String(nodeId).substring(0, 8);
                const short12 = String(nodeId).substring(0, 12);
                if (!shortIdMap.has(short8)) shortIdMap.set(short8, []);
                shortIdMap.get(short8).push(nodeId);
                if (!shortIdMap.has(short12)) shortIdMap.set(short12, []);
                shortIdMap.get(short12).push(nodeId);
                this.unifiedNodes.set(nodeId, {
                    rayNodeId: nodeId,
                    hostname: rayNode.name || rayNode.fullName,
                    ip: rayNode.nodeIp || rayNode.ip,
                    rayData: {
                        id: rayNode.id,
                        name: rayNode.name,
                        fullName: rayNode.fullName,
                        state: rayNode.state,
                        isHeadNode: rayNode.isHeadNode,
                        cpu: rayNode.cpu,
                        memory: rayNode.memory,
                        gpu: rayNode.gpu,
                        tasks: rayNode.tasks,
                        status: rayNode.status,
                        connectionType: rayNode.connectionType,
                        resources: rayNode.resources
                    },
                    castrayData: null // 初始化为空，稍后填充
                });
            }
        });

        // 然后处理 CastRay 节点数据，通过 rayNodeId 进行关联
        castrayNodes.forEach(castrayNode => {
            let rayNodeId = castrayNode.rayNodeId;
            
            // 如果没有直接匹配，尝试根据短ID/前缀进行模糊匹配
            let matchedFullId = null;
            if (rayNodeId && this.unifiedNodes.has(rayNodeId)) {
                matchedFullId = rayNodeId;
            } else if (rayNodeId) {
                const maybe = String(rayNodeId).substring(0, 12);
                const candidates = shortIdMap.get(maybe) || shortIdMap.get(maybe.substring(0,8));
                if (candidates && candidates.length === 1) {
                    matchedFullId = candidates[0];
                } else if (candidates && candidates.length > 1) {
                    // 多重候选，不自动选，记录为未匹配以供人工诊断
                    matchedFullId = null;
                }
            }

            if (matchedFullId) {
                rayNodeId = matchedFullId;
            }

            if (rayNodeId && this.unifiedNodes.has(rayNodeId)) {
                // 找到对应的 Ray 节点，合并 CastRay 数据
                const existingNode = this.unifiedNodes.get(rayNodeId);
                existingNode.castrayData = {
                    agentId: castrayNode.agentId,
                    status: castrayNode.status,
                    bitrate: castrayNode.bitrate,
                    streamingState: castrayNode.streamingState,
                    connections: castrayNode.connections,
                    lastUpdate: castrayNode.lastUpdate
                };
                this.unifiedNodes.set(rayNodeId, existingNode);
            } else if (rayNodeId) {
                // CastRay 节点没有对应的 Ray 节点（边缘情况）
                // 记录为 unmatchedCastRay，继续保留在显示列表中
                unmatchedCastRay.push(castrayNode);
                this.unifiedNodes.set(rayNodeId, {
                    rayNodeId: rayNodeId,
                    hostname: castrayNode.hostname || 'Unknown',
                    ip: castrayNode.ip,
                    rayData: null,
                    castrayData: {
                        agentId: castrayNode.agentId,
                        status: castrayNode.status,
                        bitrate: castrayNode.bitrate,
                        streamingState: castrayNode.streamingState,
                        connections: castrayNode.connections,
                        lastUpdate: castrayNode.lastUpdate
                    }
                });
            }
        });
        // 查找 Ray 中未被 CastRay 匹配的节点
        this.unifiedNodes.forEach((node, id) => {
            if (node.rayData && !node.castrayData) {
                // 如果 Ray 节点未被任何 CastRay 匹配，记录为 unmatchedRay
                unmatchedRay.push(node);
            }
        });

        console.log(`合并完成，统一节点数量: ${this.unifiedNodes.size}`);
        console.log(`未匹配的 Ray 节点: ${unmatchedRay.length}, 未匹配的 CastRay 节点: ${unmatchedCastRay.length}`);

        return { unmatchedRay, unmatchedCastRay };
    }

    /**
     * 在 UI 中显示未匹配节点的诊断信息
     */
    showUnmatchedDiagnostics(unmatchedRay, unmatchedCastRay) {
        const container = document.getElementById('unifiedNodesContainer');
        if (!container) return;

        let diag = document.getElementById('unmatched-diagnostics');
        if (!diag) {
            diag = document.createElement('div');
            diag.id = 'unmatched-diagnostics';
            diag.className = 'unmatched-diagnostics';
            diag.style.cssText = 'background: #2b2b2b; color: #fff; padding: 8px; margin-bottom: 8px; border-radius: 6px;';
            container.prepend(diag);
        }

        diag.innerHTML = `
            <strong>未匹配诊断</strong>
            <div>未匹配的 Ray 节点: ${unmatchedRay.length}</div>
            <div>未匹配的 CastRay 节点: ${unmatchedCastRay.length}</div>
            <button id="show-unmatched-details" class="control-btn" style="margin-top:6px;">显示详情 (控制台)</button>
        `;

        const btn = document.getElementById('show-unmatched-details');
        if (btn) {
            btn.onclick = () => {
                console.group('未匹配节点 详情');
                console.log('unmatchedRay:', unmatchedRay);
                console.log('unmatchedCastRay:', unmatchedCastRay);
                console.groupEnd();
                alert('已在控制台打印未匹配节点详情');
            };
        }
    }

    clearUnmatchedDiagnostics() {
        const diag = document.getElementById('unmatched-diagnostics');
        if (diag) diag.remove();
    }

    /**
     * 更新统一视图
     */
    updateUnifiedView() {
        this.updateSummary();
        this.renderNodeList();
    }

    /**
     * 更新统计摘要
     */
    updateSummary() {
        const totalNodes = this.unifiedNodes.size;
        let activeNodes = 0;
        let streamingNodes = 0;

        this.unifiedNodes.forEach(node => {
            if (node.rayData && node.rayData.status === 'active') {
                activeNodes++;
            }
            if (node.castrayData && 
                (node.castrayData.status === 'streaming' || 
                 node.castrayData.streamingState === 'active')) {
                streamingNodes++;
            }
        });

        document.getElementById('total-nodes').textContent = totalNodes;
        document.getElementById('active-nodes').textContent = activeNodes;
        document.getElementById('streaming-nodes').textContent = streamingNodes;
    }

    /**
     * 渲染节点列表
     */
    renderNodeList() {
        const container = document.getElementById('unifiedNodesContainer');
        if (!container) return;

        container.innerHTML = '';

        if (this.unifiedNodes.size === 0) {
            container.innerHTML = `
                <div class="no-nodes-message">
                    <i class="fas fa-info-circle"></i>
                    <p>暂无节点数据</p>
                </div>
            `;
            return;
        }

        this.unifiedNodes.forEach((node, nodeId) => {
            const nodeCard = this.createNodeCard(node);
            // set DOM id for easier lookup by user manager
            nodeCard.id = `node-card-${nodeId.substring(0,8)}`;
            container.appendChild(nodeCard);
            // allow user manager to augment the node card (assign buttons/owner badges)
            if (window.userManager && typeof window.userManager.attachNodeCard === 'function') {
                try { window.userManager.attachNodeCard(nodeId, nodeCard); } catch (e) { console.warn('userManager.attachNodeCard error', e); }
            }
        });
    }

    /**
     * 创建节点卡片
     */
    createNodeCard(node) {
        const card = document.createElement('div');
        card.className = 'unified-node-card';
        
        const rayData = node.rayData;
        const castrayData = node.castrayData;
        
        // 确定整体状态
        const overallStatus = this.determineOverallStatus(rayData, castrayData);
        
        card.innerHTML = `
            <div class="node-card-header">
                <div class="node-info">
                    <h4>${node.hostname || 'Unknown Node'}</h4>
                    <span class="node-id">${node.rayNodeId.substring(0, 8)}...</span>
                    <span class="node-ip">${node.ip}</span>
                </div>
                <div class="node-status ${overallStatus}">
                    <i class="fas ${this.getStatusIcon(overallStatus)}"></i>
                    ${this.getStatusText(overallStatus)}
                </div>
            </div>
            
            <div class="node-card-content">
                <div class="node-capabilities">
                    ${rayData ? this.renderRayCapabilities(rayData) : '<div class="capability-missing">Ray 数据不可用</div>'}
                    ${castrayData ? this.renderCastRayCapabilities(castrayData) : '<div class="capability-missing">CastRay 数据不可用</div>'}
                </div>
                
                <div class="node-metrics">
                    ${rayData ? this.renderResourceMetrics(rayData) : ''}
                    ${castrayData ? this.renderStreamingMetrics(castrayData) : ''}
                </div>
            </div>
            
            <div class="node-card-actions">
                <button class="action-btn" onclick="unifiedNodeManager.showNodeDetails('${node.rayNodeId}')">
                    <i class="fas fa-info-circle"></i> 详情
                </button>
                ${castrayData ? `
                    <button class="action-btn" onclick="unifiedNodeManager.toggleStreaming('${node.rayNodeId}')">
                        <i class="fas fa-play"></i> ${castrayData.status === 'streaming' ? '停止' : '开始'}传输
                    </button>
                ` : ''}
            </div>
        `;
        
        return card;
    }

    /**
     * 确定节点的整体状态
     */
    determineOverallStatus(rayData, castrayData) {
        if (!rayData && !castrayData) return 'unknown';
        if (rayData && rayData.status === 'dead') return 'error';
        if (castrayData && castrayData.status === 'error') return 'error';
        if (rayData && rayData.status === 'active' && castrayData && castrayData.status === 'streaming') return 'active-streaming';
        if (rayData && rayData.status === 'active') return 'active';
        if (castrayData && castrayData.status === 'streaming') return 'streaming';
        return 'idle';
    }

    /**
     * 获取状态图标
     */
    getStatusIcon(status) {
        const icons = {
            'active-streaming': 'fa-satellite-dish',
            'active': 'fa-check-circle',
            'streaming': 'fa-broadcast-tower',
            'idle': 'fa-pause-circle',
            'error': 'fa-exclamation-triangle',
            'unknown': 'fa-question-circle'
        };
        return icons[status] || 'fa-question-circle';
    }

    /**
     * 获取状态文本
     */
    getStatusText(status) {
        const texts = {
            'active-streaming': '计算传输中',
            'active': '计算中',
            'streaming': '传输中',
            'idle': '空闲',
            'error': '错误',
            'unknown': '未知'
        };
        return texts[status] || '未知';
    }

    /**
     * 渲染 Ray 能力
     */
    renderRayCapabilities(rayData) {
        return `
            <div class="capability-section ray-capability">
                <h5><i class="fas fa-microchip"></i> 计算能力</h5>
                <div class="capability-details">
                    <span class="capability-item ${rayData.isHeadNode ? 'head-node' : ''}">
                        ${rayData.isHeadNode ? 'Head Node' : 'Worker Node'}
                    </span>
                    <span class="capability-item">${rayData.connectionType || 'Unknown'} 连接</span>
                    ${rayData.tasks ? rayData.tasks.map(task => `<span class="task-tag">${task}</span>`).join('') : ''}
                </div>
            </div>
        `;
    }

    /**
     * 渲染 CastRay 能力
     */
    renderCastRayCapabilities(castrayData) {
        return `
            <div class="capability-section castray-capability">
                <h5><i class="fas fa-satellite"></i> 传输能力</h5>
                <div class="capability-details">
                    <span class="capability-item">Agent ${castrayData.agentId}</span>
                    <span class="capability-item ${castrayData.status}">${castrayData.status}</span>
                    ${castrayData.connections ? `<span class="capability-item">${castrayData.connections} 连接</span>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * 渲染资源指标
     */
    renderResourceMetrics(rayData) {
        return `
            <div class="metrics-section resource-metrics">
                <div class="metric-item">
                    <span class="metric-label">CPU</span>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${rayData.cpu}%"></div>
                    </div>
                    <span class="metric-value">${rayData.cpu}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">内存</span>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${rayData.memory}%"></div>
                    </div>
                    <span class="metric-value">${rayData.memory}%</span>
                </div>
                ${rayData.gpu > 0 ? `
                    <div class="metric-item">
                        <span class="metric-label">GPU</span>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${rayData.gpu}%"></div>
                        </div>
                        <span class="metric-value">${rayData.gpu}%</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 渲染流传输指标
     */
    renderStreamingMetrics(castrayData) {
        return `
            <div class="metrics-section streaming-metrics">
                ${castrayData.bitrate ? `
                    <div class="metric-item">
                        <span class="metric-label">码率</span>
                        <span class="metric-value">${castrayData.bitrate} kbps</span>
                    </div>
                ` : ''}
                ${castrayData.lastUpdate ? `
                    <div class="metric-item">
                        <span class="metric-label">更新时间</span>
                        <span class="metric-value">${new Date(castrayData.lastUpdate).toLocaleTimeString()}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 启动定期更新
     */
    startPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.fetchAndMergeNodeData();
        }, 5000); // 每5秒更新一次
    }

    /**
     * 停止定期更新
     */
    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * 显示错误状态
     */
    showErrorState(message) {
        const container = document.getElementById('unifiedNodesContainer');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${message}</p>
                    <button onclick="unifiedNodeManager.fetchAndMergeNodeData()" class="retry-btn">
                        <i class="fas fa-redo"></i> 重试
                    </button>
                </div>
            `;
        }
    }

    /**
     * 创建模拟 Ray 数据
     */
    createMockRayData() {
        return [
            {
                id: "12345678",
                name: "WorkerNode-1",
                fullName: "WorkerNode-1 (10.30.2.11)",
                nodeIp: "10.30.2.11",
                nodeId: "abcdef1234567890abcdef1234567890abcdef12",
                state: "ALIVE",
                isHeadNode: false,
                cpu: 45.2,
                memory: 32.1,
                gpu: 67.8,
                tasks: ["CPU密集任务", "GPU计算任务"],
                status: "active",
                connectionType: "wired",
                resources: {
                    totalCpu: 8,
                    totalMemory: 32,
                    totalGpu: 1,
                    objectStore: 20
                }
            },
            {
                id: "87654321",
                name: "HeadNode",
                fullName: "HeadNode (10.30.2.11)",
                nodeIp: "10.30.2.11",
                nodeId: "fedcba0987654321fedcba0987654321fedcba09",
                state: "ALIVE",
                isHeadNode: true,
                cpu: 23.5,
                memory: 18.9,
                gpu: 0,
                tasks: ["集群管理"],
                status: "active",
                connectionType: "wired",
                resources: {
                    totalCpu: 4,
                    totalMemory: 16,
                    totalGpu: 0,
                    objectStore: 10
                }
            }
        ];
    }

    /**
     * 创建模拟 CastRay 数据
     */
    createMockCastRayData() {
        return [
            {
                agentId: "agent-001",
                rayNodeId: "abcdef1234567890abcdef1234567890abcdef12",
                ip: "10.30.2.11",
                status: "streaming",
                bitrate: 5000,
                streamingState: "active",
                connections: 2,
                lastUpdate: new Date().toISOString()
            },
            {
                agentId: "agent-002",
                rayNodeId: "fedcba0987654321fedcba0987654321fedcba09",
                ip: "10.30.2.11",
                status: "idle",
                bitrate: 0,
                streamingState: "idle",
                connections: 0,
                lastUpdate: new Date().toISOString()
            }
        ];
    }

    /**
     * 显示节点详情
     */
    showNodeDetails(nodeId) {
        const node = this.unifiedNodes.get(nodeId);
        if (!node) return;

        // 这里可以实现一个详细的模态对话框
        alert(`节点详情:\n主机名: ${node.hostname}\nIP: ${node.ip}\nRay节点ID: ${nodeId}`);
    }

    /**
     * 切换流传输状态
     */
    async toggleStreaming(nodeId) {
        const node = this.unifiedNodes.get(nodeId);
        if (!node || !node.castrayData) return;

        try {
            const isStreaming = node.castrayData.status === 'streaming';
            const action = isStreaming ? 'stop' : 'start';
            
            // 这里应该调用实际的 API
            console.log(`${action} streaming for node ${nodeId}`);
            
            // 模拟 API 调用
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 更新本地状态
            node.castrayData.status = isStreaming ? 'idle' : 'streaming';
            this.updateUnifiedView();
            
        } catch (error) {
            console.error('切换流传输状态失败:', error);
        }
    }

    /**
     * 显示创建节点对话框
     */
    showCreateNodeDialog() {
        // 这里可以实现创建节点的逻辑
        const nodeId = prompt('请输入新节点ID:');
        if (nodeId) {
            console.log(`创建节点: ${nodeId}`);
        }
    }

    /**
     * 销毁管理器
     */
    destroy() {
        this.stopPeriodicUpdates();
        this.unifiedNodes.clear();
        this.isInitialized = false;
    }
}

// 创建全局实例
window.unifiedNodeManager = new UnifiedNodeManager();
