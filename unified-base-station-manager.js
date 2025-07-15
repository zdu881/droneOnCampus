// 统一面板基站管理器
class UnifiedBaseStationManager {
  constructor() {
    this.stations = new Map();
    this.nextStationId = 1;
    this.stationTypes = {
      charging: {
        name: "充电基站",
        icon: "🔋",
        color: "#28a745",
        description: "无人机充电和停靠",
      },
      communication: {
        name: "通信基站",
        icon: "📡",
        color: "#007bff",
        description: "信号中继和数据传输",
      },
      weather: {
        name: "气象站",
        icon: "🌡️",
        color: "#ffc107",
        description: "环境数据监测",
      },
      security: {
        name: "安全基站",
        icon: "🛡️",
        color: "#dc3545",
        description: "监控和报警设备",
      },
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadDefaultStations();
    this.updateUI();
  }

  setupEventListeners() {
    // 添加基站按钮
    const addBtn = document.getElementById("add-station-btn");
    if (addBtn) {
      addBtn.addEventListener("click", () => this.addStation());
    }
  }

  addStation() {
    const typeSelect = document.getElementById("station-type-select");
    const xInput = document.getElementById("station-x");
    const yInput = document.getElementById("station-y");
    const zInput = document.getElementById("station-z");
    const nameInput = document.getElementById("station-name");

    if (!typeSelect || !xInput || !yInput || !zInput || !nameInput) {
      console.error("基站输入元素未找到");
      return;
    }

    const type = typeSelect.value;
    const x = parseFloat(xInput.value) || 0;
    const y = parseFloat(yInput.value) || 0;
    const z = parseFloat(zInput.value) || 0;
    const name =
      nameInput.value.trim() ||
      `${this.stationTypes[type].name}_${this.nextStationId}`;

    const station = {
      id: this.nextStationId++,
      type: type,
      name: name,
      position: { x, y, z },
      status: "online",
      typeInfo: this.stationTypes[type],
      createdAt: new Date(),
      lastUpdate: new Date(),
    };

    this.stations.set(station.id, station);

    // 清空输入
    xInput.value = "";
    yInput.value = "";
    zInput.value = "";
    nameInput.value = "";

    // 更新UI
    this.updateUI();

    // 调用API添加基站（如果API管理器可用）
    if (window.apiManager) {
      window.apiManager
        .addStation(type, x, y, z, name)
        .then((result) => {
          console.log("基站添加成功:", result);
        })
        .catch((error) => {
          console.error("基站添加失败:", error);
        });
    }

    console.log(`添加基站: ${name} (${type}) at (${x}, ${y}, ${z})`);
  }

  removeStation(stationId) {
    if (this.stations.has(stationId)) {
      const station = this.stations.get(stationId);
      this.stations.delete(stationId);
      this.updateUI();

      // 调用API删除基站
      if (window.apiManager) {
        window.apiManager
          .removeStation(stationId)
          .then((result) => {
            console.log("基站删除成功:", result);
          })
          .catch((error) => {
            console.error("基站删除失败:", error);
          });
      }

      console.log(`删除基站: ${station.name}`);
    }
  }

  updateStationStatus(stationId, status) {
    if (this.stations.has(stationId)) {
      const station = this.stations.get(stationId);
      station.status = status;
      station.lastUpdate = new Date();
      this.updateUI();

      // 调用API更新状态
      if (window.apiManager) {
        window.apiManager
          .updateStationStatus(stationId, status)
          .then((result) => {
            console.log("基站状态更新成功:", result);
          })
          .catch((error) => {
            console.error("基站状态更新失败:", error);
          });
      }
    }
  }

  updateUI() {
    this.updateStationsList();
    this.updateStationsStats();
  }

  updateStationsList() {
    const stationsList = document.getElementById("stations-list");
    if (!stationsList) return;

    stationsList.innerHTML = "";

    if (this.stations.size === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "empty-message";
      emptyMsg.textContent = "暂无基站";
      emptyMsg.style.cssText = `
        text-align: center;
        color: var(--text-muted);
        padding: 20px;
        font-size: 12px;
      `;
      stationsList.appendChild(emptyMsg);
      return;
    }

    this.stations.forEach((station) => {
      const stationItem = this.createStationItem(station);
      stationsList.appendChild(stationItem);
    });
  }

  createStationItem(station) {
    const item = document.createElement("div");
    item.className = "station-item";

    item.innerHTML = `
      <div class="station-info">
        <span class="station-type-icon">${station.typeInfo.icon}</span>
        <div class="station-details">
          <div class="station-name">${station.name}</div>
          <div class="station-location">
            X:${station.position.x} Y:${station.position.y} Z:${
      station.position.z
    }
          </div>
        </div>
        <div class="station-status ${station.status}"></div>
      </div>
      <div class="station-controls">
        <button class="station-btn" onclick="unifiedBaseStationManager.toggleStationStatus(${
          station.id
        })">
          ${station.status === "online" ? "停用" : "启用"}
        </button>
        <button class="station-btn delete" onclick="unifiedBaseStationManager.removeStation(${
          station.id
        })">
          删除
        </button>
      </div>
    `;

    return item;
  }

  toggleStationStatus(stationId) {
    if (this.stations.has(stationId)) {
      const station = this.stations.get(stationId);
      const newStatus = station.status === "online" ? "offline" : "online";
      this.updateStationStatus(stationId, newStatus);
    }
  }

  updateStationsStats() {
    const totalElement = document.getElementById("total-stations");
    const onlineElement = document.getElementById("online-stations");
    const failedElement = document.getElementById("failed-stations");

    if (!totalElement || !onlineElement || !failedElement) return;

    const total = this.stations.size;
    const online = Array.from(this.stations.values()).filter(
      (s) => s.status === "online"
    ).length;
    const failed = Array.from(this.stations.values()).filter(
      (s) => s.status === "error"
    ).length;

    totalElement.textContent = total;
    onlineElement.textContent = online;
    failedElement.textContent = failed;
  }

  loadDefaultStations() {
    // 添加一些默认基站
    const defaultStations = [
      { type: "charging", name: "主充电站", x: 0, y: 0, z: 0 },
      { type: "communication", name: "中央通信塔", x: 100, y: 100, z: 50 },
      { type: "weather", name: "气象监测站", x: -50, y: 150, z: 20 },
      { type: "security", name: "安全监控点", x: 200, y: -100, z: 30 },
    ];

    defaultStations.forEach((stationData) => {
      const station = {
        id: this.nextStationId++,
        type: stationData.type,
        name: stationData.name,
        position: { x: stationData.x, y: stationData.y, z: stationData.z },
        status: "online",
        typeInfo: this.stationTypes[stationData.type],
        createdAt: new Date(),
        lastUpdate: new Date(),
      };

      this.stations.set(station.id, station);
    });
  }

  // 获取基站统计信息
  getStationStats() {
    const total = this.stations.size;
    const byType = {};
    const byStatus = {};

    this.stations.forEach((station) => {
      byType[station.type] = (byType[station.type] || 0) + 1;
      byStatus[station.status] = (byStatus[station.status] || 0) + 1;
    });

    return {
      total,
      byType,
      byStatus,
    };
  }

  // 获取指定类型的基站
  getStationsByType(type) {
    return Array.from(this.stations.values()).filter(
      (station) => station.type === type
    );
  }

  // 获取在线基站
  getOnlineStations() {
    return Array.from(this.stations.values()).filter(
      (station) => station.status === "online"
    );
  }
}

// 全局实例
let unifiedBaseStationManager;

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  // 延迟初始化，确保统一面板管理器先加载
  setTimeout(() => {
    unifiedBaseStationManager = new UnifiedBaseStationManager();

    // 将实例暴露给全局作用域
    window.unifiedBaseStationManager = unifiedBaseStationManager;

    console.log("统一基站管理器初始化完成");
  }, 500);
});
