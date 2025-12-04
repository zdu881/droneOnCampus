/**
 * 简化版飞行控制 UI
 * 只需选择起点和终点，点击"飞行"按钮即可
 */
class SimplifiedFlightControlUI {
  constructor(flightManager) {
    this.flightManager = flightManager;
    this.statusDisplay = null;
  }

  /**
   * 创建简化的飞行控制面板
   * @param {HTMLElement} container - 容器元素
   */
  createUI(container) {
    const locations = this.flightManager.getPresetLocations();
    
    // 构建位置选项 HTML
    let optionsHtml = '';
    for (const [key, location] of Object.entries(locations)) {
      optionsHtml += `<option value="${key}">${location.label} (${location.x}, ${location.y}, ${location.z})</option>`;
    }

    const html = `
      <div class="simple-flight-control">
        <div class="flight-control-card">
          <h3>🚁 无人机飞行控制</h3>
          
          <div class="flight-selection">
            <div class="location-selector">
              <label for="start-location">起点：</label>
              <select id="start-location" class="location-select">
                <option value="">-- 选择起点 --</option>
                ${optionsHtml}
              </select>
            </div>

            <div class="location-selector">
              <label for="end-location">终点：</label>
              <select id="end-location" class="location-select">
                <option value="">-- 选择终点 --</option>
                ${optionsHtml}
              </select>
            </div>
          </div>

          <div class="flight-buttons">
            <button id="fly-button" class="btn btn-primary fly-btn" disabled>
              <i class="fas fa-play"></i> 执行飞行
            </button>
            <button id="stop-button" class="btn btn-danger stop-btn" disabled>
              <i class="fas fa-stop"></i> 停止
            </button>
          </div>

          <div class="flight-status-display" id="flight-status">
            <p class="status-text">等待选择起点和终点...</p>
          </div>

          <div class="flight-info" id="flight-info" style="display: none;">
            <div class="info-item">
              <label>当前位置：</label>
              <span id="current-pos">(0, 0, 100)</span>
            </div>
            <div class="info-item">
              <label>飞行状态：</label>
              <span id="flight-state">待飞行</span>
            </div>
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
    const startSelect = container.querySelector('#start-location');
    const endSelect = container.querySelector('#end-location');
    const flyButton = container.querySelector('#fly-button');
    const stopButton = container.querySelector('#stop-button');

    this.statusDisplay = container.querySelector('#flight-status');

    // 位置选择变化
    startSelect.addEventListener('change', () => {
      this._updateButtonState(startSelect, endSelect, flyButton);
    });

    endSelect.addEventListener('change', () => {
      this._updateButtonState(startSelect, endSelect, flyButton);
    });

    // 飞行按钮
    flyButton.addEventListener('click', async () => {
      const fromKey = startSelect.value;
      const toKey = endSelect.value;

      if (fromKey === toKey) {
        this._showStatus('起点和终点不能相同', 'error');
        return;
      }

      // 禁用操作
      flyButton.disabled = true;
      startSelect.disabled = true;
      endSelect.disabled = true;
      stopButton.disabled = false;

      const result = await this.flightManager.flyBetweenPresets(fromKey, toKey);

      // 恢复操作
      flyButton.disabled = false;
      startSelect.disabled = false;
      endSelect.disabled = false;
      stopButton.disabled = true;

      if (result.success) {
        this._showStatus('✓ 飞行完成！', 'success');
        this._updateInfoDisplay(result.currentLocation);
      } else {
        this._showStatus('✗ 飞行失败：' + result.error, 'error');
      }
    });

    // 停止按钮
    stopButton.addEventListener('click', () => {
      // 实现停止逻辑（如果需要）
      this._showStatus('飞行已停止', 'warning');
      flyButton.disabled = false;
      stopButton.disabled = true;
      startSelect.disabled = false;
      endSelect.disabled = false;
    });

    // 设置飞行管理器的回调
    this.flightManager.onFlightStart = (from, to) => {
      this._showStatus(`⏫ 飞行中：(${from.x}, ${from.y}, ${from.z}) → (${to.x}, ${to.y}, ${to.z})`, 'info');
      this._updateInfoDisplay(from, '飞行中');
    };

    this.flightManager.onFlightEnd = (location) => {
      this._updateInfoDisplay(location, '已到达');
    };

    this.flightManager.onFlightError = (error) => {
      this._showStatus('✗ 错误：' + error, 'error');
      this._updateInfoDisplay(null, '错误');
    };

    this.flightManager.onStatusUpdate = (message) => {
      console.log(message);
    };
  }

  /**
   * 更新按钮状态
   * @private
   */
  _updateButtonState(startSelect, endSelect, flyButton) {
    const hasStart = startSelect.value !== '';
    const hasEnd = endSelect.value !== '';
    flyButton.disabled = !(hasStart && hasEnd);
  }

  /**
   * 显示状态信息
   * @private
   */
  _showStatus(message, type = 'info') {
    if (this.statusDisplay) {
      this.statusDisplay.className = `flight-status-display status-${type}`;
      this.statusDisplay.innerHTML = `<p class="status-text">${message}</p>`;
    }
  }

  /**
   * 更新信息显示
   * @private
   */
  _updateInfoDisplay(location, state = '待飞行') {
    const infoEl = document.querySelector('#flight-info');
    const posEl = document.querySelector('#current-pos');
    const stateEl = document.querySelector('#flight-state');

    if (infoEl && location) {
      infoEl.style.display = 'block';
      posEl.textContent = `(${location.x}, ${location.y}, ${location.z})`;
      stateEl.textContent = state;
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimplifiedFlightControlUI;
}
