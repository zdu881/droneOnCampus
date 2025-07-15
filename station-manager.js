// 基站设备管理器 - 负责基站设备的添加、管理和监控
class StationManager {
  constructor() {
    this.stations = [];
    this.stationTypes = {
      charging: {
        name: '充电基站',
        icon: '🔋',
        color: '#00ff41',
        description: '无人机充电和停靠',
        properties: ['batteryCapacity', 'chargingSpeed', 'maxDrones']
      },
      communication: {
        name: '通信基站',
        icon: '📡',
        color: '#0099ff',
        description: '信号中继和数据传输',
        properties: ['signalRange', 'dataRate', 'frequency']
      },
      weather: {
        name: '气象站',
        icon: '🌡️',
        color: '#ffaa00',
        description: '环境数据监测',
        properties: ['temperature', 'humidity', 'windSpeed', 'pressure']
      },
      security: {
        name: '安全基站',
        icon: '🛡️',
        color: '#ff3030',
        description: '监控和报警设备',
        properties: ['cameraCount', 'detectionRange', 'alertType']
      }
    };
    
    this.nextStationId = 1;
    this.stationPanel = null;
    this.addStationModal = null;
  }

  initialize() {
    console.log('初始化基站管理器...');
    this.createStationPanel();
    this.createAddStationModal();
    this.initializeDefaultStations();
    console.log('基站管理器初始化完成');
  }

  createStationPanel() {
    const videoContainer = document.querySelector('.video-container');
    
    // 创建基站管理面板
    this.stationPanel = document.createElement('div');
    this.stationPanel.className = 'station-management-panel';
    this.stationPanel.style.cssText = `
      position: absolute;
      bottom: 15px;
      left: 15px;
      z-index: 15;
      background: rgba(26, 26, 46, 0.2);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 170, 0, 0.4);
      border-radius: 8px;
      padding: 15px;
      min-width: 250px;
      max-height: 250px;
      overflow-y: auto;
    `;

    // 添加标题和添加按钮
    const header = document.createElement('div');
    header.className = 'station-header';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    `;

    const title = document.createElement('div');
    title.className = 'station-title';
    title.textContent = '🏗️ 基站管理';
    title.style.cssText = `
      font-family: 'Orbitron', monospace;
      font-weight: 700;
      color: #ffaa00;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-size: 12px;
      text-shadow: 0 0 5px #ffaa00;
    `;

    const addBtn = document.createElement('button');
    addBtn.className = 'add-station-btn';
    addBtn.innerHTML = '➕ 添加';
    addBtn.style.cssText = `
      padding: 4px 8px;
      background: rgba(255, 170, 0, 0.1);
      border: 1px solid #ffaa00;
      color: #ffaa00;
      border-radius: 4px;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    addBtn.addEventListener('click', () => this.showAddStationModal());

    header.appendChild(title);
    header.appendChild(addBtn);
    this.stationPanel.appendChild(header);

    // 添加基站状态概览
    const statusOverview = document.createElement('div');
    statusOverview.className = 'station-status-overview';
    statusOverview.id = 'station-status-overview';
    statusOverview.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 12px;
      padding: 8px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 6px;
    `;

    this.stationPanel.appendChild(statusOverview);

    // 添加基站列表
    const stationList = document.createElement('div');
    stationList.className = 'station-list';
    stationList.id = 'station-list';
    stationList.style.cssText = `
      max-height: 120px;
      overflow-y: auto;
    `;

    this.stationPanel.appendChild(stationList);

    videoContainer.appendChild(this.stationPanel);

    // 添加样式
    this.addStationPanelStyles();
  }

  addStationPanelStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .add-station-btn:hover {
        background: rgba(255, 170, 0, 0.2) !important;
        box-shadow: 0 0 8px rgba(255, 170, 0, 0.3) !important;
      }
      
      .station-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 8px;
        margin-bottom: 4px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 4px;
        border-left: 3px solid var(--station-color);
        transition: all 0.3s ease;
      }
      
      .station-item:hover {
        background: rgba(255, 255, 255, 0.05);
        transform: translateX(2px);
      }
      
      .station-info {
        flex: 1;
      }
      
      .station-name {
        font-size: 11px;
        font-weight: 600;
        color: #ffffff;
        margin-bottom: 2px;
      }
      
      .station-type {
        font-size: 9px;
        color: #a0a9c0;
      }
      
      .station-status {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: 600;
      }
      
      .station-status.online {
        background: rgba(0, 255, 65, 0.2);
        color: #00ff41;
      }
      
      .station-status.offline {
        background: rgba(255, 48, 48, 0.2);
        color: #ff3030;
      }
      
      .station-actions {
        display: flex;
        gap: 4px;
      }
      
      .station-action-btn {
        padding: 2px 4px;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: #ffffff;
        border-radius: 3px;
        font-size: 10px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      
      .station-action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .status-item {
        text-align: center;
        padding: 4px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
      }
      
      .status-icon {
        font-size: 14px;
        margin-bottom: 2px;
      }
      
      .status-count {
        font-size: 10px;
        font-weight: 600;
        color: #ffffff;
      }
      
      .status-label {
        font-size: 8px;
        color: #a0a9c0;
      }
      
      /* 自定义滚动条 */
      .station-management-panel::-webkit-scrollbar,
      .station-list::-webkit-scrollbar {
        width: 4px;
      }
      
      .station-management-panel::-webkit-scrollbar-track,
      .station-list::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 2px;
      }
      
      .station-management-panel::-webkit-scrollbar-thumb,
      .station-list::-webkit-scrollbar-thumb {
        background: rgba(255, 170, 0, 0.4);
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  createAddStationModal() {
    // 创建模态框
    this.addStationModal = document.createElement('div');
    this.addStationModal.className = 'add-station-modal';
    this.addStationModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.cssText = `
      background: rgba(26, 26, 46, 0.95);
      backdrop-filter: blur(15px);
      border: 1px solid rgba(255, 170, 0, 0.6);
      border-radius: 12px;
      padding: 25px;
      width: 400px;
      max-width: 90vw;
      color: #ffffff;
      font-family: 'Rajdhani', monospace;
    `;

    modalContent.innerHTML = `
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0; color: #ffaa00; font-family: 'Orbitron', monospace;">🏗️ 添加基站设备</h3>
        <button class="close-modal-btn" style="background: none; border: none; color: #ffffff; font-size: 24px; cursor: pointer;">×</button>
      </div>
      
      <form class="add-station-form">
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #a0a9c0;">基站名称:</label>
          <input type="text" name="stationName" placeholder="输入基站名称" required style="width: 100%; padding: 8px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 170, 0, 0.5); border-radius: 4px; color: #ffffff; font-size: 14px;">
        </div>
        
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #a0a9c0;">基站类型:</label>
          <select name="stationType" required style="width: 100%; padding: 8px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 170, 0, 0.5); border-radius: 4px; color: #ffffff; font-size: 14px;">
            <option value="">选择基站类型</option>
            <option value="charging">🔋 充电基站</option>
            <option value="communication">📡 通信基站</option>
            <option value="weather">🌡️ 气象站</option>
            <option value="security">🛡️ 安全基站</option>
          </select>
        </div>
        
        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 15px;">
          <div class="form-group">
            <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #a0a9c0;">X坐标:</label>
            <input type="number" name="positionX" placeholder="0" required style="width: 100%; padding: 6px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 170, 0, 0.5); border-radius: 4px; color: #ffffff; font-size: 12px;">
          </div>
          <div class="form-group">
            <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #a0a9c0;">Y坐标:</label>
            <input type="number" name="positionY" placeholder="0" required style="width: 100%; padding: 6px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 170, 0, 0.5); border-radius: 4px; color: #ffffff; font-size: 12px;">
          </div>
          <div class="form-group">
            <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #a0a9c0;">Z坐标:</label>
            <input type="number" name="positionZ" placeholder="0" required style="width: 100%; padding: 6px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 170, 0, 0.5); border-radius: 4px; color: #ffffff; font-size: 12px;">
          </div>
        </div>
        
        <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
          <button type="button" class="cancel-btn" style="padding: 10px 20px; background: rgba(255, 48, 48, 0.2); border: 1px solid #ff3030; color: #ff3030; border-radius: 6px; cursor: pointer;">取消</button>
          <button type="submit" class="submit-btn" style="padding: 10px 20px; background: rgba(255, 170, 0, 0.2); border: 1px solid #ffaa00; color: #ffaa00; border-radius: 6px; cursor: pointer;">添加基站</button>
        </div>
      </form>
    `;

    this.addStationModal.appendChild(modalContent);
    document.body.appendChild(this.addStationModal);

    // 绑定事件
    this.setupModalEvents();
  }

  setupModalEvents() {
    const closeBtn = this.addStationModal.querySelector('.close-modal-btn');
    const cancelBtn = this.addStationModal.querySelector('.cancel-btn');
    const form = this.addStationModal.querySelector('.add-station-form');

    closeBtn.addEventListener('click', () => this.hideAddStationModal());
    cancelBtn.addEventListener('click', () => this.hideAddStationModal());
    
    // 点击模态框外部关闭
    this.addStationModal.addEventListener('click', (e) => {
      if (e.target === this.addStationModal) {
        this.hideAddStationModal();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddStation(new FormData(form));
    });
  }

  showAddStationModal() {
    this.addStationModal.style.display = 'flex';
  }

  hideAddStationModal() {
    this.addStationModal.style.display = 'none';
    // 重置表单
    const form = this.addStationModal.querySelector('.add-station-form');
    form.reset();
  }

  async handleAddStation(formData) {
    const stationData = {
      id: this.nextStationId++,
      name: formData.get('stationName'),
      type: formData.get('stationType'),
      x: parseFloat(formData.get('positionX')),
      y: parseFloat(formData.get('positionY')),
      z: parseFloat(formData.get('positionZ')),
      status: 'online',
      createdAt: new Date().toISOString(),
      properties: this.getDefaultProperties(formData.get('stationType'))
    };

    try {
      // 调用UE API添加基站
      const result = await this.callAddStationAPI(stationData);
      
      if (result.success) {
        // 添加到本地管理
        this.stations.push(stationData);
        
        // 更新UI
        this.updateStationDisplay();
        
        // 在地图上添加标记
        if (window.mapManager) {
          mapManager.addStationMarker(stationData);
        }
        
        console.log(`基站添加成功: ${stationData.name}`);
        this.hideAddStationModal();
        
        // 显示成功提示
        this.showNotification(`基站 "${stationData.name}" 添加成功!`, 'success');
      } else {
        console.error('基站添加失败:', result.error);
        this.showNotification(`基站添加失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('基站添加出错:', error);
      this.showNotification('基站添加出错，请检查连接', 'error');
    }
  }

  async callAddStationAPI(stationData) {
    if (!window.ueApiManager) {
      return { success: false, error: 'UE API Manager未初始化' };
    }

    // 调用UE API添加基站
    return await ueApiManager.sendRequest(
      ueApiManager.levelScriptActorPath,
      'AddStation',
      {
        StationType: stationData.type,
        X: stationData.x,
        Y: stationData.y,
        Z: stationData.z,
        StationName: stationData.name
      }
    );
  }

  getDefaultProperties(stationType) {
    const defaults = {
      charging: {
        batteryCapacity: '100kWh',
        chargingSpeed: '50kW',
        maxDrones: 4
      },
      communication: {
        signalRange: '5km',
        dataRate: '100Mbps',
        frequency: '2.4GHz'
      },
      weather: {
        temperature: '22°C',
        humidity: '65%',
        windSpeed: '12km/h',
        pressure: '1013hPa'
      },
      security: {
        cameraCount: 4,
        detectionRange: '200m',
        alertType: 'Motion Detection'
      }
    };

    return defaults[stationType] || {};
  }

  initializeDefaultStations() {
    // 添加一些默认基站
    const defaultStations = [
      {
        id: this.nextStationId++,
        name: '主入口充电站',
        type: 'charging',
        x: 0,
        y: 0,
        z: 50,
        status: 'online',
        properties: this.getDefaultProperties('charging')
      },
      {
        id: this.nextStationId++,
        name: '图书馆通信中继',
        type: 'communication',
        x: -850,
        y: -30,
        z: 80,
        status: 'online',
        properties: this.getDefaultProperties('communication')
      },
      {
        id: this.nextStationId++,
        name: '体育场气象站',
        type: 'weather',
        x: 500,
        y: 600,
        z: 60,
        status: 'online',
        properties: this.getDefaultProperties('weather')
      }
    ];

    this.stations = defaultStations;
    this.updateStationDisplay();

    // 在地图上添加默认基站标记
    if (window.mapManager && window.mapManager.map) {
      defaultStations.forEach(station => {
        mapManager.addStationMarker(station);
      });
    }
  }

  updateStationDisplay() {
    this.updateStatusOverview();
    this.updateStationList();
  }

  updateStatusOverview() {
    const overview = document.getElementById('station-status-overview');
    if (!overview) return;

    const typeCounts = {};
    const statusCounts = { online: 0, offline: 0 };

    this.stations.forEach(station => {
      typeCounts[station.type] = (typeCounts[station.type] || 0) + 1;
      statusCounts[station.status]++;
    });

    overview.innerHTML = '';

    // 添加各类型基站数量
    Object.entries(this.stationTypes).forEach(([type, config]) => {
      const count = typeCounts[type] || 0;
      const item = document.createElement('div');
      item.className = 'status-item';
      item.innerHTML = `
        <div class="status-icon">${config.icon}</div>
        <div class="status-count">${count}</div>
        <div class="status-label">${config.name}</div>
      `;
      overview.appendChild(item);
    });
  }

  updateStationList() {
    const list = document.getElementById('station-list');
    if (!list) return;

    list.innerHTML = '';

    this.stations.forEach(station => {
      const stationItem = this.createStationItem(station);
      list.appendChild(stationItem);
    });
  }

  createStationItem(station) {
    const item = document.createElement('div');
    item.className = 'station-item';
    item.style.setProperty('--station-color', this.stationTypes[station.type].color);

    item.innerHTML = `
      <div class="station-info">
        <div class="station-name">${this.stationTypes[station.type].icon} ${station.name}</div>
        <div class="station-type">${this.stationTypes[station.type].name}</div>
      </div>
      <div class="station-status ${station.status}">${station.status === 'online' ? '在线' : '离线'}</div>
      <div class="station-actions">
        <button class="station-action-btn" onclick="stationManager.toggleStationStatus(${station.id})">
          ${station.status === 'online' ? '📴' : '📶'}
        </button>
        <button class="station-action-btn" onclick="stationManager.removeStation(${station.id})">🗑️</button>
      </div>
    `;

    return item;
  }

  async toggleStationStatus(stationId) {
    const station = this.stations.find(s => s.id === stationId);
    if (!station) return;

    const newStatus = station.status === 'online' ? 'offline' : 'online';
    
    try {
      // 调用UE API更新基站状态
      const result = await ueApiManager.sendRequest(
        ueApiManager.levelScriptActorPath,
        'UpdateStationStatus',
        {
          StationID: stationId,
          Status: newStatus
        }
      );

      if (result.success) {
        station.status = newStatus;
        this.updateStationDisplay();
        console.log(`基站 ${station.name} 状态已更新为: ${newStatus}`);
      }
    } catch (error) {
      console.error('更新基站状态失败:', error);
    }
  }

  async removeStation(stationId) {
    if (!confirm('确定要删除这个基站吗？')) return;

    const stationIndex = this.stations.findIndex(s => s.id === stationId);
    if (stationIndex === -1) return;

    const station = this.stations[stationIndex];

    try {
      // 调用UE API删除基站
      const result = await ueApiManager.sendRequest(
        ueApiManager.levelScriptActorPath,
        'RemoveStation',
        { StationID: stationId }
      );

      if (result.success) {
        // 从本地删除
        this.stations.splice(stationIndex, 1);
        
        // 更新UI
        this.updateStationDisplay();
        
        // 从地图上删除标记
        if (window.mapManager) {
          mapManager.removeStationMarker(stationId);
        }
        
        console.log(`基站 ${station.name} 已删除`);
        this.showNotification(`基站 "${station.name}" 已删除`, 'success');
      }
    } catch (error) {
      console.error('删除基站失败:', error);
      this.showNotification('删除基站失败', 'error');
    }
  }

  showNotification(message, type) {
    // 简单的通知显示
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2000;
      padding: 12px 20px;
      border-radius: 6px;
      color: white;
      font-family: 'Rajdhani', monospace;
      font-weight: 600;
      background: ${type === 'success' ? 'rgba(0, 255, 65, 0.2)' : 'rgba(255, 48, 48, 0.2)'};
      border: 1px solid ${type === 'success' ? '#00ff41' : '#ff3030'};
      backdrop-filter: blur(10px);
      animation: fadeInOut 3s ease-in-out forwards;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);

    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(100%); }
        15%, 85% { opacity: 1; transform: translateX(0); }
        100% { opacity: 0; transform: translateX(100%); }
      }
    `;
    document.head.appendChild(style);

    // 3秒后自动删除
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 3000);
  }

  // 获取所有基站
  getAllStations() {
    return [...this.stations];
  }

  // 根据类型获取基站
  getStationsByType(type) {
    return this.stations.filter(s => s.type === type);
  }

  // 根据状态获取基站
  getStationsByStatus(status) {
    return this.stations.filter(s => s.status === status);
  }

  // 根据ID获取基站
  getStationById(stationId) {
    return this.stations.find(s => s.id === stationId);
  }
}

// 创建全局实例
window.stationManager = new StationManager();
