/**
 * 无人机路径规划 UI 管理器
 * 集成到自动驾驶场景中，提供路径编辑和飞行控制功能
 */
class DronePathPlanningUI {
  constructor(dashboardManager) {
    this.dashboardManager = dashboardManager;
    this.pathManager = null;
    this.isPathEditing = false;
    this.presetPaths = this._initPresetPaths();
  }

  /**
   * 初始化预设路径（示例）
   * @private
   */
  _initPresetPaths() {
    return {
      'patrol_campus': {
        name: '校园巡逻',
        path: {
          type: 'sequential',
          waypoints: [
            { x: 0, y: 0, z: 100 },
            { x: 500, y: 400, z: 120 },
            { x: -850, y: -30, z: 62 },
            { x: -200, y: 300, z: 75 },
            { x: 0, y: 0, z: 100 }
          ],
          speed: 'normal'
        }
      },
      'quick_delivery': {
        name: '快速配送',
        path: {
          type: 'single',
          target: { x: 500, y: 400, z: 80 },
          speed: 'fast'
        }
      },
      'slow_inspection': {
        name: '缓速检查',
        path: {
          type: 'advanced',
          waypoints: [
            { x: 0, y: 0, z: 100, speed: 'slow' },
            { x: 100, y: 100, z: 110, speed: 'slow', delayBefore: 1000 },
            { x: 200, y: 200, z: 120, speed: 'slow', delayBefore: 1000 }
          ],
          loopCount: 1,
          autoReturn: true
        }
      }
    };
  }

  /**
   * 创建并注入路径规划 UI
   * @param {HTMLElement} container - 容器元素
   * @param {FlightPathManager} pathManager - 路径管理器实例
   */
  createUI(container, pathManager) {
    this.pathManager = pathManager;

    const html = `
      <div class="path-planning-card">
        <div class="card-header">
          <h3>🚁 无人机路径规划</h3>
        </div>
        
        <div class="card-content">
          <!-- 路径类型选择 -->
          <div class="section">
            <label class="section-title">路径类型</label>
            <div class="path-type-buttons">
              <button class="path-type-btn active" data-type="single">
                <i class="fas fa-crosshairs"></i> 单点飞行
              </button>
              <button class="path-type-btn" data-type="sequential">
                <i class="fas fa-route"></i> 多点飞行
              </button>
              <button class="path-type-btn" data-type="advanced">
                <i class="fas fa-cogs"></i> 高级设置
              </button>
            </div>
          </div>

          <!-- 预设路径 -->
          <div class="section">
            <label class="section-title">预设路径</label>
            <select id="preset-paths" class="form-control">
              <option value="">-- 选择预设路径 --</option>
              <option value="quick_delivery">快速配送</option>
              <option value="patrol_campus">校园巡逻</option>
              <option value="slow_inspection">缓速检查</option>
            </select>
          </div>

          <!-- 单点飞行编辑 (默认显示) -->
          <div class="path-editor-section" data-editor="single" style="display: block;">
            <label class="section-title">目标位置</label>
            <div class="coordinate-input-group">
              <div class="coord-input">
                <label>X:</label>
                <input type="number" id="single-x" value="0" placeholder="X 坐标">
              </div>
              <div class="coord-input">
                <label>Y:</label>
                <input type="number" id="single-y" value="0" placeholder="Y 坐标">
              </div>
              <div class="coord-input">
                <label>Z:</label>
                <input type="number" id="single-z" value="100" placeholder="Z 坐标">
              </div>
            </div>
            <div class="coord-input full">
              <label>速度:</label>
              <select id="single-speed">
                <option value="slow">缓速</option>
                <option value="normal" selected>正常</option>
                <option value="fast">快速</option>
              </select>
            </div>
          </div>

          <!-- 多点飞行编辑 (隐藏) -->
          <div class="path-editor-section" data-editor="sequential" style="display: none;">
            <label class="section-title">路径点管理</label>
            <div id="waypoints-list" class="waypoints-list"></div>
            <button id="add-waypoint" class="btn btn-secondary">
              <i class="fas fa-plus"></i> 添加路径点
            </button>
            <div class="coord-input full" style="margin-top: 10px;">
              <label>速度:</label>
              <select id="sequential-speed">
                <option value="slow">缓速</option>
                <option value="normal" selected>正常</option>
                <option value="fast">快速</option>
              </select>
            </div>
          </div>

          <!-- 高级设置 (隐藏) -->
          <div class="path-editor-section" data-editor="advanced" style="display: none;">
            <label class="section-title">高级路径点</label>
            <div id="advanced-waypoints-list" class="waypoints-list"></div>
            <button id="add-advanced-waypoint" class="btn btn-secondary">
              <i class="fas fa-plus"></i> 添加路径点
            </button>
            <div class="advanced-options">
              <div class="coord-input">
                <label>循环次数:</label>
                <input type="number" id="loop-count" value="1" min="1" max="10">
              </div>
              <div class="checkbox-input">
                <input type="checkbox" id="auto-return">
                <label for="auto-return">完成后返回起点</label>
              </div>
            </div>
          </div>

          <!-- 路径信息 -->
          <div class="section" style="background: #f5f5f5; padding: 10px; border-radius: 4px; margin: 10px 0;">
            <div id="path-info" class="path-info">未设置路径</div>
          </div>

          <!-- 飞行控制 -->
          <div class="flight-controls">
            <button id="set-path-btn" class="btn btn-primary">
              <i class="fas fa-save"></i> 保存路径
            </button>
            <button id="start-flight-btn" class="btn btn-success" disabled>
              <i class="fas fa-play"></i> 开始飞行
            </button>
            <button id="pause-flight-btn" class="btn btn-warning" disabled>
              <i class="fas fa-pause"></i> 暂停
            </button>
            <button id="clear-path-btn" class="btn btn-danger">
              <i class="fas fa-trash"></i> 清空
            </button>
          </div>

          <!-- 飞行状态 -->
          <div class="flight-status" style="display: none; background: #e3f2fd; padding: 10px; border-radius: 4px; margin-top: 10px;">
            <div class="status-item">
              <label>当前位置:</label>
              <span id="current-location">(0, 0, 0)</span>
            </div>
            <div class="status-item">
              <label>目标位置:</label>
              <span id="target-location">未设置</span>
            </div>
            <div class="status-item">
              <label>飞行状态:</label>
              <span id="flight-state">待飞行</span>
            </div>
            <div class="status-item">
              <label>当前路径点:</label>
              <span id="current-waypoint">--</span>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this._attachEventListeners(container);
    this._initializePathManager();
  }

  /**
   * 绑定事件监听
   * @private
   */
  _attachEventListeners(container) {
    // 路径类型切换
    container.querySelectorAll('.path-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.type;
        this._switchPathEditor(type, container);
      });
    });

    // 预设路径
    const presetSelect = container.querySelector('#preset-paths');
    presetSelect?.addEventListener('change', (e) => {
      if (e.target.value) {
        this._loadPresetPath(e.target.value);
      }
    });

    // 保存路径
    container.querySelector('#set-path-btn')?.addEventListener('click', () => {
      this._saveCurrentPath(container);
    });

    // 开始飞行
    container.querySelector('#start-flight-btn')?.addEventListener('click', () => {
      this._startFlight();
    });

    // 暂停飞行
    container.querySelector('#pause-flight-btn')?.addEventListener('click', () => {
      this._pauseFlight();
    });

    // 清空路径
    container.querySelector('#clear-path-btn')?.addEventListener('click', () => {
      this._clearPath(container);
    });

    // 添加路径点 (多点)
    container.querySelector('#add-waypoint')?.addEventListener('click', () => {
      this._addWaypoint('sequential', container);
    });

    // 添加路径点 (高级)
    container.querySelector('#add-advanced-waypoint')?.addEventListener('click', () => {
      this._addWaypoint('advanced', container);
    });
  }

  /**
   * 初始化路径管理器事件
   * @private
   */
  _initializePathManager() {
    if (!this.pathManager) return;

    this.pathManager.on('onPathUpdated', (path) => {
      this._updatePathInfo(path);
      this._updateFlightButtons();
    });

    this.pathManager.on('onFlightStarted', (path) => {
      this._updateFlightStatus('flying', '飞行中...');
    });

    this.pathManager.on('onFlightPaused', (data) => {
      this._updateFlightStatus('paused', '已暂停');
    });

    this.pathManager.on('onWaypointReached', (data) => {
      console.log(`到达路径点 ${data.index}:`, data.coordinate);
      const info = document.querySelector('#current-waypoint');
      if (info) {
        info.textContent = `${data.index}/${this.pathManager.currentPath?.waypoints?.length || 1}`;
      }
    });

    this.pathManager.on('onFlightCompleted', (data) => {
      this._updateFlightStatus('completed', '飞行完成');
      setTimeout(() => {
        this._updateFlightStatus('idle', '待飞行');
      }, 2000);
    });

    this.pathManager.on('onFlightError', (data) => {
      this._updateFlightStatus('error', '错误: ' + (data.message || data.error || '未知错误'));
      alert('飞行错误: ' + (data.message || data.error || '未知错误'));
    });
  }

  /**
   * 切换路径编辑器
   * @private
   */
  _switchPathEditor(type, container) {
    // 更新按钮状态
    container.querySelectorAll('.path-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });

    // 切换编辑器显示
    container.querySelectorAll('.path-editor-section').forEach(section => {
      section.style.display = section.dataset.editor === type ? 'block' : 'none';
    });

    // 初始化编辑器内容
    if (type === 'sequential') {
      this._initSequentialEditor(container);
    } else if (type === 'advanced') {
      this._initAdvancedEditor(container);
    }
  }

  /**
   * 初始化多点编辑器
   * @private
   */
  _initSequentialEditor(container) {
    const list = container.querySelector('#waypoints-list');
    if (!list) return;

    // 如果列表为空，添加默认路径点
    if (list.children.length === 0) {
      this._addWaypoint('sequential', container);
      this._addWaypoint('sequential', container);
    }
  }

  /**
   * 初始化高级编辑器
   * @private
   */
  _initAdvancedEditor(container) {
    const list = container.querySelector('#advanced-waypoints-list');
    if (!list) return;

    // 如果列表为空，添加默认路径点
    if (list.children.length === 0) {
      this._addWaypoint('advanced', container);
    }
  }

  /**
   * 添加路径点
   * @private
   */
  _addWaypoint(type, container) {
    const listSelector = type === 'sequential' ? '#waypoints-list' : '#advanced-waypoints-list';
    const list = container.querySelector(listSelector);
    if (!list) return;

    const index = list.children.length;
    const waypointHtml = this._createWaypointHTML(type, index);
    
    const waypointElement = document.createElement('div');
    waypointElement.className = 'waypoint-item';
    waypointElement.innerHTML = waypointHtml;
    
    // 删除按钮事件
    waypointElement.querySelector('.delete-waypoint-btn')?.addEventListener('click', () => {
      waypointElement.remove();
    });

    list.appendChild(waypointElement);
  }

  /**
   * 创建路径点 HTML
   * @private
   */
  _createWaypointHTML(type, index) {
    let html = `
      <div class="waypoint-content">
        <span class="waypoint-index">点 ${index + 1}</span>
        <div class="waypoint-coords">
          <input type="number" class="wp-x" placeholder="X" value="0">
          <input type="number" class="wp-y" placeholder="Y" value="0">
          <input type="number" class="wp-z" placeholder="Z" value="100">
        </div>
    `;

    if (type === 'advanced') {
      html += `
        <div class="waypoint-advanced">
          <select class="wp-speed">
            <option value="slow">缓速</option>
            <option value="normal" selected>正常</option>
            <option value="fast">快速</option>
          </select>
          <input type="number" class="wp-delay" placeholder="延迟(ms)" value="0" min="0">
        </div>
      `;
    }

    html += `
        <button class="delete-waypoint-btn" title="删除路径点">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    return html;
  }

  /**
   * 保存当前路径
   * @private
   */
  _saveCurrentPath(container) {
    const activeType = container.querySelector('.path-type-btn.active')?.dataset.type || 'single';
    let pathData = null;

    try {
      if (activeType === 'single') {
        pathData = this._readSinglePath(container);
      } else if (activeType === 'sequential') {
        pathData = this._readSequentialPath(container);
      } else if (activeType === 'advanced') {
        pathData = this._readAdvancedPath(container);
      }

      if (pathData && this.pathManager.setPath(pathData)) {
        alert('路径已保存!');
      } else {
        alert('路径保存失败，请检查输入');
      }
    } catch (error) {
      alert('保存路径时出错: ' + error.message);
    }
  }

  /**
   * 读取单点路径数据
   * @private
   */
  _readSinglePath(container) {
    return {
      type: 'single',
      target: {
        x: parseFloat(container.querySelector('#single-x').value || 0),
        y: parseFloat(container.querySelector('#single-y').value || 0),
        z: parseFloat(container.querySelector('#single-z').value || 100)
      },
      speed: container.querySelector('#single-speed').value
    };
  }

  /**
   * 读取多点路径数据
   * @private
   */
  _readSequentialPath(container) {
    const waypoints = [];
    container.querySelectorAll('#waypoints-list .waypoint-item').forEach(item => {
      waypoints.push({
        x: parseFloat(item.querySelector('.wp-x').value || 0),
        y: parseFloat(item.querySelector('.wp-y').value || 0),
        z: parseFloat(item.querySelector('.wp-z').value || 100)
      });
    });

    return {
      type: 'sequential',
      waypoints,
      speed: container.querySelector('#sequential-speed').value
    };
  }

  /**
   * 读取高级路径数据
   * @private
   */
  _readAdvancedPath(container) {
    const waypoints = [];
    container.querySelectorAll('#advanced-waypoints-list .waypoint-item').forEach(item => {
      waypoints.push({
        x: parseFloat(item.querySelector('.wp-x').value || 0),
        y: parseFloat(item.querySelector('.wp-y').value || 0),
        z: parseFloat(item.querySelector('.wp-z').value || 100),
        speed: item.querySelector('.wp-speed').value,
        delayBefore: parseInt(item.querySelector('.wp-delay').value || 0)
      });
    });

    return {
      type: 'advanced',
      waypoints,
      loopCount: parseInt(container.querySelector('#loop-count').value || 1),
      autoReturn: container.querySelector('#auto-return').checked
    };
  }

  /**
   * 加载预设路径
   * @private
   */
  _loadPresetPath(presetKey) {
    const preset = this.presetPaths[presetKey];
    if (!preset && this.pathManager.setPath(preset.path)) {
      console.log(`已加载预设路径: ${preset.name}`);
    }
  }

  /**
   * 开始飞行
   * @private
   */
  async _startFlight() {
    if (this.pathManager) {
      const result = await this.pathManager.startFlight();
      if (!result.success) {
        alert('开始飞行失败: ' + result.error);
      }
    }
  }

  /**
   * 暂停飞行
   * @private
   */
  _pauseFlight() {
    if (this.pathManager) {
      const result = this.pathManager.pauseFlight();
      if (!result.success) {
        alert(result.error);
      }
    }
  }

  /**
   * 清空路径
   * @private
   */
  _clearPath(container) {
    if (this.pathManager) {
      this.pathManager.clearPath();
      container.querySelector('#path-info').textContent = '未设置路径';
      this._updateFlightButtons();
    }
  }

  /**
   * 更新路径信息显示
   * @private
   */
  _updatePathInfo(path) {
    const infoEl = document.querySelector('#path-info');
    if (!infoEl) return;

    if (!path) {
      infoEl.textContent = '未设置路径';
      return;
    }

    infoEl.textContent = this.pathManager.getPathDescription();
  }

  /**
   * 更新飞行按钮状态
   * @private
   */
  _updateFlightButtons() {
    const hasPath = this.pathManager?.currentPath !== null;
    const isFlying = this.pathManager?.isFlying || false;

    document.querySelector('#start-flight-btn')!.disabled = !hasPath || isFlying;
    document.querySelector('#pause-flight-btn')!.disabled = !isFlying;
  }

  /**
   * 更新飞行状态显示
   * @private
   */
  _updateFlightStatus(state, message) {
    const stateEl = document.querySelector('#flight-state');
    if (stateEl) {
      stateEl.textContent = message;
      stateEl.className = `flight-state-${state}`;
    }

    const statusContainer = document.querySelector('.flight-status');
    if (statusContainer) {
      statusContainer.style.display = 'block';
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DronePathPlanningUI;
}
