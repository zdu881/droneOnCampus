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
    // 初始化全局应用配置
    this.initializeAppConfig();
    
    this.setupEventListeners();
    this.initializeDataUpdates();
    this.updateSystemTime();
    this.loadSceneTree();
    this.switchPage("viewport"); // Set initial page

    // 设置初始状态
    this.updateConnectionStatus("connecting");

    // 初始化飞行状态监控
    this.droneFlightMonitor = null;
    this.isDroneFlying = false;
    this.flightStatusCheckInterval = null;

    console.log("Dashboard Manager initialized");
    this.logToConsole("Dashboard Manager initialized", "info");
  }

  // 初始化全局应用配置
  initializeAppConfig() {
    if (!window.appConfig) {
      window.appConfig = {};
    }
    
    // UE Remote Control API
    window.appConfig.ueRemoteControlUrl = window.appConfig.ueRemoteControlUrl || 'http://10.30.2.11:30010';
    
    // CastRay Backend API（内嵌服务，端口 28823 - 支持 REST API 和 WebSocket）
    window.appConfig.castrayApiBase = window.appConfig.castrayApiBase || 'http://10.30.2.11:28823';
    
    // CastRay WebSocket（端口 28823/ws）
    window.appConfig.castrayWsUrl = window.appConfig.castrayWsUrl || 'ws://10.30.2.11:28823/ws';
    
    // Ray/CM-ZSB API（内嵌 CastRay 服务，端口 28823）
    window.appConfig.rayApiBase = window.appConfig.rayApiBase || 'http://10.30.2.11:28823';
    window.appConfig.wsUrl = window.appConfig.wsUrl || 'ws://10.30.2.11:28823/ws';
    
    // Vehicle Agent (可选，本地部署，端口 5000)
    window.appConfig.vehicleAgentUrl = window.appConfig.vehicleAgentUrl || 'http://10.30.2.11:5000/api/agent/decision';
    
    // Pixel Streaming (端口 80)
    window.appConfig.pixelStreamingUrl = window.appConfig.pixelStreamingUrl || 'http://10.30.2.11:80';
    
    // Frontend Server (端口 8080)
    window.appConfig.frontendBase = window.appConfig.frontendBase || 'http://10.30.2.11:8080';
    
    // File Server (端口 8001 - 用于文件下载)
    window.appConfig.fileServerUrl = window.appConfig.fileServerUrl || 'http://10.30.2.11:8001';
    
    console.log('[Config] ✓ App Config initialized');
    console.log('[Config] CastRay API Base:', window.appConfig.castrayApiBase);
    console.log('[Config] CastRay WebSocket URL:', window.appConfig.castrayWsUrl);
    console.log('[Config] Pixel Streaming:', window.appConfig.pixelStreamingUrl);
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

    // 自动驾驶场景视口工具栏
    // 视角切换按钮（单按钮，循环切换）
    const autonomousChangeViewBtn = document.getElementById("autonomous-change-view");
    if (autonomousChangeViewBtn) {
      autonomousChangeViewBtn.addEventListener("click", () => {
        this.changeAutonomousView();
      });
    }

    const autonomousToggleGrid = document.getElementById("autonomous-toggle-grid");
    if (autonomousToggleGrid) {
      autonomousToggleGrid.addEventListener("click", () => {
        this.toggleAutonomousGrid();
      });
    }

    const autonomousToggleCompass = document.getElementById("autonomous-toggle-compass");
    if (autonomousToggleCompass) {
      autonomousToggleCompass.addEventListener("click", () => {
        this.toggleAutonomousCompass();
      });
    }

    const autonomousResetView = document.getElementById("autonomous-reset-view");
    if (autonomousResetView) {
      autonomousResetView.addEventListener("click", () => {
        this.resetAutonomousView();
      });
    }

    const autonomousFullscreenBtn = document.getElementById("autonomous-fullscreen-btn");
    if (autonomousFullscreenBtn) {
      autonomousFullscreenBtn.addEventListener("click", () => {
        this.toggleAutonomousFullscreen();
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

    // 在 Ray 集群页面中切换内容
    const droneNodesPanel = document.getElementById('drone-nodes-panel');
    const vehicleScenarioPanel = document.getElementById('vehicle-scenario-panel');
    
    if (scenario === 'vehicle') {
      // 显示自动驾驶场景内容
      if (droneNodesPanel) droneNodesPanel.style.display = 'none';
      if (vehicleScenarioPanel) vehicleScenarioPanel.style.display = 'block';
      this.initVehicleDetection();
    } else {
      // 显示无人机配送场景内容
      if (droneNodesPanel) droneNodesPanel.style.display = 'block';
      if (vehicleScenarioPanel) vehicleScenarioPanel.style.display = 'none';
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
    try {
      // 预设位置定义
      this.PRESET_LOCATIONS = {
        warehouse: { x: 0, y: 0, z: 100, name: '库房' },
        library: { x: -850, y: -30, z: 62, name: '图书馆' },
        dormitory: { x: 500, y: 400, z: 80, name: '宿舍' },
        cafeteria: { x: -200, y: 300, z: 75, name: '食堂' }
      };

      // 绑定预设位置选择器
      const presetSelector = document.getElementById('preset-location-select');
      if (presetSelector) {
        presetSelector.addEventListener('change', (e) => {
          const preset = e.target.value;
          if (preset && this.PRESET_LOCATIONS[preset]) {
            const location = this.PRESET_LOCATIONS[preset];
            document.getElementById('target-location-x').value = location.x;
            document.getElementById('target-location-y').value = location.y;
            document.getElementById('target-location-z').value = location.z;
            this.logToConsole(`已选择预设位置: ${location.name}`, 'info');
          }
        });
      }

      // 绑定"设置目标位置"按钮
      const setTargetLocationBtn = document.getElementById('set-target-location-btn');
      if (setTargetLocationBtn) {
        setTargetLocationBtn.addEventListener('click', () => {
          this.setDroneTargetLocation();
        });
      }

      // 绑定"开始飞行"按钮
      const startFlightBtn = document.getElementById('start-flight-btn');
      if (startFlightBtn) {
        startFlightBtn.addEventListener('click', () => {
          this.startDroneFlight();
        });
      }

      this.logToConsole('飞行控制已初始化', 'success');
    } catch (error) {
      console.warn('飞行控制初始化失败（可能是库文件未加载）:', error);
      this.logToConsole('飞行控制初始化失败：' + error.message, 'warning');
    }
  }

  // CM-ZSB 与灯光映射初始化
  setupStationLightMapping() {
    // 节点检测配置
    this.nodeDetectionConfig = {
      nodes: [
        { id: 'node-1', url: 'http://10.30.2.11:28823/node1/status', lightIndex: 1 },
        { id: 'node-2', url: 'http://10.30.2.11:28823/node2/status', lightIndex: 2 },
        { id: 'node-3', url: 'http://10.30.2.11:28823/node3/status', lightIndex: 3 }
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
        const lightResult = await window.apiManager.changeBaseStationLight(nodeConfig.lightIndex, colorCode);
        if (lightResult.success) {
          console.log(`✓ 节点 ${nodeConfig.id} 状态: ${status} → 灯光${nodeConfig.lightIndex}变为颜色${colorCode}`);
        }
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

  // 初始化 CM-ZSB 与灯光映射
  initializeCMZSBLightMapping() {
    // 配置节点信息（与检测节点一致）
    const nodeConfigs = [
      {
        nodeId: 'node-1',
        lightIndex: 1,
        checkUrl: 'http://10.30.2.11:28823/health' // CastRay 内嵌服务的健康检查端点
      },
      {
        nodeId: 'node-2',
        lightIndex: 2,
        checkUrl: 'http://10.30.2.12:28823/health'
      },
      {
        nodeId: 'node-3',
        lightIndex: 3,
        checkUrl: 'http://10.30.2.13:28823/health'
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
            result = await window.apiManager.changeBaseStationLight(0, parseInt(colorCode));
          } else {
            result = await window.apiManager.changeBaseStationLight(parseInt(lightIndex), parseInt(colorCode));
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
            result = await window.apiManager.blinkBaseStationLight(0, colorCode, 3, 300);
          } else {
            result = await window.apiManager.blinkBaseStationLight(
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

  // 启动错误测试模式 (演示红色告警)
  startDetectionErrorTest(errorType = 'cloud_rejection') {
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
    if (progressMessage) progressMessage.textContent = '正在启动错误测试...';

    // 清除日志
    this.clearDetectionLog();
    this.addDetectionLog(`*** 错误测试模式已启动 ***`, 'warning');
    this.addDetectionLog(`错误类型: ${this.getErrorTypeLabel(errorType)}`);
    this.addDetectionLog(`此模式用于演示红色告警和错误处理流程`, 'info');

    // 调用错误测试API
    this.runDetectionErrorTest(errorType);
  }

  // 获取错误类型的人类可读标签
  getErrorTypeLabel(errorType) {
    const labels = {
      'cloud_rejection': '云服务拒绝 - 低置信度样本',
      'service_error': '云服务内部错误',
      'timeout': '云处理超时',
      'network_error': '网络连接错误'
    };
    return labels[errorType] || errorType;
  }

  async runDetectionErrorTest(errorType) {
    try {
      const nodeId = this.selectedDetectionNode;
      const url = 'http://10.30.2.11:28823/api/station-maintenance/detect-error-test';
      
      // 切换到初始化状态
      this.setJetIndicators('initializing', '准备错误测试...');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          node_id: nodeId,
          error_type: errorType
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const taskId = data.task_id;

      this.logToConsole(`错误测试任务已启动 (Task ID: ${taskId})`, 'info');
      this.addDetectionLog(`任务ID: ${taskId}`, 'info');
      
      // 切换到本地处理状态
      this.setJetIndicators('local_processing', '开始本地数据处理...');
      
      // 开始轮询检测状态
      this.pollDetectionStatus(taskId);

    } catch (error) {
      this.logToConsole(`错误测试启动失败: ${error.message}`, 'error');
      this.addDetectionLog(`启动错误: ${error.message}`, 'error');
      this.setJetIndicators('error', `启动异常: ${error.message}`);
      
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
          resultStatus.textContent = '✗ 测试失败';
        }
      }
    }
  }

  async runDetectionTask(mode) {
    try {
      const nodeId = this.selectedDetectionNode;
      const url = 'http://10.30.2.11:28823/api/station-maintenance/detect';
      
      // 切换到初始化状态
      this.setJetIndicators('initializing', '准备开始检测...');
      this.addDetectionLog(`检测模式: ${mode === 'auto' ? '自动模式(实时数据)' : '示例模式'}`);
      this.addDetectionLog(`目标节点: ${nodeId}`);

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
      this.addDetectionLog(`任务ID: ${taskId}`, 'info');
      
      // 切换到本地处理状态
      this.setJetIndicators('local_processing', '开始本地数据处理...');
      
      // 开始轮询检测状态
      this.pollDetectionStatus(taskId);

    } catch (error) {
      this.logToConsole(`检测启动失败: ${error.message}`, 'error');
      this.addDetectionLog(`启动错误: ${error.message}`, 'error');
      this.setJetIndicators('error', `启动异常: ${error.message}`);
      
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
    let cloudProcessingDetected = false;
    let lastProgress = 0;

    const poll = async () => {
      try {
        const url = `http://10.30.2.11:28823/api/station-maintenance/status/${taskId}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }

        const status = await response.json();

        // 检查是否开启了云处理 (根据后端返回的标志或根据进度判断)
        if (status.results && status.results.cloud_processing && !cloudProcessingDetected) {
          cloudProcessingDetected = true;
          this.setJetIndicators('cloud_processing', '云端处理中...');
          this.addDetectionLog(`检测到云处理请求: 低置信度样本=${status.results.low_confidence || 0}`, 'warning');
          this.addDetectionLog(`云端服务: 准备上传样本进行云端推理`, 'info');
        }

        // 检查是否有处理状态更新
        if (status.processing_info) {
          this.addDetectionLog(`处理进度: ${status.processing_info}`, 'info');
        }

        // 更新进度条和消息
        this.updateDetectionProgress(status);

        // 记录进度变化
        if (status.progress && status.progress > lastProgress) {
          this.addDetectionLog(`本地处理进度: ${status.progress}%`, 'info');
          lastProgress = status.progress;
        }

        // 检查是否完成
        if (status.completed) {
          this.showDetectionResults(status);
          return;
        }

        // 检查是否有错误
        if (status.error) {
          throw new Error(status.error);
        }

        attempts++;
        if (attempts < maxAttempts) {
          // 1秒后再次轮询
          setTimeout(poll, 1000);
        } else {
          throw new Error('检测超时 (120秒)');
        }

      } catch (error) {
        this.logToConsole(`轮询失败: ${error.message}`, 'error');
        this.addDetectionLog(`轮询异常: ${error.message}`, 'error');
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
    const results = status.results || {};

    if (progressArea) progressArea.style.display = 'none';
    if (resultsArea) resultsArea.style.display = 'flex';

    // 检查是否有错误
    if (status.error) {
      // 错误状态
      if (resultStatus) {
        resultStatus.classList.remove('success');
        resultStatus.classList.add('error');
        resultStatus.textContent = '✗ 检测异常';
      }
      
      // 设置红色告警指示灯
      this.setJetIndicators('error', `检测失败: ${status.error}`);
      this.addDetectionLog(`检测失败: ${status.error}`, 'error');
      
      // 详细错误信息
      if (results.error_detail) {
        this.addDetectionLog(`错误详情: ${results.error_detail}`, 'error');
      }
      if (results.failure_stage) {
        this.addDetectionLog(`失败阶段: ${results.failure_stage}`, 'error');
      }
      if (results.suggested_action) {
        this.addDetectionLog(`建议操作: ${results.suggested_action}`, 'warning');
      }
      
      this.logToConsole(`检测失败: ${status.error}`, 'error');
      return;
    }

    // 成功状态
    if (resultStatus) {
      resultStatus.classList.remove('error');
      resultStatus.classList.add('success');
      resultStatus.textContent = '✓ 检测完成';
    }
    
    // 切换到完成状态 (绿色)
    this.setJetIndicators('completed', '检测成功完成');
    
    // 记录云处理特征信息
    if (results.cloud_processing) {
      this.addDetectionLog(`云处理结果: ${results.cloud_processing_samples || 0}个样本已云端处理`, 'success');
      if (results.cloud_upload_time_ms) {
        this.addDetectionLog(`云上传耗时: ${results.cloud_upload_time_ms}ms`, 'info');
      }
      if (results.cloud_processing_time_ms) {
        this.addDetectionLog(`云处理耗时: ${results.cloud_processing_time_ms}ms`, 'info');
      }
    }

    // 更新结果显示
    const totalSamples = document.getElementById('result-total-samples');
    const highConfidence = document.getElementById('result-high-confidence');
    const lowConfidence = document.getElementById('result-low-confidence');
    const inferenceTime = document.getElementById('result-inference-time');

    if (totalSamples) totalSamples.textContent = results.total_samples || 0;
    if (highConfidence) highConfidence.textContent = results.high_confidence || 0;
    if (lowConfidence) lowConfidence.textContent = results.low_confidence || 0;
    if (inferenceTime) inferenceTime.textContent = `${results.inference_time || 0}ms`;

    // 记录总结信息
    this.addDetectionLog(`统计信息: 总样本=${results.total_samples}, 高置信=${results.high_confidence}, 低置信=${results.low_confidence}`, 'success');
    this.addDetectionLog(`本地推理耗时: ${results.inference_time || 0}ms`, 'success');
    
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
    
    // 设置红色告警
    this.setJetIndicators('error', `系统错误: ${errorMessage}`);
    this.addDetectionLog(`系统错误: ${errorMessage}`, 'error');
    this.addDetectionLog(`请检查服务连接或重启应用`, 'warning');
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

    // 控制场景切换器的显示（仅在 Ray 集群页面显示）
    const scenarioSwitcher = document.getElementById('scenario-switcher');
    if (scenarioSwitcher) {
      scenarioSwitcher.style.display = pageName === 'rayCluster' ? 'flex' : 'none';
    }

    // 初始化Ray Cluster管理器（如果切换到rayCluster页面）
    if (pageName === 'rayCluster' && !this.rayClusterManager) {
      this.initRayClusterManager();
    }

    // 初始化文件传输管理器（如果切换到fileTransfer页面）
    if (pageName === 'fileTransfer' && !this.fileTransferManager) {
      this.initFileTransferManager();
    }

    // 初始化无人机控制页面
    if (pageName === 'droneControl') {
      this.initDroneControlPage();
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
          
          // ✨ 连接成功后，启动飞行状态监控
          this.startDroneFlightMonitoring();
        } else {
          throw new Error(result.error || "Connection failed");
        }
      } else {
        // 模拟成功连接
        this.updateConnectionStatus("connected");
        this.logToConsole("Connected to UE (simulation mode)", "success");
        this.isConnected = true;
        
        // 启动飞行监控
        this.startDroneFlightMonitoring();
      }
    } catch (error) {
      this.updateConnectionStatus("disconnected");
      this.logToConsole(`Connection failed: ${error.message}`, "error");
      
      // 连接失败，停止飞行监控
      this.stopDroneFlightMonitoring();
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

  // 自动驾驶场景视口工具方法
  async changeAutonomousView() {
    try {
      this.logToConsole("Changing autonomous vehicle view...", "info");
      
      // 调用 API Manager 的 changeView 方法
      if (window.apiManager) {
        const result = await window.apiManager.changeView();
        this.logToConsole("View changed successfully", "success");
        return result;
      } else {
        this.logToConsole("API Manager not initialized", "warning");
      }
    } catch (error) {
      console.error("Failed to change view:", error);
      this.logToConsole(`Failed to change view: ${error.message}`, "error");
    }
  }

  // 开始飞行
  async startAutonomousFlight() {
    try {
      this.logToConsole("Starting autonomous vehicle flight...", "info");
      
      // 调用 API Manager 的 triggerDroneAction 方法（调用 Fly 函数）
      if (window.apiManager) {
        const result = await window.apiManager.triggerDroneAction();
        this.logToConsole("Flight started successfully", "success");
        return result;
      } else {
        this.logToConsole("API Manager not initialized", "warning");
      }
    } catch (error) {
      console.error("Failed to start flight:", error);
      this.logToConsole(`Failed to start flight: ${error.message}`, "error");
    }
  }

  // 设置无人机目标位置
  async setDroneTargetLocation() {
    try {
      const xInput = document.getElementById('target-location-x');
      const yInput = document.getElementById('target-location-y');
      const zInput = document.getElementById('target-location-z');

      if (!xInput || !yInput || !zInput) {
        this.logToConsole("Target location inputs not found", "error");
        return;
      }

      const x = parseFloat(xInput.value) || 0;
      const y = parseFloat(yInput.value) || 0;
      const z = parseFloat(zInput.value) || 100;

      this.logToConsole(`Setting target location: (${x}, ${y}, ${z})`, "info");

      if (window.apiManager) {
        const result = await window.apiManager.setDroneLocation(x, y, z);
        if (result.success) {
          this.logToConsole(`Target location set successfully`, "success");
        } else {
          this.logToConsole(`Failed to set target location: ${result.error}`, "error");
        }
        return result;
      } else {
        this.logToConsole("API Manager not initialized", "warning");
      }
    } catch (error) {
      console.error("Failed to set target location:", error);
      this.logToConsole(`Failed to set target location: ${error.message}`, "error");
    }
  }

  // 开始无人机飞行
  async startDroneFlight() {
    try {
      this.logToConsole("Starting drone flight...", "info");

      if (window.apiManager) {
        const result = await window.apiManager.triggerDroneAction();
        if (result.success) {
          this.logToConsole("Drone flight started successfully", "success");
        } else {
          this.logToConsole(`Failed to start drone flight: ${result.error}`, "error");
        }
        return result;
      } else {
        this.logToConsole("API Manager not initialized", "warning");
      }
    } catch (error) {
      console.error("Failed to start drone flight:", error);
      this.logToConsole(`Failed to start drone flight: ${error.message}`, "error");
    }
  }

  toggleAutonomousGrid() {
    const btn = document.getElementById("autonomous-toggle-grid");
    const isActive = btn?.classList.contains("active");
    
    if (btn) {
      btn.classList.toggle("active");
    }
    
    this.logToConsole(`Grid display ${!isActive ? "enabled" : "disabled"}`, "info");
  }

  toggleAutonomousCompass() {
    const btn = document.getElementById("autonomous-toggle-compass");
    const isActive = btn?.classList.contains("active");
    
    if (btn) {
      btn.classList.toggle("active");
    }
    
    this.logToConsole(`Compass display ${!isActive ? "enabled" : "disabled"}`, "info");
  }

  resetAutonomousView() {
    this.logToConsole("Resetting view to default...", "info");
    
    // 重置可以调用 changeView 多次来循环到默认视角
    // 或者可以调用特定的重置方法（如果 UE 中实现了）
    if (window.apiManager) {
      window.apiManager.changeView()
        .catch(error => {
          console.error("Failed to reset view:", error);
        });
    }
  }

  toggleAutonomousFullscreen() {
    const container = document.getElementById("vehicle-scenario-content");
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
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

  // 初始化无人机控制页面
  initDroneControlPage() {
    if (this.droneControlInitialized) return;
    this.droneControlInitialized = true;

    // 视角切换按钮
    const viewChangeBtn = document.getElementById('view-change-btn');
    if (viewChangeBtn) {
      viewChangeBtn.addEventListener('click', () => this.changeView());
    }

    // 预设位置按钮
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const location = e.currentTarget.dataset.location;
        this.setDroneToPresetLocation(location);
      });
    });

    // 设置位置按钮
    const setLocationBtn = document.getElementById('drone-set-location-btn');
    if (setLocationBtn) {
      setLocationBtn.addEventListener('click', () => this.setDroneCustomLocation());
    }

    // 飞行按钮
    const flyBtn = document.getElementById('drone-fly-btn');
    if (flyBtn) {
      flyBtn.addEventListener('click', () => this.startDroneFlight());
    }

    this.logToConsole('Drone control page initialized', 'info');
  }

  // 视角切换
  async changeView() {
    try {
      if (window.ueApiManager) {
        // 诊断：记录对象路径信息
        console.warn('🎬 尝试调用 changeView()');
        console.log('📍 当前使用的 levelScriptActorPath:', window.ueApiManager.levelScriptActorPath);
        
        const result = await window.ueApiManager.changeView();
        console.log('📝 API 返回结果:', result);
        
        // 检查是否成功（success === true）
        if (result && result.success === true) {
          this.logToConsole('✅ 视角已切换！', 'success');
          console.log('🎯 视角切换成功，UE 程序已收到命令');
        } else if (result && result.error) {
          // 对象不存在 - 显示有用的错误信息
          if (result.error.includes('does not exist')) {
            this.logToConsole('⚠️ 错误：对象路径在当前 UE 程序中不存在。请检查 UE 版本或蓝图配置。', 'warning');
            console.error('对象路径错误:', result.error);
          } else {
            this.logToConsole(`❌ 视角切换失败: ${result.error}`, 'error');
            console.error('详细错误:', result.error);
          }
        } else {
          // 未预期的响应格式
          this.logToConsole('⚠️ 视角切换：收到意外的响应格式', 'warning');
          console.warn('意外的响应:', result);
        }
      } else {
        this.logToConsole('ℹ️ 视角切换 (模拟 - UE API 未初始化)', 'info');
        console.warn('⚠️ window.ueApiManager 未初始化，无法调用实际的 UE API');
      }
    } catch (error) {
      this.logToConsole(`❌ 视角切换异常: ${error.message}`, 'error');
      console.error('异常详情:', error);
    }
  }

  // 设置无人机到预设位置
  async setDroneToPresetLocation(locationName) {
    const locations = {
      warehouse: { x: 0, y: 0, z: 100 },
      library: { x: -850, y: -30, z: 62 },
      dormitory: { x: 500, y: 400, z: 80 },
      cafeteria: { x: -200, y: 300, z: 75 }
    };

    const loc = locations[locationName];
    if (loc) {
      document.getElementById('drone-ctrl-x').value = loc.x;
      document.getElementById('drone-ctrl-y').value = loc.y;
      document.getElementById('drone-ctrl-z').value = loc.z;
      await this.setDroneCustomLocation();
    }
  }

  // 设置无人机自定义位置
  async setDroneCustomLocation() {
    const x = parseFloat(document.getElementById('drone-ctrl-x')?.value) || 0;
    const y = parseFloat(document.getElementById('drone-ctrl-y')?.value) || 0;
    const z = parseFloat(document.getElementById('drone-ctrl-z')?.value) || 100;

    try {
      if (window.ueApiManager) {
        const result = await window.ueApiManager.setDroneLocation(x, y, z);
        if (result.success) {
          this.logToConsole(`位置已设置: (${x}, ${y}, ${z})`, 'success');
        }
      } else {
        this.logToConsole(`位置已设置 (模拟): (${x}, ${y}, ${z})`, 'info');
      }
    } catch (error) {
      this.logToConsole(`设置位置失败: ${error.message}`, 'error');
    }
  }

  // 初始化自动驾驶检测功能
  initVehicleDetection() {
    if (this.vehicleDetectionInitialized) return;
    this.vehicleDetectionInitialized = true;

    // 开始检测按钮
    const startBtn = document.getElementById('start-detection-btn');
    const stopBtn = document.getElementById('stop-detection-btn');
    const clearLogBtn = document.getElementById('clear-detection-log');

    if (startBtn) {
      startBtn.addEventListener('click', () => this.startStationDetection());
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopStationDetection());
    }
    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', () => this.clearDetectionLog());
    }

    // 初始化 Jet 节点模拟数据更新
    this.startJetNodesSimulation();
    
    this.logToConsole('Vehicle detection initialized', 'info');
  }

  // 开始基站检测
  async startStationDetection() {
    const startBtn = document.getElementById('start-detection-btn');
    const stopBtn = document.getElementById('stop-detection-btn');
    const statusBadge = document.getElementById('detection-status-badge');
    const progressBar = document.getElementById('detection-progress');
    const progressText = document.getElementById('detection-progress-text');

    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;

    this.detectionRunning = true;
    this.addDetectionLog('开始基站检测任务', 'info');
    
    // 阶段1: 检测中 - 设置为红色
    this.updateDetectionStatus('detecting', '检测中');
    this.setJetIndicators('red');
    this.addDetectionLog('Jet1, Jet2, Jet3 开始数据采集...', 'info');
    await this.updateProgress(0, 30, 2000);

    if (!this.detectionRunning) return;
    
    // 阶段2: 等待结果 - 设置为黄色
    this.updateDetectionStatus('waiting', '等待结果');
    this.setJetIndicators('yellow');
    this.addDetectionLog('数据采集完成，正在分析...', 'info');
    await this.updateProgress(30, 70, 2000);

    if (!this.detectionRunning) return;

    this.addDetectionLog('正在传输检测结果...', 'info');
    await this.updateProgress(70, 95, 1500);

    if (!this.detectionRunning) return;
    
    // 阶段3: 已到达 - 设置为绿色
    this.updateDetectionStatus('completed', '已到达');
    this.setJetIndicators('green');
    this.addDetectionLog('检测任务完成，所有基站状态正常', 'success');
    await this.updateProgress(95, 100, 500);

    // 重置按钮状态
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    this.detectionRunning = false;
  }

  // 停止基站检测
  stopStationDetection() {
    this.detectionRunning = false;
    const startBtn = document.getElementById('start-detection-btn');
    const stopBtn = document.getElementById('stop-detection-btn');

    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;

    this.updateDetectionStatus('idle', '已停止');
    this.setJetIndicators('green');
    this.addDetectionLog('检测任务已停止', 'warning');
  }

  // 更新检测状态
  updateDetectionStatus(status, text) {
    const badge = document.getElementById('detection-status-badge');
    if (badge) {
      badge.className = `status-badge ${status}`;
      badge.textContent = text;
    }
  }

  // 更新进度条
  async updateProgress(from, to, duration) {
    const progressBar = document.getElementById('detection-progress');
    const progressText = document.getElementById('detection-progress-text');
    const steps = to - from;
    const stepDuration = duration / steps;

    for (let i = from; i <= to && this.detectionRunning; i++) {
      if (progressBar) progressBar.style.width = `${i}%`;
      if (progressText) progressText.textContent = `${i}%`;
      await this.delay(stepDuration);
    }
  }

  // 设置 Jet 节点指示灯颜色和状态（增强版本）
  setJetIndicators(colorOrState, additionalInfo = null) {
    // Jet1/2/3 对应基站灯 0/1/2
    const jetToLightMap = { 'jet1': 0, 'jet2': 1, 'jet3': 2 };
    
    // 状态映射到颜色和说明
    const stateMapping = {
      'initializing': { color: 'green', label: '绿色(正常)', ueColor: 1 },
      'local_processing': { color: 'yellow', label: '黄色(本地处理中)', ueColor: 2 },
      'cloud_processing': { color: 'yellow', label: '黄色(云端处理中)', ueColor: 2 },
      'completed': { color: 'green', label: '绿色(完成)', ueColor: 1 },
      'error': { color: 'red', label: '红色(错误)', ueColor: 0 },
      // 向后兼容: 直接颜色名称
      'red': { color: 'red', label: '红色(错误)', ueColor: 0 },
      'yellow': { color: 'yellow', label: '黄色(处理中)', ueColor: 2 },
      'green': { color: 'green', label: '绿色(正常)', ueColor: 1 }
    };
    
    // 获取映射信息
    const stateInfo = stateMapping[colorOrState];
    if (!stateInfo) {
      console.error(`Unknown state/color: ${colorOrState}`);
      return;
    }
    
    const { color, label, ueColor } = stateInfo;
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    
    // 更新指示灯
    ['jet1', 'jet2', 'jet3'].forEach(jet => {
      // 更新前端指示灯
      const indicator = document.querySelector(`#${jet}-indicator .indicator-light`);
      if (indicator) {
        indicator.className = `indicator-light ${color}`;
      }

      // 同时控制 UE 内对应的基站灯
      if (window.apiManager) {
        const lightIndex = jetToLightMap[jet];
        window.apiManager.changeBaseStationLight(lightIndex, ueColor).catch(err => {
          console.log(`UE light ${lightIndex} control failed:`, err.message);
        });
      }
    });

    // 生成日志消息
    let logMessage = `[${timestamp}] 基站指示灯已切换为: ${label}`;
    if (additionalInfo) {
      logMessage += ` - ${additionalInfo}`;
    }
    
    // 根据状态类型决定日志级别
    let logLevel = 'info';
    if (colorOrState.includes('error')) {
      logLevel = 'error';
    } else if (colorOrState.includes('processing')) {
      logLevel = 'warning';
    } else if (colorOrState === 'completed') {
      logLevel = 'success';
    }
    
    this.addDetectionLog(logMessage, logLevel);
    
    // 记录状态转换到内部追踪
    if (!this.detectionStateHistory) {
      this.detectionStateHistory = [];
    }
    this.detectionStateHistory.push({
      state: colorOrState,
      timestamp: timestamp,
      info: additionalInfo
    });
  }

  // 添加检测日志
  addDetectionLog(message, type = 'info') {
    const logContainer = document.getElementById('detection-log');
    if (!logContainer) return;

    const time = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-message">${message}</span>
    `;

    // 移除初始占位符
    const placeholder = logContainer.querySelector('.log-entry.info:first-child');
    if (placeholder && placeholder.querySelector('.log-message').textContent === '等待开始检测...') {
      placeholder.remove();
    }

    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  // 清除检测日志
  clearDetectionLog() {
    const logContainer = document.getElementById('detection-log');
    if (logContainer) {
      logContainer.innerHTML = `
        <div class="log-entry info">
          <span class="log-time">--:--:--</span>
          <span class="log-message">等待开始检测...</span>
        </div>
      `;
    }
  }

  // 启动 Jet 节点模拟数据更新
  startJetNodesSimulation() {
    if (this.jetSimulationInterval) return;

    this.jetSimulationInterval = setInterval(() => {
      ['jet1', 'jet2', 'jet3'].forEach(jet => {
        // 随机波动模拟
        const cpuBase = jet === 'jet1' ? 45 : (jet === 'jet2' ? 52 : 35);
        const memBase = jet === 'jet1' ? 62 : (jet === 'jet2' ? 58 : 48);
        const gpuBase = jet === 'jet1' ? 38 : (jet === 'jet2' ? 45 : 28);

        const cpu = Math.min(100, Math.max(0, cpuBase + (Math.random() - 0.5) * 10));
        const mem = Math.min(100, Math.max(0, memBase + (Math.random() - 0.5) * 8));
        const gpu = Math.min(100, Math.max(0, gpuBase + (Math.random() - 0.5) * 12));

        // 更新进度条
        const cpuBar = document.getElementById(`${jet}-cpu`);
        const memBar = document.getElementById(`${jet}-mem`);
        const gpuBar = document.getElementById(`${jet}-gpu`);
        const cpuVal = document.getElementById(`${jet}-cpu-value`);
        const memVal = document.getElementById(`${jet}-mem-value`);
        const gpuVal = document.getElementById(`${jet}-gpu-value`);

        if (cpuBar) cpuBar.style.width = `${cpu}%`;
        if (memBar) memBar.style.width = `${mem}%`;
        if (gpuBar) gpuBar.style.width = `${gpu}%`;
        if (cpuVal) cpuVal.textContent = `${Math.round(cpu)}%`;
        if (memVal) memVal.textContent = `${Math.round(mem)}%`;
        if (gpuVal) gpuVal.textContent = `${Math.round(gpu)}%`;
      });
    }, 2000);
  }

  // 【核心】启动无人机飞行状态实时监控
  startDroneFlightMonitoring() {
    if (this.flightStatusCheckInterval) {
      console.log('⚠️ Flight monitoring already running');
      return;
    }

    console.log('🎯 Starting drone flight status monitoring...');
    this.logToConsole('Starting drone flight monitoring', 'info');

    // 每 500ms 检查一次飞行状态
    this.flightStatusCheckInterval = setInterval(async () => {
      try {
        if (window.apiManager) {
          const result = await window.apiManager.isUAVFlying();
          
          if (result.success) {
            const nowFlying = result.isFlying;
            
            // 状态变化时触发事件
            if (nowFlying && !this.isDroneFlying) {
              this.isDroneFlying = true;
              console.log('✈️ DRONE FLIGHT STARTED');
              this.logToConsole('✈️ Drone flight started', 'success');
              this.broadcastFlightEvent('started', result);
            } else if (!nowFlying && this.isDroneFlying) {
              this.isDroneFlying = false;
              console.log('🛑 DRONE FLIGHT STOPPED');
              this.logToConsole('🛑 Drone flight stopped', 'info');
              this.broadcastFlightEvent('stopped', result);
            }
          }
        }
      } catch (error) {
        console.error('Error checking flight status:', error);
      }
    }, 500); // 检查间隔：500ms
  }

  // 停止飞行状态监控
  stopDroneFlightMonitoring() {
    if (this.flightStatusCheckInterval) {
      clearInterval(this.flightStatusCheckInterval);
      this.flightStatusCheckInterval = null;
      console.log('🎯 Flight monitoring stopped');
      this.logToConsole('Flight monitoring stopped', 'info');
    }
  }

  // 广播飞行事件（可发送至 WebSocket、Electron 应用等）
  broadcastFlightEvent(eventType, data = {}) {
    // 事件 1: 发送至全局窗口事件
    const event = new CustomEvent(`drone:flight:${eventType}`, {
      detail: {
        type: eventType,
        timestamp: Date.now(),
        data: data
      }
    });
    window.dispatchEvent(event);

    // 事件 2: 如果有 WebSocket 连接，发送远程事件
    if (window.wsManager) {
      try {
        window.wsManager.send({
          type: 'drone:flight:event',
          event: eventType,
          data: data,
          timestamp: Date.now()
        });
      } catch (error) {
        console.warn('Failed to send WebSocket event:', error);
      }
    }

    // 事件 3: 显示通知
    this.showFlightNotification(eventType);
  }

  // 显示飞行状态通知
  showFlightNotification(eventType) {
    const message = eventType === 'started' 
      ? '🚁 无人机开始飞行' 
      : '🛬 无人机停止飞行';
    
    this.logToConsole(message, eventType === 'started' ? 'success' : 'info');

    // 可选: 添加页面通知
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${eventType === 'started' ? '#10b981' : '#f97316'};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-weight: 600;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 启动仪表板管理器
const dashboardManager = new DashboardManager();
// 确保在全局作用域中可用
window.dashboardManager = dashboardManager;
