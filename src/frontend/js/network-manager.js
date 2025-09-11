// 5G Network and AI Agent Manager
class NetworkManager {
  constructor() {
    this.networkApiUrl = "http://192.168.21.1:5000/api"; // Python Flask服务器
    this.currentKPI = {
      bandwidth: 0,
      rtt: 0,
      packetLoss: 0,
      qosLevel: 9,
      signalQuality: 0,
    };
    this.dronePosition = { x: 0, y: 0, z: 0 };
    this.agentDecisions = [];
    this.networkSliceStatus = "inactive";

    this.initializeEventListeners();
    this.startNetworkMonitoring();
  }

  initializeEventListeners() {
    // QoS选择器事件
    document.getElementById("qos-select").addEventListener("change", (e) => {
      this.changeQoSProfile(parseInt(e.target.value));
    });

    // QoS优化按钮事件
    document
      .getElementById("optimize-latency")
      .addEventListener("click", () => {
        this.optimizeForLatency();
      });

    document
      .getElementById("optimize-bandwidth")
      .addEventListener("click", () => {
        this.optimizeForBandwidth();
      });

    document.getElementById("balanced-mode").addEventListener("click", () => {
      this.setBalancedMode();
    });

    document
      .getElementById("emergency-override")
      .addEventListener("click", () => {
        this.emergencyOverride();
      });

    // 触发网络优化
    document
      .getElementById("trigger-optimization")
      .addEventListener("click", () => {
        this.triggerNetworkOptimization();
      });
  }

  // 启动网络监控
  startNetworkMonitoring() {
    // 每2秒更新网络KPI
    setInterval(() => {
      this.updateNetworkKPI();
    }, 2000);

    // 每5秒检查信号质量
    setInterval(() => {
      this.checkSignalQuality();
    }, 5000);
  }

  // 更新网络KPI显示
  async updateNetworkKPI() {
    try {
      const response = await fetch(`${this.networkApiUrl}/network/kpi`);
      if (response.ok) {
        const kpi = await response.json();
        this.currentKPI = kpi;
        this.displayNetworkKPI(kpi);
      }
    } catch (error) {
      console.error("获取网络KPI失败:", error);
      this.simulateNetworkKPI(); // 使用模拟数据
    }
  }

  // 显示网络KPI
  displayNetworkKPI(kpi) {
    const bandwidthEl = document.getElementById("bandwidth-value");
    const rttEl = document.getElementById("rtt-value");
    const packetLossEl = document.getElementById("packet-loss-value");
    const qosLevelEl = document.getElementById("qos-level-value");

    bandwidthEl.textContent = `${kpi.bandwidth} Mbps`;
    rttEl.textContent = `${kpi.rtt} ms`;
    packetLossEl.textContent = `${kpi.packetLoss}%`;
    qosLevelEl.textContent = `5QI=${kpi.qosLevel}`;

    // 根据性能设置颜色
    bandwidthEl.className = `kpi-value ${this.getPerformanceClass(
      kpi.bandwidth,
      "bandwidth"
    )}`;
    rttEl.className = `kpi-value ${this.getPerformanceClass(kpi.rtt, "rtt")}`;
    packetLossEl.className = `kpi-value ${this.getPerformanceClass(
      kpi.packetLoss,
      "packetLoss"
    )}`;
  }

  // 检查信号质量
  async checkSignalQuality() {
    try {
      // 从UE获取无人机位置和信号质量
      const position = await ueApiManager.getDronePosition();
      if (position.success) {
        this.dronePosition = position.data;
        this.updatePositionDisplay();

        // 根据位置计算信号质量
        const signalQuality = this.calculateSignalQuality(this.dronePosition);
        this.updateSignalQualityDisplay(signalQuality);

        // 发送位置和信号质量到AI Agent
        this.sendPositionToAgent(this.dronePosition, signalQuality);
      }
    } catch (error) {
      console.error("检查信号质量失败:", error);
      this.simulateSignalQuality();
    }
  }

  // 更新位置显示
  updatePositionDisplay() {
    const positionEl = document.getElementById("drone-position");
    positionEl.textContent = `X: ${this.dronePosition.x.toFixed(
      0
    )}, Y: ${this.dronePosition.y.toFixed(
      0
    )}, Z: ${this.dronePosition.z.toFixed(0)}`;
  }

  // 更新信号质量显示
  updateSignalQualityDisplay(signalQuality) {
    const strengthEl = document.getElementById("signal-strength-value");
    const fillEl = document.getElementById("signal-quality-fill");
    const coverageEl = document.getElementById("coverage-area-value");

    const percentage = Math.round(signalQuality * 100);
    strengthEl.textContent = `${percentage}%`;
    fillEl.style.width = `${percentage}%`;

    // 设置信号质量颜色和覆盖区域
    if (signalQuality > 0.8) {
      fillEl.style.backgroundColor = "var(--success-color)";
      strengthEl.className = "kpi-value excellent";
      coverageEl.textContent = "Open Area";
    } else if (signalQuality > 0.6) {
      fillEl.style.backgroundColor = "var(--info-color)";
      strengthEl.className = "kpi-value good";
      coverageEl.textContent = "Moderate Coverage";
    } else if (signalQuality > 0.4) {
      fillEl.style.backgroundColor = "var(--warning-color)";
      strengthEl.className = "kpi-value warning";
      coverageEl.textContent = "Urban Canyon";
    } else {
      fillEl.style.backgroundColor = "var(--danger-color)";
      strengthEl.className = "kpi-value poor";
      coverageEl.textContent = "Signal Blocked";
    }
  }

  // 计算信号质量（基于位置模拟）
  calculateSignalQuality(position) {
    // 模拟城市环境中的信号质量
    const distanceFromCenter = Math.sqrt(
      position.x * position.x + position.y * position.y
    );
    const heightFactor = Math.min(position.z / 100, 1); // 高度优势

    // 基础信号质量
    let baseQuality = Math.max(0.2, 1 - distanceFromCenter / 2000);

    // 高度加成
    baseQuality += heightFactor * 0.3;

    // 添加一些随机变化模拟环境影响
    baseQuality += (Math.random() - 0.5) * 0.2;

    return Math.max(0, Math.min(1, baseQuality));
  }

  // 发送位置和信号质量到AI Agent
  async sendPositionToAgent(position, signalQuality) {
    try {
      const payload = {
        position: position,
        signalQuality: signalQuality,
        currentKPI: this.currentKPI,
        objective: "high_definition_video_transmission",
      };

      const response = await fetch(
        `${this.networkApiUrl}/agent/position_update`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        const agentResponse = await response.json();
        this.handleAgentDecision(agentResponse);
      }
    } catch (error) {
      console.error("发送位置到Agent失败:", error);
    }
  }

  // 处理AI Agent决策
  handleAgentDecision(decision) {
    console.log("AI Agent决策:", decision);

    // 添加到决策日志
    this.addDecisionToLog(decision);

    // 如果Agent建议改变QoS
    if (decision.recommended_qos) {
      this.updateQoSRecommendation(decision.recommended_qos);
    }

    // 如果Agent执行了网络重配置
    if (decision.network_reconfigured) {
      this.updateNetworkSliceStatus("configuring");
      setTimeout(() => {
        this.updateNetworkSliceStatus("active");
      }, 3000);
    }
  }

  // 添加决策到日志
  addDecisionToLog(decision) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp: timestamp,
      decision:
        decision.reasoning ||
        decision.message ||
        "Network optimization applied",
      qos: decision.recommended_qos,
    };

    this.agentDecisions.unshift(logEntry);
    if (this.agentDecisions.length > 10) {
      this.agentDecisions.pop();
    }

    this.updateDecisionLogDisplay();
  }

  // 更新决策日志显示
  updateDecisionLogDisplay() {
    const logEl = document.getElementById("decision-log");
    logEl.innerHTML = "";

    this.agentDecisions.forEach((entry) => {
      const entryEl = document.createElement("div");
      entryEl.className = "decision-entry";
      entryEl.innerHTML = `
        <div class="decision-timestamp">${entry.timestamp}</div>
        <div class="decision-text">${entry.decision}</div>
        ${
          entry.qos ? `<div class="decision-text">→ 5QI=${entry.qos}</div>` : ""
        }
      `;
      logEl.appendChild(entryEl);
    });
  }

  // 改变QoS配置文件
  async changeQoSProfile(qosLevel) {
    try {
      const response = await fetch(`${this.networkApiUrl}/network/qos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qos_level: qosLevel }),
      });

      if (response.ok) {
        this.currentKPI.qosLevel = qosLevel;
        this.updateNetworkSliceStatus("configuring");
        console.log(`QoS配置已更改为5QI=${qosLevel}`);

        setTimeout(() => {
          this.updateNetworkSliceStatus("active");
        }, 2000);
      }
    } catch (error) {
      console.error("更改QoS配置失败:", error);
    }
  }

  // 优化延迟
  optimizeForLatency() {
    this.changeQoSProfile(1); // 超低延迟
    this.addDecisionToLog({
      reasoning:
        "Manual optimization: Prioritizing ultra-low latency for real-time control",
      recommended_qos: 1,
    });
  }

  // 优化带宽
  optimizeForBandwidth() {
    this.changeQoSProfile(8); // 视频流优化
    this.addDecisionToLog({
      reasoning:
        "Manual optimization: Prioritizing bandwidth for HD video transmission",
      recommended_qos: 8,
    });
  }

  // 平衡模式
  setBalancedMode() {
    this.changeQoSProfile(7); // 语音/视频通话
    this.addDecisionToLog({
      reasoning:
        "Manual optimization: Balanced mode for voice/video communications",
      recommended_qos: 7,
    });
  }

  // 紧急覆盖
  emergencyOverride() {
    this.changeQoSProfile(2); // 低延迟高可靠性
    this.addDecisionToLog({
      reasoning: "EMERGENCY OVERRIDE: Maximum priority network slice activated",
      recommended_qos: 2,
    });
  }

  // 触发网络优化
  async triggerNetworkOptimization() {
    try {
      const response = await fetch(`${this.networkApiUrl}/agent/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_position: this.dronePosition,
          current_kpi: this.currentKPI,
          optimization_goal: "adaptive_network_slicing",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        this.handleAgentDecision(result);
      }
    } catch (error) {
      console.error("触发网络优化失败:", error);
    }
  }

  // 更新网络切片状态
  updateNetworkSliceStatus(status) {
    this.networkSliceStatus = status;
    const indicatorEl = document.getElementById("slice-status-indicator");
    const statusTextEl = document.getElementById("slice-status-text");

    indicatorEl.className = `slice-indicator ${status}`;

    switch (status) {
      case "active":
        statusTextEl.textContent = "Slice Status: Active";
        break;
      case "configuring":
        statusTextEl.textContent = "Slice Status: Configuring...";
        break;
      case "inactive":
        statusTextEl.textContent = "Slice Status: Inactive";
        break;
    }
  }

  // 获取性能等级类名
  getPerformanceClass(value, type) {
    switch (type) {
      case "bandwidth":
        if (value > 100) return "excellent";
        if (value > 50) return "good";
        if (value > 20) return "warning";
        return "poor";
      case "rtt":
        if (value < 10) return "excellent";
        if (value < 30) return "good";
        if (value < 100) return "warning";
        return "poor";
      case "packetLoss":
        if (value < 0.1) return "excellent";
        if (value < 1) return "good";
        if (value < 5) return "warning";
        return "poor";
    }
  }

  // 模拟网络KPI（当API不可用时）
  simulateNetworkKPI() {
    const simulatedKPI = {
      bandwidth: Math.round(30 + Math.random() * 70),
      rtt: Math.round(10 + Math.random() * 40),
      packetLoss: Math.round(Math.random() * 200) / 100,
      qosLevel: this.currentKPI.qosLevel,
    };
    this.displayNetworkKPI(simulatedKPI);
  }

  // 模拟信号质量（当API不可用时）
  simulateSignalQuality() {
    const signalQuality = 0.3 + Math.random() * 0.7;
    this.updateSignalQualityDisplay(signalQuality);
  }
}

// 创建全局实例
window.networkManager = new NetworkManager();
