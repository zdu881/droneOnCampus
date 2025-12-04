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
      <!-- 起点设置 -->
      <div class="flight-section" style="margin-bottom: 15px;">
        <label style="font-weight: bold; display: block; margin-bottom: 8px;">📍 起点设置</label>
        <div class="coordinate-inputs" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
          <div class="coord-input-small">
            <label style="font-size: 12px;">X:</label>
            <input type="number" id="start-x" value="0" placeholder="X" style="width: 100%; padding: 6px; box-sizing: border-box;">
          </div>
          <div class="coord-input-small">
            <label style="font-size: 12px;">Y:</label>
            <input type="number" id="start-y" value="0" placeholder="Y" style="width: 100%; padding: 6px; box-sizing: border-box;">
          </div>
          <div class="coord-input-small">
            <label style="font-size: 12px;">Z:</label>
            <input type="number" id="start-z" value="100" placeholder="Z" style="width: 100%; padding: 6px; box-sizing: border-box;">
          </div>
        </div>
      </div>

      <!-- 终点设置 -->
      <div class="flight-section" style="margin-bottom: 15px;">
        <label style="font-weight: bold; display: block; margin-bottom: 8px;">🎯 终点设置</label>
        <div class="coordinate-inputs" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
          <div class="coord-input-small">
            <label style="font-size: 12px;">X:</label>
            <input type="number" id="target-x" value="100" placeholder="X" style="width: 100%; padding: 6px; box-sizing: border-box;">
          </div>
          <div class="coord-input-small">
            <label style="font-size: 12px;">Y:</label>
            <input type="number" id="target-y" value="100" placeholder="Y" style="width: 100%; padding: 6px; box-sizing: border-box;">
          </div>
          <div class="coord-input-small">
            <label style="font-size: 12px;">Z:</label>
            <input type="number" id="target-z" value="120" placeholder="Z" style="width: 100%; padding: 6px; box-sizing: border-box;">
          </div>
        </div>
      </div>

      <!-- 预设位置 -->
      <div class="flight-section" style="margin-bottom: 15px;">
        <label style="font-weight: bold; display: block; margin-bottom: 8px;">⚡ 快速预设</label>
        <select id="preset-locations" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="">-- 选择预设位置 --</option>
          <option value="library">图书馆 (0, 0, 100) → (-850, -30, 62)</option>
          <option value="dorm">宿舍 (0, 0, 100) → (500, 400, 80)</option>
          <option value="canteen">食堂 (0, 0, 100) → (-200, 300, 75)</option>
        </select>
      </div>

      <!-- 路径信息 -->
      <div class="flight-info-box" style="background: #f5f5f5; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 13px; border-left: 3px solid #2196F3;">
        <div id="flight-path-info" style="color: #666;">未设置路径</div>
      </div>

      <!-- 控制按钮 -->
      <div class="flight-buttons" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
        <button id="start-flight-btn" class="action-btn primary-btn" style="padding: 10px;">
          <i class="fas fa-play"></i> 开始飞行
        </button>
        <button id="stop-flight-btn" class="action-btn" style="padding: 10px; background: #f44336; display: none;">
          <i class="fas fa-stop"></i> 停止飞行
        </button>
      </div>

      <!-- 飞行状态 -->
      <div class="flight-state-box" style="display: none; padding: 10px; background: #e3f2fd; border-left: 3px solid #2196F3; border-radius: 4px; margin-top: 10px;">
        <div class="status-label" style="font-size: 12px; color: #666;">飞行状态:</div>
        <div id="flight-status" style="font-weight: bold; color: #2196F3; margin-top: 4px;">待飞行</div>
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
