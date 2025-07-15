// 摄像头预设管理器 - 负责多摄像头预设位置管理
class CameraPresetManager {
  constructor() {
    this.presets = [
      {
        id: 'main-gate',
        name: '主入口',
        icon: '🚪',
        description: '校园主入口监控视角',
        ueFunction: 'SetCameraPreset',
        parameters: { PresetName: 'MainGate' }
      },
      {
        id: 'library-overview',
        name: '图书馆俯视',
        icon: '📚',
        description: '图书馆区域全景视角',
        ueFunction: 'SetCameraPreset',
        parameters: { PresetName: 'LibraryOverview' }
      },
      {
        id: 'dormitory-zone',
        name: '宿舍区监控',
        icon: '🏠',
        description: '宿舍区域安全监控视角',
        ueFunction: 'SetCameraPreset',
        parameters: { PresetName: 'DormitoryZone' }
      },
      {
        id: 'cafeteria-plaza',
        name: '食堂广场',
        icon: '🍽️',
        description: '食堂广场人流监控',
        ueFunction: 'SetCameraPreset',
        parameters: { PresetName: 'CafeteriaPlaza' }
      },
      {
        id: 'lab-building',
        name: '实验楼顶部',
        icon: '🔬',
        description: '实验楼顶部高视角',
        ueFunction: 'SetCameraPreset',
        parameters: { PresetName: 'LabBuildingTop' }
      },
      {
        id: 'stadium-panorama',
        name: '体育场全景',
        icon: '🏟️',
        description: '体育场全景监控视角',
        ueFunction: 'SetCameraPreset',
        parameters: { PresetName: 'StadiumPanorama' }
      }
    ];
    
    this.currentPreset = null;
    this.presetContainer = null;
  }

  initialize() {
    console.log('初始化摄像头预设管理器...');
    this.createPresetPanel();
    this.setupPresetControls();
    console.log('摄像头预设管理器初始化完成');
  }

  createPresetPanel() {
    const videoContainer = document.querySelector('.video-container');
    
    // 创建预设控制面板
    this.presetContainer = document.createElement('div');
    this.presetContainer.className = 'camera-preset-panel';
    this.presetContainer.style.cssText = `
      position: absolute;
      top: 15px;
      right: 15px;
      z-index: 15;
      background: rgba(26, 26, 46, 0.2);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 255, 255, 0.4);
      border-radius: 8px;
      padding: 15px;
      min-width: 220px;
      max-height: 300px;
      overflow-y: auto;
    `;

    // 添加标题
    const title = document.createElement('div');
    title.className = 'preset-title';
    title.textContent = '📹 摄像头预设';
    title.style.cssText = `
      font-family: 'Orbitron', monospace;
      font-weight: 700;
      color: #00ffff;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-size: 12px;
      text-shadow: 0 0 5px #00ffff;
      text-align: center;
    `;

    this.presetContainer.appendChild(title);
    
    // 添加预设按钮
    this.presets.forEach(preset => {
      const presetBtn = this.createPresetButton(preset);
      this.presetContainer.appendChild(presetBtn);
    });

    // 添加无人机跟随模式按钮
    const followBtn = document.createElement('button');
    followBtn.className = 'preset-btn follow-btn';
    followBtn.innerHTML = `<span class="preset-icon">🚁</span><span class="preset-name">跟随无人机</span>`;
    followBtn.style.cssText = this.getPresetButtonStyle('#ff0080');
    followBtn.addEventListener('click', () => this.activateFollowMode());
    
    this.presetContainer.appendChild(followBtn);

    videoContainer.appendChild(this.presetContainer);
  }

  createPresetButton(preset) {
    const button = document.createElement('button');
    button.className = 'preset-btn';
    button.dataset.presetId = preset.id;
    
    button.innerHTML = `
      <span class="preset-icon">${preset.icon}</span>
      <span class="preset-name">${preset.name}</span>
    `;
    
    button.style.cssText = this.getPresetButtonStyle();
    button.title = preset.description;
    
    button.addEventListener('click', () => this.activatePreset(preset));
    
    return button;
  }

  getPresetButtonStyle(borderColor = '#00ffff') {
    return `
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 12px;
      margin-bottom: 6px;
      background: rgba(0, 255, 255, 0.05);
      border: 1px solid ${borderColor};
      border-radius: 6px;
      color: #ffffff;
      font-family: 'Rajdhani', monospace;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.3s ease;
      backdrop-filter: blur(5px);
    `;
  }

  setupPresetControls() {
    // 添加CSS样式到页面
    const style = document.createElement('style');
    style.textContent = `
      .preset-btn:hover {
        background: rgba(0, 255, 255, 0.15) !important;
        box-shadow: 0 0 8px rgba(0, 255, 255, 0.3) !important;
        transform: translateY(-1px);
      }
      
      .preset-btn.active {
        background: rgba(0, 255, 255, 0.2) !important;
        box-shadow: 0 0 12px rgba(0, 255, 255, 0.5) !important;
        border-color: #00ff41 !important;
      }
      
      .preset-btn.follow-btn:hover {
        background: rgba(255, 0, 128, 0.15) !important;
        box-shadow: 0 0 8px rgba(255, 0, 128, 0.3) !important;
      }
      
      .preset-btn.follow-btn.active {
        background: rgba(255, 0, 128, 0.2) !important;
        box-shadow: 0 0 12px rgba(255, 0, 128, 0.5) !important;
      }
      
      .preset-icon {
        font-size: 16px;
        flex-shrink: 0;
      }
      
      .preset-name {
        flex: 1;
        text-align: left;
      }
      
      /* 自定义滚动条 */
      .camera-preset-panel::-webkit-scrollbar {
        width: 4px;
      }
      
      .camera-preset-panel::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 2px;
      }
      
      .camera-preset-panel::-webkit-scrollbar-thumb {
        background: rgba(0, 255, 255, 0.4);
        border-radius: 2px;
      }
      
      .camera-preset-panel::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 255, 255, 0.6);
      }
    `;
    document.head.appendChild(style);
  }

  async activatePreset(preset) {
    console.log(`激活摄像头预设: ${preset.name}`);
    
    // 清除之前的激活状态
    this.clearActiveStates();
    
    // 设置当前按钮为激活状态
    const button = this.presetContainer.querySelector(`[data-preset-id="${preset.id}"]`);
    if (button) {
      button.classList.add('active');
    }
    
    this.currentPreset = preset;
    
    try {
      // 调用UE API
      const result = await this.callUEPresetFunction(preset);
      
      if (result.success) {
        console.log(`摄像头预设切换成功: ${preset.name}`);
        this.updateStatus(`📹 ${preset.name}`, 'success');
        
        // 发送预设激活事件
        this.dispatchPresetEvent('activated', preset);
      } else {
        console.error(`摄像头预设切换失败: ${result.error}`);
        this.updateStatus(`预设切换失败: ${preset.name}`, 'error');
        button.classList.remove('active');
      }
    } catch (error) {
      console.error('摄像头预设切换出错:', error);
      this.updateStatus('预设切换出错', 'error');
      button.classList.remove('active');
    }
  }

  async callUEPresetFunction(preset) {
    if (!window.ueApiManager) {
      return { success: false, error: 'UE API Manager未初始化' };
    }

    // 根据预设类型调用不同的UE函数
    if (preset.ueFunction === 'SetCameraPreset') {
      // 调用新的摄像头预设函数
      return await ueApiManager.sendRequest(
        ueApiManager.levelScriptActorPath,
        'SetCameraPreset',
        preset.parameters
      );
    } else {
      // 兼容原有的ChangeView函数
      return await ueApiManager.changeView();
    }
  }

  async activateFollowMode() {
    console.log('激活无人机跟随模式');
    
    // 清除之前的激活状态
    this.clearActiveStates();
    
    // 设置跟随按钮为激活状态
    const followBtn = this.presetContainer.querySelector('.follow-btn');
    if (followBtn) {
      followBtn.classList.add('active');
    }
    
    this.currentPreset = { id: 'follow', name: '跟随无人机' };
    
    try {
      // 调用UE API启用跟随模式
      const result = await ueApiManager.sendRequest(
        ueApiManager.levelScriptActorPath,
        'SetCameraPreset',
        { PresetName: 'FollowDrone' }
      );
      
      if (result.success) {
        console.log('跟随模式激活成功');
        this.updateStatus('🚁 跟随无人机', 'success');
        
        // 发送跟随模式激活事件
        this.dispatchPresetEvent('follow-activated', { id: 'follow', name: '跟随无人机' });
      } else {
        console.error('跟随模式激活失败:', result.error);
        this.updateStatus('跟随模式激活失败', 'error');
        followBtn.classList.remove('active');
      }
    } catch (error) {
      console.error('跟随模式激活出错:', error);
      this.updateStatus('跟随模式激活出错', 'error');
      followBtn.classList.remove('active');
    }
  }

  clearActiveStates() {
    // 清除所有按钮的激活状态
    const allButtons = this.presetContainer.querySelectorAll('.preset-btn');
    allButtons.forEach(btn => btn.classList.remove('active'));
  }

  updateStatus(message, status) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
      
      // 设置状态样式
      if (status === 'success') {
        statusElement.dataset.status = 'connected';
      } else if (status === 'error') {
        statusElement.dataset.status = 'disconnected';
      }
    }
  }

  dispatchPresetEvent(eventType, preset) {
    // 发送自定义事件，供其他组件监听
    const event = new CustomEvent('cameraPresetChange', {
      detail: {
        type: eventType,
        preset: preset,
        timestamp: Date.now()
      }
    });
    
    window.dispatchEvent(event);
  }

  // 添加新的预设
  addPreset(preset) {
    // 检查是否已存在
    const existingIndex = this.presets.findIndex(p => p.id === preset.id);
    
    if (existingIndex !== -1) {
      // 更新现有预设
      this.presets[existingIndex] = preset;
    } else {
      // 添加新预设
      this.presets.push(preset);
    }
    
    // 重新创建面板
    this.refreshPresetPanel();
  }

  // 删除预设
  removePreset(presetId) {
    const index = this.presets.findIndex(p => p.id === presetId);
    if (index !== -1) {
      this.presets.splice(index, 1);
      this.refreshPresetPanel();
    }
  }

  refreshPresetPanel() {
    // 清空现有面板内容
    const title = this.presetContainer.querySelector('.preset-title');
    this.presetContainer.innerHTML = '';
    this.presetContainer.appendChild(title);
    
    // 重新添加预设按钮
    this.presets.forEach(preset => {
      const presetBtn = this.createPresetButton(preset);
      this.presetContainer.appendChild(presetBtn);
    });
    
    // 重新添加跟随按钮
    const followBtn = document.createElement('button');
    followBtn.className = 'preset-btn follow-btn';
    followBtn.innerHTML = `<span class="preset-icon">🚁</span><span class="preset-name">跟随无人机</span>`;
    followBtn.style.cssText = this.getPresetButtonStyle('#ff0080');
    followBtn.addEventListener('click', () => this.activateFollowMode());
    
    this.presetContainer.appendChild(followBtn);
  }

  // 获取当前激活的预设
  getCurrentPreset() {
    return this.currentPreset;
  }

  // 获取所有预设列表
  getAllPresets() {
    return [...this.presets];
  }

  // 根据ID获取预设
  getPresetById(presetId) {
    return this.presets.find(p => p.id === presetId);
  }

  // 显示/隐藏预设面板
  togglePresetPanel() {
    if (this.presetContainer.style.display === 'none') {
      this.presetContainer.style.display = 'block';
    } else {
      this.presetContainer.style.display = 'none';
    }
  }

  // 设置预设面板位置
  setPresetPanelPosition(position) {
    const positions = {
      'top-right': { top: '15px', right: '15px', left: 'auto', bottom: 'auto' },
      'top-left': { top: '15px', left: '15px', right: 'auto', bottom: 'auto' },
      'bottom-right': { bottom: '15px', right: '15px', top: 'auto', left: 'auto' },
      'bottom-left': { bottom: '15px', left: '15px', top: 'auto', right: 'auto' }
    };
    
    const pos = positions[position] || positions['top-right'];
    Object.assign(this.presetContainer.style, pos);
  }
}

// 创建全局实例
window.cameraPresetManager = new CameraPresetManager();
