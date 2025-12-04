// 自动驾驶汽车场景管理器
class VehicleScenarioManager {
  constructor() {
    this.currentScenario = "drone"; // 默认场景
    this.vehiclePosition = { x: 0, y: 0 };
    this.vehicleSpeed = 0;
    this.vehicleDirection = "North";
    this.currentRoute = null;
    this.autoHandoverEnabled = true;
    this.currentMEC = "east"; // 默认连接东区MEC

    // MEC服务器配置
    this.mecServers = {
      east: {
        name: "东区MEC",
        ip: "192.168.1.10",
        position: { x: 1000, y: 0 },
        latency: 0,
      },
      west: {
        name: "西区MEC",
        ip: "192.168.1.20",
        position: { x: -1000, y: 0 },
        latency: 0,
      },
      north: {
        name: "北区MEC",
        ip: "192.168.1.30",
        position: { x: 0, y: 1000 },
        latency: 0,
      },
    };

    // 预定义路线
    this.routes = {
      "city-loop": [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 500 },
        { x: -500, y: 500 },
        { x: -500, y: -500 },
        { x: 0, y: 0 },
      ],
      "east-west": [
        { x: -800, y: 0 },
        { x: 800, y: 0 },
      ],
      "north-south": [
        { x: 0, y: -800 },
        { x: 0, y: 800 },
      ],
    };

    this.currentRouteIndex = 0;
    this.isMoving = false;
    this.movementInterval = null;
    this.updateInterval = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.startPositionUpdates();
  }

  setupEventListeners() {
    // 场景切换按钮
    document.querySelectorAll(".scenario-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchScenario(e.target.dataset.scenario);
      });
    });

    // 路线选择按钮
    document.querySelectorAll(".route-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.startRoute(e.target.dataset.route);
      });
    });

    // 自动切换开关
    const autoHandoverCheckbox = document.getElementById(
      "auto-handover-enabled"
    );
    if (autoHandoverCheckbox) {
      autoHandoverCheckbox.addEventListener("change", (e) => {
        this.autoHandoverEnabled = e.target.checked;
      });
    }
  }

  switchScenario(scenario) {
    this.currentScenario = scenario;

    // 委托给统一面板管理器
    if (window.unifiedPanelManager) {
      window.unifiedPanelManager.switchScenario(scenario);
    } else {
      // 兼容性处理 - 如果统一面板管理器还未加载
      setTimeout(() => {
        if (window.unifiedPanelManager) {
          window.unifiedPanelManager.switchScenario(scenario);
        }
      }, 100);
    }
  }

  showVehicleScenario() {
    // 这个方法现在由统一面板管理器处理
    console.log("切换到车辆场景");
  }

  showDroneScenario() {
    // 这个方法现在由统一面板管理器处理
    console.log("切换到无人机场景");
  }

  startRoute(routeName) {
    if (!this.routes[routeName]) {
      console.error(`路线 ${routeName} 不存在`);
      return;
    }

    // 停止当前移动
    this.stopMovement();

    // 更新按钮状态
    document.querySelectorAll(".route-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document
      .querySelector(`[data-route="${routeName}"]`)
      .classList.add("active");

    this.currentRoute = this.routes[routeName];
    this.currentRouteIndex = 0;
    this.isMoving = true;

    console.log(`开始路线: ${routeName}`);
    this.startMovement();
  }

  startMovement() {
    if (!this.currentRoute || !this.isMoving) return;

    this.movementInterval = setInterval(() => {
      this.moveToNextWaypoint();
    }, 2000); // 每2秒移动到下一个路点
  }

  stopMovement() {
    if (this.movementInterval) {
      clearInterval(this.movementInterval);
      this.movementInterval = null;
    }
    this.isMoving = false;
  }

  moveToNextWaypoint() {
    if (
      !this.currentRoute ||
      this.currentRouteIndex >= this.currentRoute.length
    ) {
      this.stopMovement();
      return;
    }

    const targetPosition = this.currentRoute[this.currentRouteIndex];
    this.vehiclePosition = { ...targetPosition };

    // 计算速度（模拟）
    this.vehicleSpeed = Math.random() * 20 + 30; // 30-50 km/h

    // 计算方向
    if (this.currentRouteIndex < this.currentRoute.length - 1) {
      const nextPosition = this.currentRoute[this.currentRouteIndex + 1];
      this.vehicleDirection = this.calculateDirection(
        this.vehiclePosition,
        nextPosition
      );
    }

    console.log(
      `车辆移动到位置: (${this.vehiclePosition.x}, ${this.vehiclePosition.y})`
    );

    // 发送位置更新到UE
    this.sendPositionToUE();

    // 检查是否需要MEC切换
    if (this.autoHandoverEnabled) {
      this.checkMECHandover();
    }

    this.currentRouteIndex++;
  }

  calculateDirection(current, next) {
    const dx = next.x - current.x;
    const dy = next.y - current.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "East" : "West";
    } else {
      return dy > 0 ? "North" : "South";
    }
  }

  async sendPositionToUE() {
    try {
      // 调用UE API发送车辆位置
      const result = await ueApiManager.setVehiclePosition(
        this.vehiclePosition.x,
        this.vehiclePosition.y,
        0
      );

      if (result.success) {
        console.log("车辆位置已发送到UE");
      }
    } catch (error) {
      console.error("发送车辆位置失败:", error);
    }
  }

  async checkMECHandover() {
    // 使用Agent进行智能决策
    if (window.agentDecisionManager) {
      const decision = await agentDecisionManager.analyzeVehiclePosition(
        this.vehiclePosition,
        this.currentMEC,
        this.mecServers
      );

      if (decision.needsHandover) {
        console.log(`Agent决策: 需要切换到 ${decision.targetMEC}`);
        console.log(`决策理由: ${decision.reasoning}`);
        await this.performMECHandover(decision.targetMEC);
      } else {
        console.log(`Agent决策: 维持当前连接 - ${decision.reasoning}`);
      }
    } else {
      // 回退到简单距离算法
      const bestMEC = this.findNearestMEC();

      if (bestMEC !== this.currentMEC) {
        console.log(`简单算法决策: ${this.currentMEC} -> ${bestMEC}`);
        await this.performMECHandover(bestMEC);
      }
    }
  }

  findNearestMEC() {
    let nearestMEC = "east";
    let minDistance = Infinity;

    Object.keys(this.mecServers).forEach((mecId) => {
      const mec = this.mecServers[mecId];
      const distance = this.calculateDistance(
        this.vehiclePosition,
        mec.position
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestMEC = mecId;
      }
    });

    return nearestMEC;
  }

  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  async performMECHandover(targetMEC) {
    try {
      // 1. 调用Agent决策API
      const decisionResult = await this.callAgentDecision(targetMEC);

      if (decisionResult.success) {
        // 2. 更新网络配置
        const configResult = await this.updateNetworkConfig(targetMEC);

        if (configResult.success) {
          // 3. 更新当前MEC
          this.currentMEC = targetMEC;

          // 4. 测量新的延迟
          await this.measureLatency();

          // 5. 更新UI
          this.updateMECUI();

          console.log(
            `MEC切换成功: 现在连接到 ${this.mecServers[targetMEC].name}`
          );
        }
      }
    } catch (error) {
      console.error("MEC切换失败:", error);
    }
  }

  async callAgentDecision(targetMEC) {
    // 调用Python Agent的决策API
    const requestData = {
      vehicle_position: this.vehiclePosition,
      current_mec: this.currentMEC,
      target_mec: targetMEC,
      reason: `Vehicle moved to position (${this.vehiclePosition.x}, ${this.vehiclePosition.y}), closer to ${this.mecServers[targetMEC].name}`,
    };

    try {
      const agentUrl = (window && window.appConfig && window.appConfig.vehicleAgentUrl) ? window.appConfig.vehicleAgentUrl : "http://10.30.2.11:5000/api/agent/decision";
      const response = await fetch(agentUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (result.success && result.decision.should_switch) {
        console.log("Agent决策:", result.decision.reasoning);
        return { success: true, decision: result.decision.reasoning };
      } else {
        console.log("Agent建议维持当前连接:", result.decision?.reasoning);
        return {
          success: false,
          reason: result.decision?.reasoning || "No switch needed",
        };
      }
    } catch (error) {
      console.error("Agent决策调用失败:", error);
      // 返回模拟结果
      return {
        success: true,
        decision: `Fallback decision: Switch to ${targetMEC}`,
      };
    }
  }

  async updateNetworkConfig(targetMEC) {
    // 调用网络配置更新API
    try {
      const networkUrl = (window && window.appConfig && window.appConfig.vehicleAgentUrl) ? window.appConfig.vehicleAgentUrl.replace('/api/agent/decision', '/api/network/config') : "http://10.30.2.11:5000/api/network/config";
      const response = await fetch(networkUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_smf",
          target_upf: `upf-${targetMEC}`,
          ue_id: "vehicle-001",
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log("网络配置更新成功:", result.message);
        return { success: true };
      } else {
        console.error("网络配置更新失败:", result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("网络配置更新失败:", error);
      // 返回模拟结果（用于演示）
      return { success: true };
    }
  }

  async measureLatency() {
    // 模拟测量到各个MEC的延迟
    Object.keys(this.mecServers).forEach((mecId) => {
      if (mecId === this.currentMEC) {
        // 当前连接的MEC延迟较低
        this.mecServers[mecId].latency = Math.random() * 10 + 5; // 5-15ms
      } else {
        // 其他MEC延迟较高
        this.mecServers[mecId].latency = Math.random() * 40 + 30; // 30-70ms
      }
    });
  }

  updateMECUI() {
    // 更新MEC指示器
    Object.keys(this.mecServers).forEach((mecId) => {
      const indicator = document.getElementById(`mec-${mecId}-indicator`);
      const latencyElement = document.getElementById(`mec-${mecId}-latency`);

      if (indicator) {
        indicator.className = "mec-indicator";
        if (mecId === this.currentMEC) {
          indicator.classList.add("active");
        }
      }

      if (latencyElement) {
        latencyElement.textContent = `${this.mecServers[mecId].latency.toFixed(
          1
        )} ms`;
      }
    });

    // 更新当前连接信息
    const currentMECName = document.getElementById("current-mec-name");
    const currentMECRTT = document.getElementById("current-mec-rtt");

    if (currentMECName) {
      currentMECName.textContent = this.mecServers[this.currentMEC].name;
    }

    if (currentMECRTT) {
      currentMECRTT.textContent = `${this.mecServers[
        this.currentMEC
      ].latency.toFixed(1)} ms`;
    }
  }

  startPositionUpdates() {
    this.updateInterval = setInterval(() => {
      if (this.currentScenario === "vehicle") {
        this.updateVehicleDisplay();
      }
    }, 500); // 每500ms更新一次显示
  }

  updateVehicleDisplay() {
    // 更新车辆位置显示
    const positionElement = document.getElementById("vehicle-position");
    if (positionElement) {
      positionElement.textContent = `X: ${this.vehiclePosition.x.toFixed(
        0
      )}, Y: ${this.vehiclePosition.y.toFixed(0)}`;
    }

    // 更新速度显示
    const speedElement = document.getElementById("vehicle-speed");
    if (speedElement) {
      speedElement.textContent = `${this.vehicleSpeed.toFixed(1)} km/h`;
    }

    // 更新方向显示
    const directionElement = document.getElementById("vehicle-direction");
    if (directionElement) {
      directionElement.textContent = this.vehicleDirection;
    }
  }
}

// 全局变量
let vehicleScenarioManager;

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  vehicleScenarioManager = new VehicleScenarioManager();
});
