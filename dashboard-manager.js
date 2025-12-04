/**
 * Dashboard Manager - 专业仪表板管理器
 * 基于NVIDIA Aerial GUI设计理念实现
 */

class DashboardManager {
  constructor() {
    this.currentScenario = "drone";
    this.currentPage = "viewport"; // Default page
    this.isConnected = false;
    this.selectedObjectId = null;
    this.rayClusterManager = null; // Ray cluster manager instance
    this.fileTransferManager = null; // File transfer manager instance
    this.droneData = {
      position: { x: -850.0, y: -30.0, z: 62.0 },
      battery: 87,
      speed: 15.2,
      mission: {
        status: "STANDBY",
        target: "Library",
        distance: 245.6,
      },
      environment: {
        windSpeed: 12.3,
        temperature: 22.5,
      },
    };
    this.networkData = {
      bandwidth: 85.2,
      latency: 12,
      signalStrength: 78,
      packetLoss: 0.1,
    };

    this.updateInterval = null;
    this.stations = [];
    this.consoleMessages = [];

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initializeDataUpdates();
    this.updateSystemTime();
    this.loadSceneTree();
    this.switchPage("viewport"); // Set initial page

    // 设置初始状态
    this.updateConnectionStatus("connecting");

    console.log("Dashboard Manager initialized");
    this.logToConsole("Dashboard Manager initialized", "info");
  }

  setupEventListeners() {
    // 场景切换
    document.querySelectorAll(".scenario-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchScenario(e.currentTarget.dataset.scenario);
      });
    });

    // 左侧边栏页面切换
    document.querySelectorAll(".sidebar-tabs .tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchPage(e.currentTarget.dataset.tab);
      });
    });

    // 工具栏按钮
    this.setupToolbarButtons();

    // 配送按钮
    document.querySelectorAll(".delivery-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const from = e.currentTarget.dataset.from;
        const to = e.currentTarget.dataset.to;
        this.startDelivery(from, to);
      });
    });

    // 摄像头按钮
    document.querySelectorAll(".camera-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const view = e.currentTarget.dataset.view;
        this.changeView(view);
      });
    });

    // 基站部署
    const deployBtn = document.getElementById("deploy-station-btn");
    if (deployBtn) {
      deployBtn.addEventListener("click", () => {
        this.deployStation();
      });
    }

    // 连接按钮
    const connectUeBtn = document.getElementById("connect-ue-btn");
    if (connectUeBtn) {
      connectUeBtn.addEventListener("click", () => {
        this.connectToUE();
      });
    }

    const connectDbBtn = document.getElementById("connect-db-btn");
    if (connectDbBtn) {
      connectDbBtn.addEventListener("click", () => {
        this.connectToDatabase();
      });
    }

    // 控制台清空按钮
    const clearConsoleBtn = document.getElementById("clear-console");
    if (clearConsoleBtn) {
      clearConsoleBtn.addEventListener("click", () => {
        this.clearConsole();
      });
    }

    // 视口设置
    const viewTypeSelect = document.getElementById("view-type-select");
    if (viewTypeSelect) {
      viewTypeSelect.addEventListener("change", (e) => {
        this.changeViewType(e.target.value);
      });
    }

    // 属性面板折叠
    const collapseBtn = document.getElementById("collapse-properties");
    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => {
        this.togglePropertiesPanel();
      });
    }
  }

  setupToolbarButtons() {
    const attachWorkerBtn = document.getElementById("attach-worker-btn");
    const startSimBtn = document.getElementById("start-simulation-btn");
    const pauseSimBtn = document.getElementById("pause-simulation-btn");
    const stopSimBtn = document.getElementById("stop-simulation-btn");

    if (attachWorkerBtn) {
      attachWorkerBtn.addEventListener("click", () => {
        this.attachWorker();
      });
    }

    if (startSimBtn) {
      startSimBtn.addEventListener("click", () => {
        this.startSimulation();
      });
    }

    if (pauseSimBtn) {
      pauseSimBtn.addEventListener("click", () => {
        this.pauseSimulation();
      });
    }

    if (stopSimBtn) {
      stopSimBtn.addEventListener("click", () => {
        this.stopSimulation();
      });
    }
  }

  switchScenario(scenario) {
    this.currentScenario = scenario;

    // 更新按钮状态
    document.querySelectorAll(".scenario-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.scenario === scenario) {
        btn.classList.add("active");
      }
    });

    // 更新body类
    document.body.className = `${scenario}-scenario`;

    // 切换场景内容
    const vehicleContent = document.querySelector('.vehicle-scenario-content');
    const mainContent = document.querySelector('.main-content-panel');
    
    if (scenario === 'vehicle') {
      // 显示自动驾驶场景
      if (vehicleContent) {
        vehicleContent.style.display = 'block';
        mainContent.style.display = 'none';
      }
      this.initVehicleScenario();
    } else {
      // 显示无人机场景
      if (vehicleContent) {
        vehicleContent.style.display = 'none';
        mainContent.style.display = 'block';
      }
    }

    this.logToConsole(`Switched to ${scenario} scenario`, "info");
  }

  initVehicleScenario() {
    // 初始化自动驾驶场景
    this.selectedDetectionNode = null;
    this.setupDetectionUI();
    this.setupDetectionEventListeners();
    
    // 初始化简化的飞行控制
    this.setupSimpleFlightControl();
    
    // 初始化 CM-ZSB 与灯光映射
    this.setupStationLightMapping();
  }

  // 简化的飞行控制初始化
  setupSimpleFlightControl() {
    // 创建路径管理器
    if (!window.flightPathManager && window.apiManager) {
      window.flightPathManager = new FlightPathManager(window.apiManager);
    }

    // 创建简化飞行 UI 管理器
    if (!window.droneSimpleFlightUI) {
      window.droneSimpleFlightUI = new DroneSimpleFlightUI(this);
    }

    // 注入飞行控制 UI
    const vehicleContent = document.getElementById('vehicle-scenario-content');
    if (vehicleContent) {
      // 查找飞行控制容器或创建
      let flightControlContainer = vehicleContent.querySelector('.simple-flight-container');
      if (!flightControlContainer) {
        flightControlContainer = document.createElement('div');
        flightControlContainer.className = 'simple-flight-container';
        // 插入到灯光控制下面
        const lightControlSection = vehicleContent.querySelector('.light-control-section');
        if (lightControlSection) {
          lightControlSection.parentNode.insertBefore(flightControlContainer, lightControlSection.nextSibling);
        } else {
          vehicleContent.appendChild(flightControlContainer);
        }
      }

      // 创建 UI
      window.droneSimpleFlightUI.createUI(flightControlContainer, window.flightPathManager);
      this.logToConsole('飞行控制 UI 已加载', 'success');
    }
  }

  // CM-ZSB 与灯光映射初始化
  setupStationLightMapping() {
    // 节点检测配置
    this.nodeDetectionConfig = {
      nodes: [
        { id: 'node-1', url: 'http://10.30.2.11:8000/node1/status', lightIndex: 1 },
        { id: 'node-2', url: 'http://10.30.2.11:8000/node2/status', lightIndex: 2 },
        { id: 'node-3', url: 'http://10.30.2.11:8000/node3/status', lightIndex: 3 }
      ],
      statusToColorMap: {
        'idle': 1,        // 绿色 - 正常/空闲
        'detecting': 0,   // 红色 - 检测中
        'transmitting': 2, // 黄色 - 发送中
        'error': 0        // 红色 - 错误
      },
      checkInterval: 3000  // 3秒检测一次
    };

    // 启动后台检测任务
    this.startNodeDetectionTask();
  }

  // 启动节点检测任务
  startNodeDetectionTask() {
    if (this.nodeDetectionInterval) {
      clearInterval(this.nodeDetectionInterval);
    }

    this.nodeDetectionInterval = setInterval(() => {
      this.checkNodeStatusAndUpdateLights();
    }, this.nodeDetectionConfig.checkInterval);

    // 立即执行一次
    this.checkNodeStatusAndUpdateLights();
  }

  // 检查节点状态并更新灯光
  async checkNodeStatusAndUpdateLights() {
    if (!window.apiManager || !this.nodeDetectionConfig) return;

    const config = this.nodeDetectionConfig;

    for (const nodeConfig of config.nodes) {
      try {
        // 模拟节点状态检测（实际应该从真实API获取）
        const status = await this.getNodeStatus(nodeConfig.id);
        const colorCode = config.statusToColorMap[status] || 0;

        // 更新对应的灯光
        const light = `light${nodeConfig.lightIndex}`;
        await window.apiManager.changeBaseStationLight(nodeConfig.lightIndex, colorCode);

        console.log(`✓ 节点 ${nodeConfig.id} 状态: ${status} → 灯光${nodeConfig.lightIndex}变为颜色${colorCode}`);
      } catch (error) {
        console.error(`检测节点 ${nodeConfig.id} 失败:`, error);
      }
    }
  }

  // 获取节点状态（模拟或真实）
  async getNodeStatus(nodeId) {
    // TODO: 这里应该真实调用 CM-ZSB API
    // 现在返回模拟数据
    const statusList = ['idle', 'detecting', 'transmitting', 'error'];
    return statusList[Math.floor(Math.random() * statusList.length)];
  }

    // 配置节点信息（与检测节点一致）
    const nodeConfigs = [
      {
        nodeId: 'node-1',
        lightIndex: 1,
        checkUrl: 'http://10.30.2.11:8000/health' // CM-ZSB 或应用的健康检查端点
      },
      {
        nodeId: 'node-2',
        lightIndex: 2,
        checkUrl: 'http://10.30.2.12:8000/health'
      },
      {
        nodeId: 'node-3',
        lightIndex: 3,
        checkUrl: 'http://10.30.2.13:8000/health'
      }
    ];

    window.stationLightMappingManager.initializeNodes(nodeConfigs);

    // 添加自定义状态映射（可选）
    window.stationLightMappingManager.addStatusColorMapping('running', 1); // 绿色
    window.stationLightMappingManager.addStatusColorMapping('warning', 2); // 黄色
    window.stationLightMappingManager.addStatusColorMapping('failed', 0);  // 红色

    // 启动自动监控（每3秒检测一次）
    window.stationLightMappingManager.startMonitoring(3000);

    this.logToConsole('CM-ZSB 与灯光映射已初始化', 'success');

    // 添加控制按钮事件
    this.setupStationLightMappingControls();
  }

  // 设置 CM-ZSB 灯光映射的控制按钮
  setupStationLightMappingControls() {
    // 启动监控按钮
    const startMonitoringBtn = document.getElementById('start-monitoring-btn');
    if (startMonitoringBtn) {
      startMonitoringBtn.addEventListener('click', () => {
        const intervalInput = document.querySelector('#monitoring-interval');
        const interval = intervalInput ? parseInt(intervalInput.value) * 1000 : 3000;
        window.stationLightMappingManager.startMonitoring(interval);
        this.logToConsole(`已启动监控（间隔: ${interval}ms）`, 'success');
      });
    }

    // 停止监控按钮
    const stopMonitoringBtn = document.getElementById('stop-monitoring-btn');
    if (stopMonitoringBtn) {
      stopMonitoringBtn.addEventListener('click', () => {
        window.stationLightMappingManager.stopMonitoring();
        this.logToConsole('已停止监控', 'info');
      });
    }

    // 检测间隔输入框
    const intervalInput = document.querySelector('#monitoring-interval');
    if (intervalInput) {
      intervalInput.addEventListener('change', (e) => {
        const interval = parseInt(e.target.value) * 1000;
        window.stationLightMappingManager.setMonitoringInterval(interval);
        this.logToConsole(`监控间隔已更新为 ${interval}ms`, 'info');
      });
    }

    // 手动检测按钮
    document.querySelectorAll('.manual-check-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const nodeId = btn.dataset.nodeId;
        this.logToConsole(`正在检测节点 ${nodeId}...`, 'info');
        const status = await window.stationLightMappingManager.checkSingleNodeStatus(nodeId);
        const desc = window.stationLightMappingManager.getNodeStatusDescription(nodeId);
        this.logToConsole(`节点 ${nodeId} 状态: ${desc}`, 'success');
        
        // 更新灯光
        const result = await window.stationLightMappingManager.updateSingleLight(nodeId);
        if (!result.success) {
          this.logToConsole(`灯光更新失败: ${result.error}`, 'error');
        }
      });
    });
  }

  setupDetectionUI() {
    // 从Ray集群获取节点列表并显示
    const nodesGrid = document.getElementById('detection-nodes-grid');
    if (!nodesGrid) return;

    // 获取可用节点列表（从Ray集群信息或使用示例节点）
    const nodes = [
      { id: 'node-1', name: '边缘节点 M1', ip: '10.30.2.11', cpu: 8, memory: 16 },
      { id: 'node-2', name: '边缘节点 M2', ip: '10.30.2.12', cpu: 4, memory: 8 },
      { id: 'node-3', name: '边缘节点 M3', ip: '10.30.2.13', cpu: 8, memory: 16 },
    ];

    nodesGrid.innerHTML = nodes.map(node => `
      <div class="node-item" data-node-id="${node.id}">
        <div class="node-item-icon">
          <i class="fas fa-server"></i>
        </div>
        <div class="node-item-info">
          <div class="node-item-name">${node.name}</div>
          <div class="node-item-status">${node.ip} | CPU: ${node.cpu}c | RAM: ${node.memory}GB</div>
        </div>
      </div>
    `).join('');

    // 默认选择第一个节点
    const firstNode = nodesGrid.querySelector('.node-item');
    if (firstNode) {
      firstNode.click();
    }
  }

  setupDetectionEventListeners() {
    // 节点选择
    document.querySelectorAll('.node-item').forEach(item => {
      item.addEventListener('click', (e) => {
        document.querySelectorAll('.node-item').forEach(n => n.classList.remove('selected'));
        item.classList.add('selected');
        this.selectedDetectionNode = item.dataset.nodeId;
      });
    });

    // 检测模式按钮
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        this.startDetection(mode);
      });
    });

    // 重新检测按钮
    const resetBtn = document.getElementById('reset-detection-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetDetectionUI();
      });
    }

    // 灯光控制事件监听
    this.setupLightControlListeners();
  }

  setupLightControlListeners() {
    // 灯光选择按钮
    document.querySelectorAll('.light-select-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.light-select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedLightIndex = btn.dataset.light;
      });
    });

    // 颜色选择按钮
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const colorCode = btn.dataset.color;
        const lightIndex = this.selectedLightIndex || 'all';
        
        this.logToConsole(`正在改变灯光颜色...`, 'info');
        
        try {
          let result;
          if (lightIndex === 'all') {
            result = await window.ueApiManager.changeBaseStationLight(0, parseInt(colorCode));
          } else {
            result = await window.ueApiManager.changeBaseStationLight(parseInt(lightIndex), parseInt(colorCode));
          }
          
          if (result.success) {
            this.updateLightStatus();
            this.logToConsole(`灯光颜色改变成功`, 'success');
          } else {
            this.logToConsole(`灯光颜色改变失败: ${result.error}`, 'error');
          }
        } catch (error) {
          this.logToConsole(`灯光控制异常: ${error.message}`, 'error');
        }
      });
    });

    // 高级操作按钮
    const blinkBtn = document.getElementById('light-blink-btn');
    if (blinkBtn) {
      blinkBtn.addEventListener('click', async () => {
        const lightIndex = this.selectedLightIndex || 'all';
        const colorCode = 0; // 红色闪烁
        
        this.logToConsole(`灯光闪烁中...`, 'info');
        
        try {
          let result;
          if (lightIndex === 'all') {
            result = await window.ueApiManager.blinkBaseStationLight(0, colorCode, 3, 300);
          } else {
            result = await window.ueApiManager.blinkBaseStationLight(
              parseInt(lightIndex), 
              colorCode, 
              3, 
              300
            );
          }
          
          if (result.success) {
            this.logToConsole(`灯光闪烁完成`, 'success');
          } else {
            this.logToConsole(`灯光闪烁失败`, 'error');
          }
        } catch (error) {
          this.logToConsole(`灯光闪烁异常: ${error.message}`, 'error');
        }
      });
    }

    // 序列点亮按钮
    const sequenceBtn = document.getElementById('light-sequence-btn');
    if (sequenceBtn) {
      sequenceBtn.addEventListener('click', async () => {
        this.logToConsole(`执行灯光序列...`, 'info');
        
        try {
          // 全部设为绿色
          await window.ueApiManager.setBaseStationGreen(0);
          await this.delay(500);
          
          // 依次设为红色
          for (let i = 1; i <= 3; i++) {
            await window.ueApiManager.setBaseStationRed(i);
            await this.delay(500);
            await window.ueApiManager.setBaseStationGreen(i);
            await this.delay(300);
          }
          
          this.updateLightStatus();
          this.logToConsole(`灯光序列执行完成`, 'success');
        } catch (error) {
          this.logToConsole(`灯光序列执行失败: ${error.message}`, 'error');
        }
      });
    }

    // 测试连接按钮
    const testBtn = document.getElementById('light-test-btn');
    if (testBtn) {
      testBtn.addEventListener('click', async () => {
        this.logToConsole(`测试UE灯光连接...`, 'info');
        
        try {
          // 通过改变灯光颜色来测试连接
          const result = await window.ueApiManager.setBaseStationGreen(0);
          
          if (result.success) {
            this.logToConsole(`✓ UE灯光连接正常`, 'success');
          } else {
            this.logToConsole(`✗ UE灯光连接失败: ${result.error}`, 'error');
          }
        } catch (error) {
          this.logToConsole(`UE灯光连接异常: ${error.message}`, 'error');
        }
      });
    }

    // 快速控制按钮
    const allGreenBtn = document.getElementById('all-green-btn');
    if (allGreenBtn) {
      allGreenBtn.addEventListener('click', async () => {
        try {
          await window.ueApiManager.setBaseStationGreen(0);
          this.updateLightStatus();
          this.logToConsole(`全部灯光设为绿色`, 'success');
        } catch (error) {
          this.logToConsole(`操作失败: ${error.message}`, 'error');
        }
      });
    }

    const allRedBtn = document.getElementById('all-red-btn');
    if (allRedBtn) {
      allRedBtn.addEventListener('click', async () => {
        try {
          await window.ueApiManager.setBaseStationRed(0);
          this.updateLightStatus();
          this.logToConsole(`全部灯光设为红色`, 'success');
        } catch (error) {
          this.logToConsole(`操作失败: ${error.message}`, 'error');
        }
      });
    }

    const allYellowBtn = document.getElementById('all-yellow-btn');
    if (allYellowBtn) {
      allYellowBtn.addEventListener('click', async () => {
        try {
          await window.ueApiManager.setBaseStationYellow(0);
          this.updateLightStatus();
          this.logToConsole(`全部灯光设为黄色`, 'success');
        } catch (error) {
          this.logToConsole(`操作失败: ${error.message}`, 'error');
        }
      });
    }

    // 初始化默认选择
    this.selectedLightIndex = 'all';
  }

  updateLightStatus() {
    // 更新灯光状态显示
    // 这里可以从API获取实时状态，或者基于最后一个命令更新UI
    const colorNames = ['红色', '绿色', '黄色'];
    
    // 模拟更新显示
    for (let i = 1; i <= 3; i++) {
      const statusEl = document.getElementById(`light${i}-status`);
      if (statusEl) {
        // 这里应该获取实际状态，现在使用默认值
        statusEl.innerHTML = `<i class="fas fa-circle"></i> 绿色`;
        statusEl.classList.remove('green', 'red', 'yellow');
        statusEl.classList.add('green');
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  startDetection(mode) {
    if (!this.selectedDetectionNode) {
      this.logToConsole('请先选择检测节点', 'warning');
      return;
    }

    // 显示进度区域，隐藏结果
    const progressArea = document.querySelector('.detection-progress-area');
    const resultsArea = document.querySelector('.detection-results-area');
    
    if (progressArea) progressArea.style.display = 'flex';
    if (resultsArea) resultsArea.style.display = 'none';

    // 重置进度条
    const progressFill = document.querySelector('.progress-fill');
    const progressPercent = document.querySelector('.progress-percent');
    const progressMessage = document.getElementById('progress-message');
    
    if (progressFill) progressFill.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressMessage) progressMessage.textContent = '正在初始化检测任务...';

    // 调用检测API
    this.runDetectionTask(mode);
  }

  async runDetectionTask(mode) {
    try {
      const nodeId = this.selectedDetectionNode;
      const url = 'http://10.30.2.11:8000/api/station-maintenance/detect';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          node_id: nodeId,
          mode: mode,  // 'auto' 或 'example'
          data_source: mode === 'auto' ? 'realtime' : 'example',
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const taskId = data.task_id;

      this.logToConsole(`检测任务已启动 (Task ID: ${taskId})`, 'info');

      // 开始轮询检测状态
      this.pollDetectionStatus(taskId);

    } catch (error) {
      this.logToConsole(`检测启动失败: ${error.message}`, 'error');
      
      // 显示错误结果
      const resultsArea = document.querySelector('.detection-results-area');
      const progressArea = document.querySelector('.detection-progress-area');
      const resultStatus = document.querySelector('.result-status');
      
      if (progressArea) progressArea.style.display = 'none';
      if (resultsArea) {
        resultsArea.style.display = 'flex';
        if (resultStatus) {
          resultStatus.classList.remove('success');
          resultStatus.classList.add('error');
          resultStatus.textContent = '✗ 检测失败';
        }
      }
    }
  }

  async pollDetectionStatus(taskId) {
    const maxAttempts = 120; // 120秒超时
    let attempts = 0;

    const poll = async () => {
      try {
        const url = `http://10.30.2.11:8000/api/station-maintenance/status/${taskId}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }

        const status = await response.json();

        // 更新进度条和消息
        this.updateDetectionProgress(status);

        // 检查是否完成
        if (status.completed) {
          this.showDetectionResults(status);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          // 1秒后再次轮询
          setTimeout(poll, 1000);
        } else {
          throw new Error('检测超时');
        }

      } catch (error) {
        this.logToConsole(`轮询失败: ${error.message}`, 'error');
        this.showDetectionError(error.message);
      }
    };

    poll();
  }

  updateDetectionProgress(status) {
    const progressFill = document.querySelector('.progress-fill');
    const progressPercent = document.querySelector('.progress-percent');
    const progressStatus = document.querySelector('.progress-status');
    const progressMessage = document.getElementById('progress-message');

    if (progressFill && status.progress) {
      progressFill.style.width = `${status.progress}%`;
    }
    if (progressPercent && status.progress) {
      progressPercent.textContent = `${status.progress}%`;
    }
    if (progressStatus && status.status) {
      progressStatus.textContent = this.getProgressStatusText(status.status);
    }
    if (progressMessage && status.message) {
      progressMessage.textContent = status.message;
    }
  }

  getProgressStatusText(status) {
    const statusMap = {
      'initializing': '初始化中',
      'processing': '处理中',
      'analyzing': '分析中',
      'completed': '已完成',
      'error': '错误',
    };
    return statusMap[status] || status;
  }

  showDetectionResults(status) {
    const progressArea = document.querySelector('.detection-progress-area');
    const resultsArea = document.querySelector('.detection-results-area');
    const resultStatus = document.querySelector('.result-status');

    if (progressArea) progressArea.style.display = 'none';
    if (resultsArea) resultsArea.style.display = 'flex';

    if (resultStatus && status.error) {
      resultStatus.classList.remove('success');
      resultStatus.classList.add('error');
      resultStatus.textContent = '✗ 检测异常';
    } else if (resultStatus) {
      resultStatus.classList.remove('error');
      resultStatus.classList.add('success');
      resultStatus.textContent = '✓ 检测完成';
    }

    // 更新结果显示
    const results = status.results || {};
    const totalSamples = document.getElementById('result-total-samples');
    const highConfidence = document.getElementById('result-high-confidence');
    const lowConfidence = document.getElementById('result-low-confidence');
    const inferenceTime = document.getElementById('result-inference-time');

    if (totalSamples) totalSamples.textContent = results.total_samples || 0;
    if (highConfidence) highConfidence.textContent = results.high_confidence || 0;
    if (lowConfidence) lowConfidence.textContent = results.low_confidence || 0;
    if (inferenceTime) inferenceTime.textContent = `${results.inference_time || 0}ms`;

    this.logToConsole('检测完成', 'success');
  }

  showDetectionError(errorMessage) {
    const resultsArea = document.querySelector('.detection-results-area');
    const progressArea = document.querySelector('.detection-progress-area');
    const resultStatus = document.querySelector('.result-status');

    if (progressArea) progressArea.style.display = 'none';
    if (resultsArea) {
      resultsArea.style.display = 'flex';
      if (resultStatus) {
        resultStatus.classList.remove('success');
        resultStatus.classList.add('error');
        resultStatus.textContent = '✗ 检测失败';
      }
    }
  }

  resetDetectionUI() {
    const progressArea = document.querySelector('.detection-progress-area');
    const resultsArea = document.querySelector('.detection-results-area');
    const progressFill = document.querySelector('.progress-fill');
    const progressPercent = document.querySelector('.progress-percent');
    const progressMessage = document.getElementById('progress-message');
    const modeButtons = document.querySelectorAll('.mode-btn');

    if (progressArea) progressArea.style.display = 'none';
    if (resultsArea) resultsArea.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressMessage) progressMessage.textContent = '准备就绪';
    
    // 清除活跃的模式按钮
    modeButtons.forEach(btn => btn.classList.remove('active'));

    this.logToConsole('检测已重置', 'info');
  }


  switchPage(pageName) {
    this.currentPage = pageName;

    // 更新侧边栏按钮状态
    document.querySelectorAll(".sidebar-tabs .tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === pageName);
    });

    // 切换主内容页面
    document
      .querySelectorAll(".main-content-panel .main-content")
      .forEach((page) => {
        page.classList.toggle("active", page.id === `${pageName}-content-page`);
      });

    // 初始化Ray Cluster管理器（如果切换到rayCluster页面）
    if (pageName === 'rayCluster' && !this.rayClusterManager) {
      this.initRayClusterManager();
    }

    // 初始化文件传输管理器（如果切换到fileTransfer页面）
    if (pageName === 'fileTransfer' && !this.fileTransferManager) {
      this.initFileTransferManager();
    }

    this.logToConsole(`Switched to ${pageName} page`, "info");
  }

  async connectToUE() {
    this.updateConnectionStatus("connecting");
    this.logToConsole("Connecting to UE...", "info");

    try {
      const streamingUrl = document.getElementById("streaming-url")?.value;
      const apiEndpoint = document.getElementById("api-endpoint")?.value;

      // 模拟连接过程
      await this.delay(2000);

      // 检查是否有可用的API管理器
      if (window.ueApiManager) {
        const result = await ueApiManager.testConnection();
        if (result.success) {
          this.updateConnectionStatus("connected");
          this.logToConsole("Successfully connected to UE", "success");
          this.isConnected = true;
        } else {
          throw new Error(result.error || "Connection failed");
        }
      } else {
        // 模拟成功连接
        this.updateConnectionStatus("connected");
        this.logToConsole("Connected to UE (simulation mode)", "success");
        this.isConnected = true;
      }
    } catch (error) {
      this.updateConnectionStatus("disconnected");
      this.logToConsole(`Connection failed: ${error.message}`, "error");
    }
  }

  async connectToDatabase() {
    this.logToConsole("Connecting to database...", "info");

    try {
      const dbHost = document.getElementById("db-host")?.value;
      const dbPort = document.getElementById("db-port")?.value;
      const dbName = document.getElementById("db-name")?.value;

      // 模拟数据库连接
      await this.delay(1500);

      this.logToConsole(
        `Connected to database at ${dbHost}:${dbPort}`,
        "success"
      );
    } catch (error) {
      this.logToConsole(
        `Database connection failed: ${error.message}`,
        "error"
      );
    }
  }

  updateConnectionStatus(status) {
    const indicator = document.getElementById("connection-indicator");
    const dot = indicator?.querySelector(".status-dot");
    const text = indicator?.querySelector("span");

    if (dot) {
      dot.dataset.status = status;
    }

    if (text) {
      switch (status) {
        case "connected":
          text.textContent = "UE Connected";
          break;
        case "connecting":
          text.textContent = "Connecting...";
          break;
        case "disconnected":
          text.textContent = "Disconnected";
          break;
      }
    }
  }

  async startDelivery(from, to) {
    try {
      this.logToConsole(`Starting delivery: ${from} → ${to}`, "info");

      if (window.ueApiManager && this.isConnected) {
        const result = await ueApiManager.startDelivery(from, to);
        if (result.success) {
          this.droneData.mission.status = "EN ROUTE";
          this.droneData.mission.target = to;
          this.logToConsole(`Delivery mission started successfully`, "success");
        } else {
          throw new Error(result.error);
        }
      } else {
        // 模拟配送
        this.droneData.mission.status = "EN ROUTE";
        this.droneData.mission.target = to;
        this.logToConsole(`Delivery mission started (simulation)`, "success");
      }
    } catch (error) {
      this.logToConsole(`Delivery start failed: ${error.message}`, "error");
    }
  }

  async changeView(view) {
    try {
      this.logToConsole(`Changing camera view to: ${view}`, "info");

      if (window.ueApiManager && this.isConnected) {
        const result = await ueApiManager.changeView(view);
        if (result.success) {
          this.logToConsole(`Camera view changed to ${view}`, "success");
        } else {
          throw new Error(result.error);
        }
      } else {
        this.logToConsole(
          `Camera view changed to ${view} (simulation)`,
          "success"
        );
      }
    } catch (error) {
      this.logToConsole(`Camera view change failed: ${error.message}`, "error");
    }
  }

  changeViewType(viewType) {
    this.logToConsole(`View type changed to: ${viewType}`, "info");
  }

  deployStation() {
    const stationType = document.getElementById("station-type")?.value;
    const x = document.getElementById("station-x")?.value;
    const y = document.getElementById("station-y")?.value;
    const z = document.getElementById("station-z")?.value;
    const name = document.getElementById("station-name")?.value;

    if (!stationType || !x || !y || !z || !name) {
      this.logToConsole("Please fill all station deployment fields", "warning");
      return;
    }

    const station = {
      id: `station-${Date.now()}`,
      type: stationType,
      position: { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) },
      name: name,
      status: "active",
    };

    this.stations.push(station);
    this.updateStationsList();
    this.clearStationForm();
    this.logToConsole(
      `Station '${name}' deployed at (${x}, ${y}, ${z})`,
      "success"
    );
    // Also update the scene tree
    this.loadSceneTree();
  }

  updateStationsList() {
    const stationsList = document.getElementById("stations-list");
    if (!stationsList) return;

    stationsList.innerHTML = this.stations
      .map(
        (station) => `
            <div class="station-list-item" data-station-id="${station.id}">
                <span><i class="fas fa-satellite-dish"></i> ${station.name}</span>
                <button class="remove-station-btn" data-station-id="${station.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `
      )
      .join("");

    // Add event listeners for new remove buttons
    stationsList.querySelectorAll(".remove-station-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const stationId = e.currentTarget.dataset.stationId;
        this.removeStation(stationId);
      });
    });
  }

  removeStation(stationId) {
    const stationToRemove = this.stations.find((s) => s.id === stationId);
    if (stationToRemove) {
      this.logToConsole(`Station '${stationToRemove.name}' removed`, "info");
    }
    this.stations = this.stations.filter((station) => station.id !== stationId);
    this.updateStationsList();
    // Also update the scene tree
    this.loadSceneTree();
  }

  clearStationForm() {
    ["station-x", "station-y", "station-z", "station-name"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.value = "";
    });
  }

  attachWorker() {
    this.logToConsole("Searching for available workers...", "info");
    setTimeout(() => {
      this.logToConsole("Worker attached successfully", "success");
    }, 1500);
  }

  startSimulation() {
    this.logToConsole("Starting simulation...", "info");
    setTimeout(() => {
      this.logToConsole("Simulation started", "success");
    }, 1000);
  }

  pauseSimulation() {
    this.logToConsole("Simulation paused", "warning");
  }

  stopSimulation() {
    this.logToConsole("Simulation stopped", "info");
  }

  togglePropertiesPanel() {
    const panel = document.querySelector(".properties-panel");
    panel?.classList.toggle("collapsed");
  }

  initializeDataUpdates() {
    // 实时数据更新
    this.updateInterval = setInterval(() => {
      this.updateDroneData();
      this.updateNetworkData();
      this.updateDisplays();
    }, 2000);

    // 系统时间更新
    setInterval(() => {
      this.updateSystemTime();
    }, 1000);
  }

  updateDroneData() {
    // 模拟无人机数据变化
    if (this.droneData.mission.status === "EN ROUTE") {
      // 模拟移动
      this.droneData.position.x += (Math.random() - 0.5) * 10;
      this.droneData.position.y += (Math.random() - 0.5) * 10;
      this.droneData.speed = 15 + Math.random() * 10;
      this.droneData.battery -= Math.random() * 0.2;
      this.droneData.mission.distance -= Math.random() * 20;

      if (this.droneData.mission.distance <= 0) {
        this.droneData.mission.status = "DELIVERED";
        this.droneData.speed = 0;
        this.logToConsole("Delivery completed", "success");

        setTimeout(() => {
          this.droneData.mission.status = "STANDBY";
          this.droneData.mission.target = "None";
        }, 3000);
      }
    } else {
      // 空闲状态的小幅度变化
      this.droneData.position.x += (Math.random() - 0.5) * 2;
      this.droneData.position.y += (Math.random() - 0.5) * 2;
      this.droneData.speed = Math.random() * 3;
    }

    // 环境数据
    this.droneData.environment.windSpeed = 8 + Math.random() * 15;
    this.droneData.environment.temperature = 20 + Math.random() * 10;
  }

  updateNetworkData() {
    // 模拟网络数据变化
    this.networkData.bandwidth = Math.max(0, 80 + (Math.random() - 0.5) * 20);
    this.networkData.latency = Math.max(5, 10 + (Math.random() - 0.5) * 10);
    this.networkData.signalStrength = Math.max(
      0,
      Math.min(100, 75 + (Math.random() - 0.5) * 30)
    );
    this.networkData.packetLoss = Math.random() * 0.5;
  }

  updateDisplays() {
    // 更新无人机遥测数据
    this.updateElementText("drone-x", this.droneData.position.x.toFixed(2));
    this.updateElementText("drone-y", this.droneData.position.y.toFixed(2));
    this.updateElementText("drone-z", this.droneData.position.z.toFixed(2));
    this.updateElementText(
      "drone-battery",
      `${this.droneData.battery.toFixed(0)}%`
    );
    this.updateElementText(
      "drone-speed",
      `${this.droneData.speed.toFixed(1)} m/s`
    );

    // 更新任务状态
    this.updateElementText("mission-status", this.droneData.mission.status);
    this.updateElementText("mission-target", this.droneData.mission.target);
    this.updateElementText(
      "target-distance",
      `${this.droneData.mission.distance.toFixed(1)} m`
    );
    this.updateElementText(
      "wind-speed",
      `${this.droneData.environment.windSpeed.toFixed(1)} km/h`
    );

    // 更新网络质量
    this.updateMeter("bandwidth", this.networkData.bandwidth, 100);
    this.updateElementText(
      "bandwidth-value",
      `${this.networkData.bandwidth.toFixed(1)} Mbps`
    );
    this.updateMeter("latency", this.networkData.latency, 100, true); // Invert for latency
    this.updateElementText(
      "latency-value",
      `${this.networkData.latency.toFixed(0)} ms`
    );
    this.updateMeter("signal", this.networkData.signalStrength, 100);
    this.updateElementText(
      "signal-value",
      `${this.networkData.signalStrength.toFixed(0)}%`
    );
  }

  updateElementText(id, text) {
    const element = document.getElementById(id);
    if (element && element.textContent !== text) {
      element.textContent = text;
    }
  }

  updateMeter(id, value, max, invert = false) {
    const meterFill = document.getElementById(`${id}-meter`);
    if (meterFill) {
      let percentage = (value / max) * 100;
      if (invert) {
        percentage = 100 - percentage;
      }
      meterFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;

      meterFill.classList.remove("good", "medium", "bad");
      if (percentage > 70) meterFill.classList.add("good");
      else if (percentage > 30) meterFill.classList.add("medium");
      else meterFill.classList.add("bad");
    }
  }

  updateSystemTime() {
    const timeElement = document.getElementById("system-time");
    if (timeElement) {
      const now = new Date();
      timeElement.textContent = now.toLocaleTimeString("en-GB");
    }
  }

  setupConsole() {
    this.logToConsole(
      "Console initialized. Waiting for system logs...",
      "info"
    );
  }

  logToConsole(message, level = "info") {
    const consoleOutput = document.getElementById("console-output");
    if (!consoleOutput) return;

    const now = new Date();
    const timestamp = now.toTimeString().split(" ")[0];

    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `
      <span class="log-time">${timestamp}</span>
      <span class="log-level log-level-${level}">${level.toUpperCase()}</span>
      <span class="log-message">${message}</span>
    `;

    consoleOutput.appendChild(entry);
    consoleOutput.scrollTop = consoleOutput.scrollHeight; // Auto-scroll
  }

  clearConsole() {
    const consoleOutput = document.getElementById("console-output");
    if (consoleOutput) {
      consoleOutput.innerHTML = "";
      this.logToConsole("Console cleared", "info");
    }
  }

  loadSceneTree() {
    const treeContent = document.getElementById("scene-tree-content");
    if (!treeContent) return;

    const sceneData = [
      {
        id: "drone-1",
        name: "Drone Alpha",
        icon: "fa-drone",
        type: "delivery",
      },
      {
        id: "camera-main",
        name: "Main Camera",
        icon: "fa-video",
        type: "camera",
      },
      {
        id: "base-stations",
        name: "Base Stations",
        icon: "fa-broadcast-tower",
        type: "group",
        children: this.stations.map((s) => ({
          id: s.id,
          name: s.name,
          icon: "fa-satellite-dish",
          type: "station",
        })),
      },
      {
        id: "environment",
        name: "Environment",
        icon: "fa-cloud-sun",
        type: "environment",
      },
    ];

    treeContent.innerHTML = this.buildTreeHtml(sceneData);
    this.addTreeEventListeners();
  }

  buildTreeHtml(nodes, depth = 0) {
    return nodes
      .map(
        (node) => `
      <div class="tree-item" data-node-id="${node.id}" data-node-type="${
          node.type
        }" style="--depth: ${depth * 20}px">
        ${
          node.children
            ? `<i class="fas fa-chevron-down tree-item-toggle"></i>`
            : '<span class="tree-item-icon-placeholder"></span>'
        }
        <i class="fas ${node.icon} tree-item-icon"></i>
        <span>${node.name}</span>
      </div>
      ${node.children ? this.buildTreeHtml(node.children, depth + 1) : ""}
    `
      )
      .join("");
  }

  addTreeEventListeners() {
    document.querySelectorAll(".tree-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const target = e.currentTarget;
        const nodeId = target.dataset.nodeId;
        const nodeType = target.dataset.nodeType;

        // Handle selection style
        document
          .querySelectorAll(".tree-item")
          .forEach((i) => i.classList.remove("selected"));
        target.classList.add("selected");

        this.selectedObjectId = nodeId;
        this.showObjectControls(nodeType);
      });
    });
  }

  showObjectControls(objectType) {
    // Hide all control sections first
    document
      .querySelectorAll(".object-properties .control-section")
      .forEach((section) => {
        section.classList.remove("active");
      });

    // Show the relevant control section
    const controlSection = document.getElementById(`${objectType}-controls`);
    if (controlSection) {
      controlSection.classList.add("active");
    } else {
      // Show default if no specific control found
      document.getElementById("default-controls").classList.add("active");
    }
  }

  // 初始化Ray Cluster管理器
  initRayClusterManager() {
    try {
      if (typeof RayClusterManager !== 'undefined') {
        this.rayClusterManager = new RayClusterManager();
        this.rayClusterManager.initialize();
        this.logToConsole("Ray Cluster Manager initialized", "success");
      } else {
        this.logToConsole("RayClusterManager not available", "warning");
      }
    } catch (error) {
      this.logToConsole(`Failed to initialize Ray Cluster Manager: ${error.message}`, "error");
    }
  }

  // 初始化文件传输管理器
  initFileTransferManager() {
    try {
      if (typeof FileTransferManager !== 'undefined') {
        this.fileTransferManager = new FileTransferManager(this);
        this.logToConsole("File Transfer Manager initialized", "success");
      } else {
        this.logToConsole("FileTransferManager not available", "warning");
      }
    } catch (error) {
      this.logToConsole(`Failed to initialize File Transfer Manager: ${error.message}`, "error");
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 启动仪表板管理器
const dashboardManager = new DashboardManager();
// 确保在全局作用域中可用
window.dashboardManager = dashboardManager;
