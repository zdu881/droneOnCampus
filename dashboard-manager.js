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

    this.logToConsole(`Switched to ${scenario} scenario`, "info");
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

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 启动仪表板管理器
const dashboardManager = new DashboardManager();
