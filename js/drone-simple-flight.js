/**
 * 简化的无人机飞行 UI - 只需选择起点和终点
 */
class DroneSimpleFlightUI {
  constructor(dashboardManager) {
    this.dashboardManager = dashboardManager;
    this.pathManager = null;
  }

  /**
   * 创建简化的飞行控制 UI
   * @param {HTMLElement} container - 容器元素
   * @param {FlightPathManager} pathManager - 路径管理器实例
   */
  createUI(container, pathManager) {
    this.pathManager = pathManager;

    const html = `
      <div class="simple-flight-card">
        <div class="card-header">
          <h3>🚁 无人机飞行控制</h3>
        </div>
        
        <div class="card-content">
          <!-- 起点设置 -->
          <div class="flight-section">
            <h4>📍 起点设置</h4>
            <div class="coordinate-inputs">
              <div class="coord-input-small">
                <label>X:</label>
                <input type="number" id="start-x" value="0" placeholder="X">
              </div>
              <div class="coord-input-small">
                <label>Y:</label>
                <input type="number" id="start-y" value="0" placeholder="Y">
              </div>
              <div class="coord-input-small">
                <label>Z:</label>
                <input type="number" id="start-z" value="100" placeholder="Z">
              </div>
            </div>
          </div>

          <!-- 终点设置 -->
          <div class="flight-section">
            <h4>🎯 终点设置</h4>
            <div class="coordinate-inputs">
              <div class="coord-input-small">
                <label>X:</label>
                <input type="number" id="target-x" value="100" placeholder="X">
              </div>
              <div class="coord-input-small">
                <label>Y:</label>
                <input type="number" id="target-y" value="100" placeholder="Y">
              </div>
              <div class="coord-input-small">
                <label>Z:</label>
                <input type="number" id="target-z" value="120" placeholder="Z">
              </div>
            </div>
          </div>

          <!-- 预设位置 -->
          <div class="flight-section">
            <h4>⚡ 快速预设</h4>
            <select id="preset-locations" class="form-control">
              <option value="">-- 选择预设位置 --</option>
              <option value="library">图书馆 (0, 0, 100) → (-850, -30, 62)</option>
              <option value="dorm">宿舍 (0, 0, 100) → (500, 400, 80)</option>
              <option value="canteen">食堂 (0, 0, 100) → (-200, 300, 75)</option>
            </select>
          </div>

          <!-- 路径信息 -->
          <div class="flight-info-box">
            <div id="flight-path-info">未设置路径</div>
          </div>

          <!-- 控制按钮 -->
          <div class="flight-buttons">
            <button id="start-flight-btn" class="btn-primary">
              <i class="fas fa-play"></i> 开始飞行
            </button>
            <button id="stop-flight-btn" class="btn-danger" disabled>
              <i class="fas fa-stop"></i> 停止
            </button>
          </div>

          <!-- 飞行状态 -->
          <div class="flight-state-box" style="display: none;">
            <div class="status-label">飞行状态:</div>
            <div id="flight-status" class="status-value">待飞行</div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this._attachEventListeners(container);
  }

  /**
   * 绑定事件监听
   * @private
   */
  _attachEventListeners(container) {
    // 预设位置
    const presetSelect = container.querySelector('#preset-locations');
    presetSelect?.addEventListener('change', (e) => {
      this._loadPresetLocation(e.target.value, container);
    });

    // 开始飞行
    container.querySelector('#start-flight-btn')?.addEventListener('click', () => {
      this._startFlight(container);
    });

    // 停止飞行
    container.querySelector('#stop-flight-btn')?.addEventListener('click', () => {
      this._stopFlight(container);
    });

    // 监听路径管理器事件
    if (this.pathManager) {
      this.pathManager.on('onFlightStarted', (data) => {
        this._updateFlightState('flying', '飞行中...', container);
      });

      this.pathManager.on('onFlightCompleted', (data) => {
        this._updateFlightState('completed', '飞行完成!', container);
        setTimeout(() => {
          this._updateFlightState('idle', '待飞行', container);
        }, 2000);
      });

      this.pathManager.on('onFlightError', (data) => {
        this._updateFlightState('error', '错误: ' + (data.error || '未知错误'), container);
        alert('飞行错误: ' + (data.error || '未知错误'));
      });
    }
  }

  /**
   * 加载预设位置
   * @private
   */
  _loadPresetLocation(preset, container) {
    const presets = {
      'library': { startX: 0, startY: 0, startZ: 100, targetX: -850, targetY: -30, targetZ: 62 },
      'dorm': { startX: 0, startY: 0, startZ: 100, targetX: 500, targetY: 400, targetZ: 80 },
      'canteen': { startX: 0, startY: 0, startZ: 100, targetX: -200, targetY: 300, targetZ: 75 }
    };

    if (presets[preset]) {
      const p = presets[preset];
      container.querySelector('#start-x').value = p.startX;
      container.querySelector('#start-y').value = p.startY;
      container.querySelector('#start-z').value = p.startZ;
      container.querySelector('#target-x').value = p.targetX;
      container.querySelector('#target-y').value = p.targetY;
      container.querySelector('#target-z').value = p.targetZ;
      this._updatePathInfo(container);
    }
  }

  /**
   * 开始飞行
   * @private
   */
  async _startFlight(container) {
    // 读取坐标
    const startX = parseFloat(container.querySelector('#start-x').value);
    const startY = parseFloat(container.querySelector('#start-y').value);
    const startZ = parseFloat(container.querySelector('#start-z').value);
    const targetX = parseFloat(container.querySelector('#target-x').value);
    const targetY = parseFloat(container.querySelector('#target-y').value);
    const targetZ = parseFloat(container.querySelector('#target-z').value);

    // 验证坐标
    if (isNaN(startX) || isNaN(startY) || isNaN(startZ) ||
        isNaN(targetX) || isNaN(targetY) || isNaN(targetZ)) {
      alert('请输入有效的坐标值');
      return;
    }

    // 设置路径管理器
    if (this.pathManager) {
      this.pathManager.setStartLocation(startX, startY, startZ);
      this.pathManager.setTargetLocation(targetX, targetY, targetZ);

      // 禁用按钮
      container.querySelector('#start-flight-btn').disabled = true;
      container.querySelector('#stop-flight-btn').disabled = false;

      // 开始飞行
      const result = await this.pathManager.startFlight();

      if (!result.success) {
        alert('飞行失败: ' + result.error);
        container.querySelector('#start-flight-btn').disabled = false;
        container.querySelector('#stop-flight-btn').disabled = true;
      }
    }
  }

  /**
   * 停止飞行
   * @private
   */
  _stopFlight(container) {
    if (this.pathManager) {
      this.pathManager.isFlying = false;
      this._updateFlightState('stopped', '已停止', container);
      container.querySelector('#start-flight-btn').disabled = false;
      container.querySelector('#stop-flight-btn').disabled = true;
    }
  }

  /**
   * 更新路径信息显示
   * @private
   */
  _updatePathInfo(container) {
    const infoEl = container.querySelector('#flight-path-info');
    if (!infoEl) return;

    const startX = container.querySelector('#start-x').value;
    const startY = container.querySelector('#start-y').value;
    const startZ = container.querySelector('#start-z').value;
    const targetX = container.querySelector('#target-x').value;
    const targetY = container.querySelector('#target-y').value;
    const targetZ = container.querySelector('#target-z').value;

    infoEl.textContent = `起点: (${startX}, ${startY}, ${startZ}) → 终点: (${targetX}, ${targetY}, ${targetZ})`;
  }

  /**
   * 更新飞行状态显示
   * @private
   */
  _updateFlightState(state, message, container) {
    const stateBox = container.querySelector('.flight-state-box');
    const stateEl = container.querySelector('#flight-status');

    if (stateEl) {
      stateEl.textContent = message;
      stateEl.className = `status-value status-${state}`;
    }

    if (stateBox) {
      stateBox.style.display = 'block';
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DroneSimpleFlightUI;
}
