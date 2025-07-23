/**
 * Dashboard Manager - 专业仪表板管理器
 * 基于NVIDIA Aerial GUI设计理念实现
 */

class DashboardManager {
  constructor() {
    this.currentScenario = "drone";
    this.currentTab = "configuration";
    this.isConnected = false;
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
    this.setupConsole();
    this.loadSceneTree();

    // 设置初始状态
    this.updateConnectionStatus("connecting");

    console.log("Dashboard Manager initialized");
    this.logToConsole("Dashboard Manager initialized", "info");
  }

  setupEventListeners() {
    // 场景切换
    document.querySelectorAll(".scenario-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchScenario(e.target.dataset.scenario);
      });
    });

    // 底部标签切换
    document.querySelectorAll(".bottom-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchBottomTab(e.target.dataset.content);
      });
    });

    // 侧边栏标签（暂时只是样式切换）
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchSideTab(e.target.dataset.tab);
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

  switchBottomTab(tabName) {
    this.currentTab = tabName;

    // 更新标签按钮状态
    document.querySelectorAll(".bottom-tab-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.content === tabName) {
        btn.classList.add("active");
      }
    });

    // 显示对应内容
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });

    const targetContent = document.getElementById(`${tabName}-content`);
    if (targetContent) {
      targetContent.classList.add("active");
    }
  }

  switchSideTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.tab === tabName) {
        btn.classList.add("active");
      }
    });

    this.logToConsole(`Switched to ${tabName} view`, "info");
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
      id: Date.now(),
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
  }

  updateStationsList() {
    const stationsList = document.getElementById("stations-list");
    if (!stationsList) return;

    stationsList.innerHTML = this.stations
      .map(
        (station) => `
            <div class="station-item" data-station-id="${station.id}">
                <div class="station-info">
                    <span class="station-name">${station.name}</span>
                    <span class="station-type">${station.type}</span>
                    <span class="station-position">(${station.position.x}, ${station.position.y}, ${station.position.z})</span>
                </div>
                <button class="remove-station-btn" onclick="dashboardManager.removeStation(${station.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `
      )
      .join("");
  }

  removeStation(stationId) {
    this.stations = this.stations.filter((station) => station.id !== stationId);
    this.updateStationsList();
    this.logToConsole(`Station removed`, "info");
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
    const btn = document.getElementById("collapse-properties");
    const icon = btn?.querySelector("i");

    if (panel.style.display === "none") {
      panel.style.display = "flex";
      if (icon) icon.classList.replace("fa-chevron-left", "fa-chevron-right");
    } else {
      panel.style.display = "none";
      if (icon) icon.classList.replace("fa-chevron-right", "fa-chevron-left");
    }
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
    this.networkData.packetLoss = Math.max(0, Math.random() * 0.5);
  }

  updateDisplays() {
    // 更新无人机遥测数据
    this.updateElement("drone-x", this.droneData.position.x.toFixed(2));
    this.updateElement("drone-y", this.droneData.position.y.toFixed(2));
    this.updateElement("drone-z", this.droneData.position.z.toFixed(2) + "m");
    this.updateElement("drone-speed", this.droneData.speed.toFixed(1) + " m/s");

    // 电池状态带颜色
    const batteryElement = document.getElementById("drone-battery");
    if (batteryElement) {
      batteryElement.textContent = this.droneData.battery.toFixed(1) + "%";
      batteryElement.className = "value";
      if (this.droneData.battery < 20) {
        batteryElement.classList.add("danger");
      } else if (this.droneData.battery < 40) {
        batteryElement.classList.add("warning");
      }
    }

    // 更新任务状态
    const statusElement = document.getElementById("mission-status");
    if (statusElement) {
      statusElement.textContent = this.droneData.mission.status;
      statusElement.className = "value";
      if (this.droneData.mission.status === "EN ROUTE") {
        statusElement.classList.add("warning");
      }
    }

    this.updateElement("mission-target", this.droneData.mission.target);
    this.updateElement(
      "target-distance",
      this.droneData.mission.distance.toFixed(1) + "m"
    );
    this.updateElement(
      "wind-speed",
      this.droneData.environment.windSpeed.toFixed(1) + " km/h"
    );

    // 更新网络质量仪表
    this.updateMeter("bandwidth", this.networkData.bandwidth, 100);
    this.updateMeter("latency", 100 - this.networkData.latency, 100); // 延迟越低越好
    this.updateMeter("signal", this.networkData.signalStrength, 100);

    this.updateElement(
      "bandwidth-value",
      this.networkData.bandwidth.toFixed(1) + " Mbps"
    );
    this.updateElement(
      "latency-value",
      this.networkData.latency.toFixed(0) + " ms"
    );
    this.updateElement(
      "signal-value",
      this.networkData.signalStrength.toFixed(0) + "%"
    );
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      // 添加更新动画效果
      element.classList.add("updating");
      element.textContent = value;

      // 移除动画类
      setTimeout(() => {
        element.classList.remove("updating");
      }, 600);
    }
  }

  updateMeter(meterType, value, max) {
    const meterFill = document.getElementById(`${meterType}-meter`);
    if (meterFill) {
      const percentage = Math.max(0, Math.min(100, (value / max) * 100));
      meterFill.style.width = percentage + "%";
    }
  }

  updateSystemTime() {
    const timeElement = document.getElementById("system-time");
    if (timeElement) {
      const now = new Date();
      const timeString = now.toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      timeElement.textContent = timeString;
    }
  }

  setupConsole() {
    const consoleOutput = document.getElementById("console-output");
    if (consoleOutput) {
      this.consoleOutput = consoleOutput;
    }
  }

  logToConsole(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString("zh-CN");
    const logEntry = {
      timestamp,
      message,
      type,
    };

    this.consoleMessages.push(logEntry);

    // 限制消息数量
    if (this.consoleMessages.length > 100) {
      this.consoleMessages.shift();
    }

    this.updateConsoleDisplay();
  }

  updateConsoleDisplay() {
    if (!this.consoleOutput) return;

    const messageHTML = this.consoleMessages
      .map((entry) => {
        const colorClass =
          entry.type === "error"
            ? "color: #ef4444"
            : entry.type === "warning"
            ? "color: #f59e0b"
            : entry.type === "success"
            ? "color: #10b981"
            : "color: #b4b8c1";

        return `<div style="${colorClass}">[${entry.timestamp}] ${entry.message}</div>`;
      })
      .join("");

    this.consoleOutput.innerHTML = messageHTML;
    this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
  }

  clearConsole() {
    this.consoleMessages = [];
    this.updateConsoleDisplay();
  }

  loadSceneTree() {
    const sceneTreeContent = document.getElementById("scene-tree-content");
    if (!sceneTreeContent) return;

    const sceneData = [
      {
        name: "Environment",
        type: "folder",
        children: ["Lighting", "Weather", "Terrain"],
      },
      {
        name: "Drone",
        type: "object",
        children: ["Position", "Rotation", "Battery"],
      },
      {
        name: "Stations",
        type: "folder",
        children: this.stations.map((s) => s.name),
      },
      {
        name: "Routes",
        type: "folder",
        children: ["Campus_Gate", "Library", "Cafeteria", "Dormitory"],
      },
    ];

    // 简化的场景树显示
    sceneTreeContent.innerHTML = sceneData
      .map(
        (item) => `
            <div class="tree-item">
                <i class="fas fa-${
                  item.type === "folder" ? "folder" : "cube"
                }"></i>
                <span>${item.name}</span>
            </div>
        `
      )
      .join("");
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

// 全局初始化
let dashboardManager;

document.addEventListener("DOMContentLoaded", () => {
  dashboardManager = new DashboardManager();
  window.dashboardManager = dashboardManager; // 全局访问
});

// 导出给其他模块使用
if (typeof module !== "undefined" && module.exports) {
  module.exports = DashboardManager;
}
