// 统一面板管理器
class UnifiedPanelManager {
  constructor() {
    this.currentPanel = "network-kpi"; // 默认面板
    this.currentScenario = "drone"; // 默认场景
    this.panelMapping = {
      // 无人机场景面板
      "network-kpi": "network-kpi-content",
      "signal-quality": "signal-quality-content",
      "camera-presets": "camera-presets-content",
      "base-station-management": "base-station-management-content",
      "task-management": "task-management-content",
      // 车辆场景面板
      "mec-servers": "mec-servers-content",
      "vehicle-control": "vehicle-control-content",
      "network-slice": "network-slice-content",
      "agent-decision": "agent-decision-content",
    };

    this.scenarioPanels = {
      drone: [
        "network-kpi",
        "signal-quality",
        "camera-presets",
        "base-station-management",
        "task-management",
      ],
      vehicle: [
        "mec-servers",
        "vehicle-control",
        "network-slice",
        "agent-decision",
      ],
    };

    this.init();
  }

  init() {
    // 初始化面板选择器事件
    const panelSelect = document.getElementById("panel-select");
    if (panelSelect) {
      panelSelect.addEventListener("change", (e) => {
        this.switchPanel(e.target.value);
      });
    }

    // 初始化场景切换事件
    document.querySelectorAll(".scenario-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const scenario = e.target.dataset.scenario;
        this.switchScenario(scenario);
      });
    });

    // 设置初始状态
    this.updatePanelOptions();
    this.showPanel(this.currentPanel);
  }

  switchScenario(scenario) {
    if (this.currentScenario === scenario) return;

    this.currentScenario = scenario;

    // 更新body类
    document.body.classList.remove("drone-scenario", "vehicle-scenario");
    document.body.classList.add(`${scenario}-scenario`);

    // 更新按钮状态
    document.querySelectorAll(".scenario-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.scenario === scenario);
    });

    // 更新面板选项
    this.updatePanelOptions();

    // 切换到该场景的默认面板
    const defaultPanel = this.scenarioPanels[scenario][0];
    this.currentPanel = defaultPanel;

    const panelSelect = document.getElementById("panel-select");
    if (panelSelect) {
      panelSelect.value = defaultPanel;
    }

    this.showPanel(defaultPanel);

    console.log(`切换到${scenario}场景，显示${defaultPanel}面板`);
  }

  switchPanel(panelId) {
    if (this.currentPanel === panelId) return;

    this.currentPanel = panelId;
    this.showPanel(panelId);

    console.log(`切换到面板: ${panelId}`);
  }

  showPanel(panelId) {
    // 隐藏所有面板
    document.querySelectorAll(".panel-item").forEach((panel) => {
      panel.classList.remove("active");
    });

    // 显示目标面板
    const targetPanel = document.getElementById(this.panelMapping[panelId]);
    if (targetPanel) {
      targetPanel.classList.add("active");
    }
  }

  updatePanelOptions() {
    const panelSelect = document.getElementById("panel-select");
    if (!panelSelect) return;

    // 隐藏所有optgroup
    const droneGroup = panelSelect.querySelector(".drone-options");
    const vehicleGroup = panelSelect.querySelector(".vehicle-options");

    if (this.currentScenario === "drone") {
      if (droneGroup) droneGroup.style.display = "";
      if (vehicleGroup) vehicleGroup.style.display = "none";
    } else {
      if (droneGroup) droneGroup.style.display = "none";
      if (vehicleGroup) vehicleGroup.style.display = "";
    }

    // 更新选择器中的可见选项
    Array.from(panelSelect.options).forEach((option) => {
      const panelId = option.value;
      const isVisible =
        this.scenarioPanels[this.currentScenario].includes(panelId);
      option.style.display = isVisible ? "" : "none";
      option.disabled = !isVisible;
    });
  }

  // 获取当前面板ID
  getCurrentPanel() {
    return this.currentPanel;
  }

  // 获取当前场景
  getCurrentScenario() {
    return this.currentScenario;
  }

  // 程序化切换面板（供其他模块调用）
  showSpecificPanel(panelId) {
    if (this.panelMapping[panelId]) {
      const panelSelect = document.getElementById("panel-select");
      if (panelSelect) {
        panelSelect.value = panelId;
      }
      this.switchPanel(panelId);
    }
  }
}

// 全局实例
let unifiedPanelManager;

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  unifiedPanelManager = new UnifiedPanelManager();

  // 将实例暴露给全局作用域，方便其他模块使用
  window.unifiedPanelManager = unifiedPanelManager;
});
