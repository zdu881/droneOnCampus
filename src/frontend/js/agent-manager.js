// Agent决策管理器 - 处理智能决策逻辑
class AgentDecisionManager {
  constructor() {
    this.decisionLog = [];
    this.maxLogEntries = 50;
    this.isDecisionActive = false;

    // 决策规则配置
    this.decisionRules = {
      // MEC切换的距离阈值
      mecSwitchThreshold: 300,
      // 延迟改善的最小期望值
      latencyImprovementThreshold: 20, // ms
      // 决策冷却时间（避免频繁切换）
      decisionCooldown: 10000, // 10秒
    };

    this.lastDecisionTime = 0;
    this.init();
  }

  init() {
    this.createDecisionPanel();
  }

  createDecisionPanel() {
    // 面板现在在HTML中预定义，只需要设置事件监听器
    this.setupPanelEventListeners();

    // 初始化决策日志
    this.logDecision(
      {
        reasoning: "Agent系统已初始化并就绪",
        success: true,
      },
      0
    );
  }

  setupPanelEventListeners() {
    // 强制优化按钮
    document
      .getElementById("force-optimization")
      ?.addEventListener("click", () => {
        this.forceOptimization();
      });

    // 清除日志按钮
    document.getElementById("clear-log")?.addEventListener("click", () => {
      this.clearDecisionLog();
    });
  }

  // 主要决策函数 - 分析车辆位置并决定是否需要MEC切换
  async analyzeVehiclePosition(vehiclePosition, currentMEC, mecServers) {
    const currentTime = Date.now();

    // 检查决策冷却时间
    if (
      currentTime - this.lastDecisionTime <
      this.decisionRules.decisionCooldown
    ) {
      return { needsHandover: false, reason: "Decision cooldown active" };
    }

    this.updateAgentStatus("analyzing", "Analyzing position...");

    const startTime = performance.now();

    try {
      // 1. 计算到各个MEC的距离
      const distances = this.calculateMECDistances(vehiclePosition, mecServers);

      // 2. 找到最近的MEC
      const nearestMEC = this.findNearestMEC(distances);

      // 3. 评估切换的必要性
      const analysis = this.evaluateHandoverNecessity(
        vehiclePosition,
        currentMEC,
        nearestMEC,
        distances,
        mecServers
      );

      // 4. 生成决策
      const decision = await this.generateDecision(analysis);

      const responseTime = performance.now() - startTime;

      // 5. 记录决策
      this.logDecision(decision, responseTime);

      // 6. 更新统计信息
      this.updateDecisionMetrics(decision.success, responseTime);

      this.lastDecisionTime = currentTime;

      return decision;
    } catch (error) {
      console.error("Decision analysis failed:", error);
      this.updateAgentStatus("error", "Analysis failed");
      return {
        needsHandover: false,
        reason: "Analysis error",
        error: error.message,
      };
    }
  }

  calculateMECDistances(vehiclePosition, mecServers) {
    const distances = {};

    Object.keys(mecServers).forEach((mecId) => {
      const mec = mecServers[mecId];
      const dx = vehiclePosition.x - mec.position.x;
      const dy = vehiclePosition.y - mec.position.y;
      distances[mecId] = Math.sqrt(dx * dx + dy * dy);
    });

    return distances;
  }

  findNearestMEC(distances) {
    let nearestMEC = null;
    let minDistance = Infinity;

    Object.keys(distances).forEach((mecId) => {
      if (distances[mecId] < minDistance) {
        minDistance = distances[mecId];
        nearestMEC = mecId;
      }
    });

    return { mec: nearestMEC, distance: minDistance };
  }

  evaluateHandoverNecessity(
    vehiclePosition,
    currentMEC,
    nearestMEC,
    distances,
    mecServers
  ) {
    const currentDistance = distances[currentMEC];
    const nearestDistance = nearestMEC.distance;
    const distanceDifference = currentDistance - nearestDistance;

    // 预估延迟改善
    const currentLatency = mecServers[currentMEC].latency;
    const estimatedNewLatency = this.estimateLatency(nearestDistance);
    const latencyImprovement = currentLatency - estimatedNewLatency;

    return {
      vehiclePosition,
      currentMEC,
      nearestMEC: nearestMEC.mec,
      currentDistance,
      nearestDistance,
      distanceDifference,
      currentLatency,
      estimatedNewLatency,
      latencyImprovement,
      shouldSwitch:
        distanceDifference > this.decisionRules.mecSwitchThreshold &&
        latencyImprovement > this.decisionRules.latencyImprovementThreshold,
    };
  }

  estimateLatency(distance) {
    // 基于距离估算延迟的简单模型
    // 基础延迟 + 距离相关延迟
    const baseLatency = 5; // 基础网络延迟 5ms
    const distanceLatency = distance / 100; // 每100单位距离增加1ms
    return baseLatency + distanceLatency;
  }

  async generateDecision(analysis) {
    this.updateAgentStatus("deciding", "Generating decision...");

    // 模拟LLM推理过程
    await this.simulateThinking();

    if (analysis.shouldSwitch) {
      const reasoning = this.generateReasoning(analysis);

      return {
        needsHandover: true,
        targetMEC: analysis.nearestMEC,
        reasoning: reasoning,
        confidence: this.calculateConfidence(analysis),
        expectedImprovement: {
          latency: analysis.latencyImprovement,
          distance: analysis.distanceDifference,
        },
        success: true,
      };
    } else {
      return {
        needsHandover: false,
        reasoning: this.generateNoSwitchReasoning(analysis),
        confidence: 0.8,
        success: true,
      };
    }
  }

  generateReasoning(analysis) {
    const templates = [
      `车辆当前位置 (${analysis.vehiclePosition.x}, ${
        analysis.vehiclePosition.y
      }) 距离${analysis.nearestMEC}MEC更近。当前连接${
        analysis.currentMEC
      }MEC，距离${analysis.currentDistance.toFixed(
        0
      )}单位，延迟${analysis.currentLatency.toFixed(1)}ms。切换到${
        analysis.nearestMEC
      }MEC可以减少${analysis.distanceDifference.toFixed(
        0
      )}单位距离，预计延迟改善${analysis.latencyImprovement.toFixed(
        1
      )}ms。建议执行切换。`,

      `基于车辆移动轨迹分析，当前位置更接近${
        analysis.nearestMEC
      }区域的MEC服务器。现有连接的网络延迟为${analysis.currentLatency.toFixed(
        1
      )}ms，切换后预计可降低至${analysis.estimatedNewLatency.toFixed(
        1
      )}ms，改善幅度${analysis.latencyImprovement.toFixed(
        1
      )}ms超过阈值。执行MEC切换操作。`,

      `Agent推理：车辆从当前位置到${
        analysis.nearestMEC
      }MEC的距离（${analysis.nearestDistance.toFixed(0)}单位）明显小于到${
        analysis.currentMEC
      }MEC的距离（${analysis.currentDistance.toFixed(
        0
      )}单位）。为获得最佳网络性能，建议将数据流量路由到${
        analysis.nearestMEC
      }区UPF。`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  generateNoSwitchReasoning(analysis) {
    if (analysis.distanceDifference <= this.decisionRules.mecSwitchThreshold) {
      return `距离差异${analysis.distanceDifference.toFixed(
        0
      )}单位未达到切换阈值${
        this.decisionRules.mecSwitchThreshold
      }单位，维持当前连接。`;
    } else if (
      analysis.latencyImprovement <=
      this.decisionRules.latencyImprovementThreshold
    ) {
      return `预期延迟改善${analysis.latencyImprovement.toFixed(
        1
      )}ms不足以证明切换的必要性，维持当前MEC连接。`;
    } else {
      return `当前网络连接稳定，无需切换。`;
    }
  }

  calculateConfidence(analysis) {
    // 基于多个因素计算决策置信度
    let confidence = 0.5;

    // 距离因素
    if (
      analysis.distanceDifference >
      this.decisionRules.mecSwitchThreshold * 2
    ) {
      confidence += 0.3;
    } else if (
      analysis.distanceDifference > this.decisionRules.mecSwitchThreshold
    ) {
      confidence += 0.2;
    }

    // 延迟改善因素
    if (
      analysis.latencyImprovement >
      this.decisionRules.latencyImprovementThreshold * 2
    ) {
      confidence += 0.2;
    } else if (
      analysis.latencyImprovement >
      this.decisionRules.latencyImprovementThreshold
    ) {
      confidence += 0.1;
    }

    return Math.min(confidence, 0.95);
  }

  async simulateThinking() {
    // 模拟AI思考时间
    await new Promise((resolve) =>
      setTimeout(resolve, 200 + Math.random() * 300)
    );
  }

  logDecision(decision, responseTime) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = {
      timestamp,
      decision,
      responseTime,
      id: Date.now(),
    };

    this.decisionLog.unshift(entry);

    // 限制日志条目数量
    if (this.decisionLog.length > this.maxLogEntries) {
      this.decisionLog = this.decisionLog.slice(0, this.maxLogEntries);
    }

    this.updateDecisionLogDisplay();
  }

  updateDecisionLogDisplay() {
    const logElement = document.getElementById("decision-log");
    if (!logElement) return;

    const latestEntries = this.decisionLog.slice(0, 5); // 显示最新5条

    logElement.innerHTML = latestEntries
      .map(
        (entry) => `
      <div class="decision-entry">
        <div class="decision-timestamp">${entry.timestamp}</div>
        <div class="decision-text">${
          entry.decision.reasoning || entry.decision.reason || "Decision made"
        }</div>
      </div>
    `
      )
      .join("");
  }

  updateDecisionMetrics(success, responseTime) {
    // 更新决策计数
    const countElement = document.getElementById("decision-count");
    if (countElement) {
      const currentCount = parseInt(countElement.textContent) || 0;
      countElement.textContent = currentCount + 1;
    }

    // 更新成功率
    const successDecisions = this.decisionLog.filter(
      (entry) => entry.decision.success
    ).length;
    const totalDecisions = this.decisionLog.length;
    const successRate =
      totalDecisions > 0
        ? ((successDecisions / totalDecisions) * 100).toFixed(1)
        : "--";

    const successRateElement = document.getElementById("success-rate");
    if (successRateElement) {
      successRateElement.textContent = `${successRate}%`;
    }

    // 更新平均响应时间
    const avgResponseTime =
      this.decisionLog.reduce(
        (sum, entry) => sum + (entry.responseTime || 0),
        0
      ) / this.decisionLog.length;
    const avgResponseElement = document.getElementById("avg-response-time");
    if (avgResponseElement) {
      avgResponseElement.textContent = `${avgResponseTime.toFixed(0)} ms`;
    }
  }

  updateAgentStatus(status, message) {
    const statusDot = document.getElementById("agent-status-dot");
    const statusText = document.getElementById("agent-status-text");

    if (statusDot) {
      statusDot.className = "status-dot";
      switch (status) {
        case "analyzing":
          statusDot.classList.add("transmitting");
          break;
        case "deciding":
          statusDot.classList.add("transmitting");
          break;
        case "error":
          statusDot.classList.add("error");
          break;
        default:
          statusDot.classList.add("connected");
      }
    }

    if (statusText) {
      statusText.textContent = message || status;
    }
  }

  forceOptimization() {
    this.updateAgentStatus("analyzing", "Force optimization triggered");
    this.logDecision(
      {
        reasoning: "Manual optimization triggered by user",
        success: true,
      },
      0
    );

    // 触发车辆场景管理器的优化检查
    if (window.vehicleScenarioManager) {
      window.vehicleScenarioManager.checkMECHandover();
    }
  }

  clearDecisionLog() {
    this.decisionLog = [];
    this.updateDecisionLogDisplay();
    this.logDecision(
      {
        reasoning: "Decision log cleared by user",
        success: true,
      },
      0
    );
  }
}

// 全局变量
let agentDecisionManager;

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  agentDecisionManager = new AgentDecisionManager();
});
