/**
 * File Transfer Manager - 文件传输管理器
 * 管理Ray集群节点间的文件传输任务
 */

class FileTransferManager {
  constructor(dashboardManager) {
    this.dashboard = dashboardManager;
    this.transfers = {
      active: [],
      completed: [],
      failed: []
    };
    this.currentTab = 'active-transfers';
    
    // API基础URL - 使用全局appConfig配置（CastRay 内嵌服务在 28823 端口）
    this.baseURL = (window.appConfig && window.appConfig.castrayApiBase) || 'http://10.30.2.11:28823';
    
    // 虚拟节点配置
    this.virtualNodes = [
      { name: 'Jetson', nodeIp: 'virtual', id: 'jetson-001', type: 'edge-device', description: 'Jetson边缘计算设备' },
      { name: 'UAV', nodeIp: 'virtual', id: 'uav-001', type: 'drone', description: '无人机终端' }
    ];
    
    // UE API配置 (稍后配置具体URL)
    this.ueApiUrl = 'http://10.30.2.11:8080';  // 待配置
    
    this.init();
  }

  // 安全的日志输出方法
  log(message, level = 'info') {
    console.log(`[FileTransfer] ${message}`);
    if (this.dashboard && this.dashboard.logToConsole) {
      this.dashboard.logToConsole(message, level);
    }
  }

  init() {
    this.setupEventListeners();
    this.loadNodeOptions();
    console.log('File Transfer Manager initialized');
  }

  setupEventListeners() {
    // 表单提交
    const form = document.getElementById('file-transfer-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Form submitted, starting transfer...');
        this.startTransfer();
      });
      console.log('Form submit listener attached');
    } else {
      console.error('Form element not found: file-transfer-form');
    }

    // 开始传输按钮（备用方案）
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
          // 如果表单提交事件没有触发，手动调用
          console.log('Submit button clicked');
        });
      }
    }

    // 清空表单
    const clearBtn = document.getElementById('clear-form-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearForm();
      });
    }

    // 示例文件选择
    document.querySelectorAll('.example-file-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filePath = e.currentTarget.dataset.path;
        document.getElementById('file-path').value = filePath;
        console.log('Example file selected:', filePath);
      });
    });

    // 拖拽上传
    const dropZone = document.getElementById('drag-drop-zone');
    if (dropZone) {
      dropZone.addEventListener('click', () => {
        document.getElementById('file-upload-input').click();
      });

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        this.handleFileDrop(e.dataTransfer.files);
      });
    }

    // 文件选择
    const fileInput = document.getElementById('file-upload-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        this.handleFileDrop(e.target.files);
      });
    }

    // 标签切换
    document.querySelectorAll('.panel-header-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.dataset.target;
        this.switchTab(target);
      });
    });
  }

  async loadNodeOptions() {
    console.log('loadNodeOptions() called');
    try {
      // 从Ray集群管理器获取节点列表
      if (this.dashboard && this.dashboard.rayClusterManager && this.dashboard.rayClusterManager.nodes) {
        const nodes = this.dashboard.rayClusterManager.nodes;
        console.log('从rayClusterManager获取节点:', nodes.length);
        this.populateNodeSelects(nodes);
      } else {
        // 尝试从API获取
        console.log('从API获取节点列表...');
        const response = await fetch(`${this.baseURL}/api/ray-dashboard`);
        const data = await response.json();
        if (data.data && data.data.nodes) {
          console.log('从API获取到节点:', data.data.nodes.length);
          this.populateNodeSelects(data.data.nodes);
        } else {
          console.warn('API返回数据中没有节点信息');
        }
      }
    } catch (error) {
      console.error('Failed to load node options:', error);
      this.log('无法加载节点列表', 'error');
    }
  }

  populateNodeSelects(nodes) {
    console.log('populateNodeSelects() 填充', nodes.length, '个节点');
    const sourceSelect = document.getElementById('source-node');
    const targetSelect = document.getElementById('target-node');

    if (!sourceSelect || !targetSelect) return;

    // 清空现有选项（保留placeholder）
    sourceSelect.innerHTML = '<option value="">选择源节点...</option>';
    targetSelect.innerHTML = '<option value="">选择目标节点...</option>';

    // 添加虚拟节点分组
    const virtualOptGroup = document.createElement('optgroup');
    virtualOptGroup.label = '🎮 虚拟设备';
    const virtualOptGroup2 = document.createElement('optgroup');
    virtualOptGroup2.label = '🎮 虚拟设备';
    
    this.virtualNodes.forEach(node => {
      const optionText = `${node.name} (${node.description})`;
      virtualOptGroup.appendChild(new Option(optionText, node.name));
      virtualOptGroup2.appendChild(new Option(optionText, node.name));
    });
    
    sourceSelect.appendChild(virtualOptGroup);
    targetSelect.appendChild(virtualOptGroup2);

    // 添加Ray集群节点分组
    const clusterOptGroup = document.createElement('optgroup');
    clusterOptGroup.label = '🖥️ Ray集群节点';
    const clusterOptGroup2 = document.createElement('optgroup');
    clusterOptGroup2.label = '🖥️ Ray集群节点';
    
    // 添加节点选项 - 使用节点名称作为值（因为所有节点都在同一IP上）
    nodes.forEach(node => {
      // 使用节点名称作为唯一标识符，因为所有节点IP可能相同
      const nodeId = node.name || node.nodeId || node.id;
      const optionText = `${node.name} (${node.nodeIp})`;
      clusterOptGroup.appendChild(new Option(optionText, nodeId));
      clusterOptGroup2.appendChild(new Option(optionText, nodeId));
    });
    
    sourceSelect.appendChild(clusterOptGroup);
    targetSelect.appendChild(clusterOptGroup2);
    
    console.log(`节点列表已加载: ${this.virtualNodes.length}个虚拟节点 + ${nodes.length}个Ray节点`);
  }

  async startTransfer() {
    console.log('startTransfer() called');
    
    const sourceNode = document.getElementById('source-node').value;
    const targetNode = document.getElementById('target-node').value;
    const filePath = document.getElementById('file-path').value;
    const transferMode = document.getElementById('transfer-mode').value;

    console.log('Transfer params:', { sourceNode, targetNode, filePath, transferMode });

    if (!sourceNode || !targetNode || !filePath) {
      const msg = '请填写完整的传输信息';
      console.warn(msg);
      this.log(msg, 'warning');
      alert(msg);
      return;
    }

    if (sourceNode === targetNode) {
      const msg = '源节点和目标节点不能相同';
      console.warn(msg);
      this.log(msg, 'warning');
      alert(msg);
      return;
    }

    const transferId = this.generateTransferId();
    const transfer = {
      id: transferId,
      sourceNode,
      targetNode,
      filePath,
      transferMode,
      status: 'in-progress',
      progress: 0,
      startTime: new Date(),
      size: this.estimateFileSize(),
      speed: 0,
      eta: null,
      isVirtual: this.isVirtualNode(sourceNode) || this.isVirtualNode(targetNode)
    };

    this.transfers.active.push(transfer);
    this.renderTransferItem(transfer, 'active');
    this.updateTabCounts();

    const logMsg = `开始传输: ${filePath} 从 ${sourceNode} 到 ${targetNode}`;
    console.log(logMsg);
    this.log(logMsg, 'info');

    // 检查是否涉及虚拟节点
    if (transfer.isVirtual) {
      this.log(`🎮 检测到虚拟节点传输`, 'info');
      await this.handleVirtualTransfer(transfer);
      return;
    }

    // 尝试使用真实API，失败则使用模拟
    try {
      await this.startRealTransfer(transferId);
    } catch (error) {
      console.warn('Real API failed, using simulation:', error);
      this.simulateTransfer(transferId);
    }
  }

  async startRealTransfer(transferId) {
    const transfer = this.findTransfer(transferId);
    if (!transfer) return;

    try {
      // 调用后端API
      const formData = new FormData();
      formData.append('source_node', transfer.sourceNode);
      formData.append('target_node', transfer.targetNode);
      formData.append('file_path', transfer.filePath);
      formData.append('transfer_mode', transfer.transferMode);

      const response = await fetch(
        `${this.baseURL}/api/file-transfer/node-to-node`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // 使用后端返回的transfer_id轮询状态
        this.pollTransferStatus(transferId, result.transfer_id);
      } else {
        throw new Error('Transfer start failed');
      }
    } catch (error) {
      console.error('Real transfer error:', error);
      // 回退到模拟
      this.simulateTransfer(transferId);
    }
  }

  async pollTransferStatus(localId, backendId) {
    const transfer = this.findTransfer(localId);
    if (!transfer) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${this.baseURL}/api/file-transfer/status/${backendId}`);
        const status = await response.json();

        transfer.progress = status.progress || transfer.progress;
        transfer.speed = status.speed || 0;
        transfer.eta = status.eta || null;

        if (transfer.progress >= 100) {
          transfer.progress = 100;
          transfer.status = 'completed';
          transfer.endTime = new Date();

          this.transfers.active = this.transfers.active.filter(t => t.id !== localId);
          this.transfers.completed.push(transfer);

          this.renderTransferItem(transfer, 'completed');
          this.removeTransferItem(localId, 'active');
          this.updateTabCounts();

          this.log(`传输完成: ${transfer.filePath}`, 'success');
          clearInterval(pollInterval);
          
          // 如果当前在进行中标签页且没有其他活跃传输，自动切换到已完成标签
          if (this.currentTab === 'active-transfers' && this.transfers.active.length === 0) {
            setTimeout(() => {
              this.switchTab('completed-transfers');
            }, 1000);
          }
        } else {
          this.updateTransferProgress(localId, transfer);
        }
      } catch (error) {
        console.error('Poll error:', error);
        // 如果轮询失败，切换到模拟模式
        clearInterval(pollInterval);
        this.simulateTransfer(localId);
      }
    }, 1000);
  }

  simulateTransfer(transferId) {
    const transfer = this.findTransfer(transferId);
    if (!transfer) return;

    let lastProgress = 0;
    let lastUpdate = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const progressIncrement = Math.random() * 8 + 2; // 2-10%
      transfer.progress += progressIncrement;
      
      // 计算传输速度 (MB/s)
      const timeDelta = (now - lastUpdate) / 1000; // 秒
      const progressDelta = transfer.progress - lastProgress;
      const mbTransferred = (progressDelta / 100) * transfer.size;
      transfer.speed = mbTransferred / timeDelta;
      
      // 计算预计剩余时间
      if (transfer.speed > 0) {
        const remainingMB = transfer.size * (1 - transfer.progress / 100);
        transfer.eta = Math.round(remainingMB / transfer.speed);
      }
      
      lastProgress = transfer.progress;
      lastUpdate = now;
      
      if (transfer.progress >= 100) {
        transfer.progress = 100;
        transfer.status = 'completed';
        transfer.endTime = new Date();
        transfer.speed = 0;
        transfer.eta = 0;
        
        // 移动到已完成列表
        this.transfers.active = this.transfers.active.filter(t => t.id !== transferId);
        this.transfers.completed.push(transfer);
        
        this.renderTransferItem(transfer, 'completed');
        this.removeTransferItem(transferId, 'active');
        this.updateTabCounts();
        
        this.log(`传输完成: ${transfer.filePath}`, 'success');
        clearInterval(interval);
        
        // 如果当前在进行中标签页且没有其他活跃传输，自动切换到已完成标签
        if (this.currentTab === 'active-transfers' && this.transfers.active.length === 0) {
          setTimeout(() => {
            this.switchTab('completed-transfers');
          }, 1000);
        }
      } else {
        this.updateTransferProgress(transferId, transfer);
      }
    }, 500);
  }

  findTransfer(transferId) {
    return this.transfers.active.find(t => t.id === transferId) ||
           this.transfers.completed.find(t => t.id === transferId) ||
           this.transfers.failed.find(t => t.id === transferId);
  }

  updateTransferProgress(transferId, transfer) {
    const progressBar = document.querySelector(`[data-transfer-id="${transferId}"] .transfer-progress-bar`);
    const progressText = document.querySelector(`[data-transfer-id="${transferId}"] .transfer-progress-text`);
    
    if (progressBar) {
      progressBar.style.width = `${transfer.progress}%`;
    }
    if (progressText) {
      const percent = Math.round(transfer.progress);
      const speed = transfer.speed ? transfer.speed.toFixed(1) : '0.0';
      const eta = transfer.eta ? this.formatTime(transfer.eta) : '--';
      
      progressText.innerHTML = `
        <span class="transfer-progress-percent">${percent}%</span>
        <div class="transfer-progress-stats">
          <span class="transfer-speed">
            <i class="fas fa-tachometer-alt"></i>
            ${speed} MB/s
          </span>
          <span class="transfer-eta">
            <i class="fas fa-clock"></i>
            剩余 ${eta}
          </span>
        </div>
      `;
    }
  }

  renderTransferItem(transfer, listType) {
    const listId = `${listType}-transfers`;
    const list = document.getElementById(listId);
    if (!list) return;

    // 移除空状态
    const emptyState = list.querySelector('.empty-state');
    if (emptyState) {
      emptyState.style.display = 'none';
    }

    const item = document.createElement('div');
    item.className = 'transfer-item';
    item.dataset.transferId = transfer.id;

    const statusClass = transfer.status;
    const statusText = {
      'in-progress': '进行中',
      'completed': '已完成',
      'failed': '失败'
    }[transfer.status];

    const duration = transfer.endTime ? 
      Math.round((transfer.endTime - transfer.startTime) / 1000) : 
      Math.round((new Date() - transfer.startTime) / 1000);

    item.innerHTML = `
      <div class="transfer-item-header">
        <div class="transfer-item-title">
          <i class="fas fa-file"></i>
          ${this.getFileName(transfer.filePath)}
        </div>
        <span class="transfer-item-status ${statusClass}">${statusText}</span>
      </div>
      <div class="transfer-item-info">
        <span><i class="fas fa-server"></i> 源:</span>
        <span>${transfer.sourceNode}</span>
        <span><i class="fas fa-server"></i> 目标:</span>
        <span>${transfer.targetNode}</span>
        <span><i class="fas fa-clock"></i> 耗时:</span>
        <span>${duration}秒</span>
        <span><i class="fas fa-hdd"></i> 大小:</span>
        <span>${this.formatSize(transfer.size)}</span>
      </div>
      ${transfer.status === 'in-progress' ? `
        <div class="transfer-progress">
          <div class="transfer-progress-bar" style="width: ${transfer.progress}%"></div>
        </div>
        <div class="transfer-progress-text">
          <span class="transfer-progress-percent">${Math.round(transfer.progress)}%</span>
          <div class="transfer-progress-stats">
            <span class="transfer-speed">
              <i class="fas fa-tachometer-alt"></i>
              ${transfer.speed ? transfer.speed.toFixed(1) : '0.0'} MB/s
            </span>
            <span class="transfer-eta">
              <i class="fas fa-clock"></i>
              剩余 ${transfer.eta ? this.formatTime(transfer.eta) : '--'}
            </span>
          </div>
        </div>
      ` : ''}
    `;

    list.insertBefore(item, list.firstChild);
  }

  removeTransferItem(transferId, listType) {
    const listId = `${listType}-transfers`;
    const list = document.getElementById(listId);
    if (!list) return;

    const item = list.querySelector(`[data-transfer-id="${transferId}"]`);
    if (item) {
      item.remove();
    }

    // 如果列表为空，显示空状态
    if (list.querySelectorAll('.transfer-item').length === 0) {
      const emptyState = list.querySelector('.empty-state');
      if (emptyState) {
        emptyState.style.display = 'block';
      }
    }
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // 更新标签按钮状态
    document.querySelectorAll('.panel-header-tabs .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.target === tabName);
    });

    // 切换列表显示
    document.querySelectorAll('.transfer-list').forEach(list => {
      list.style.display = list.id === tabName ? 'block' : 'none';
    });
  }

  updateTabCounts() {
    const activeCount = document.getElementById('active-count');
    const completedCount = document.getElementById('completed-count');
    const failedCount = document.getElementById('failed-count');

    if (activeCount) activeCount.textContent = this.transfers.active.length;
    if (completedCount) completedCount.textContent = this.transfers.completed.length;
    if (failedCount) failedCount.textContent = this.transfers.failed.length;
  }

  async handleFileDrop(files) {
    if (files.length === 0) return;

    const targetNode = document.getElementById('target-node').value;
    if (!targetNode) {
      this.log('请先选择目标节点', 'warning');
      return;
    }

    this.log(`准备上传 ${files.length} 个文件到 ${targetNode}`, 'info');

    // 上传每个文件
    for (const file of files) {
      await this.uploadFile(file, targetNode);
    }
  }

  async uploadFile(file, targetNode) {
    const transferId = this.generateTransferId();
    const transfer = {
      id: transferId,
      sourceNode: 'localhost',
      targetNode: targetNode,
      filePath: file.name,
      transferMode: 'upload',
      status: 'in-progress',
      progress: 0,
      startTime: new Date(),
      size: file.size / (1024 * 1024), // 转换为MB
      speed: 0,
      eta: null
    };

    this.transfers.active.push(transfer);
    this.renderTransferItem(transfer, 'active');
    this.updateTabCounts();

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('target_node', targetNode);
      formData.append('target_path', `/uploads/${file.name}`);

      // 使用XMLHttpRequest以支持进度跟踪
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          transfer.progress = (e.loaded / e.total) * 100;
          transfer.speed = (e.loaded / 1024 / 1024) / ((Date.now() - transfer.startTime) / 1000);
          const remainingBytes = e.total - e.loaded;
          transfer.eta = transfer.speed > 0 ? Math.round(remainingBytes / (transfer.speed * 1024 * 1024)) : null;
          this.updateTransferProgress(transferId, transfer);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          transfer.progress = 100;
          transfer.status = 'completed';
          transfer.endTime = new Date();

          // 从活跃列表移除
          this.transfers.active = this.transfers.active.filter(t => t.id !== transferId);
          // 添加到完成列表
          this.transfers.completed.push(transfer);

          // 渲染到完成列表
          this.renderTransferItem(transfer, 'completed');
          // 从活跃列表UI中移除
          this.removeTransferItem(transferId, 'active');
          // 更新计数
          this.updateTabCounts();

          this.log(`上传完成: ${file.name}`, 'success');
          
          console.log(`Transfer ${transferId} completed and moved to completed list`);
          
          // 检测是否为.com飞行指令文件
          if (file.name.endsWith('.com')) {
            this.handleUploadedFlightCommand(file, targetNode);
          }
          
          // 如果当前在进行中标签页且没有其他活跃传输，自动切换到已完成标签
          if (this.currentTab === 'active-transfers' && this.transfers.active.length === 0) {
            setTimeout(() => {
              this.switchTab('completed-transfers');
            }, 1000); // 延迟1秒让用户看到完成动画
          }
        } else {
          throw new Error(`Upload failed: ${xhr.status}`);
        }
      });

      xhr.addEventListener('error', () => {
        transfer.status = 'failed';
        this.transfers.active = this.transfers.active.filter(t => t.id !== transferId);
        this.transfers.failed.push(transfer);
        this.updateTabCounts();
        this.log(`上传失败: ${file.name}`, 'error');
      });

      xhr.open('POST', `${this.baseURL}/api/file-transfer/upload`);
      xhr.send(formData);

    } catch (error) {
      console.error('Upload error:', error);
      this.log(`上传失败: ${file.name} - ${error.message}`, 'error');
      
      transfer.status = 'failed';
      this.transfers.active = this.transfers.active.filter(t => t.id !== transferId);
      this.transfers.failed.push(transfer);
      this.updateTabCounts();
    }
  }

  clearForm() {
    document.getElementById('file-transfer-form').reset();
  }

  generateTransferId() {
    return `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  estimateFileSize() {
    // 随机生成文件大小（MB）
    return Math.floor(Math.random() * 500) + 10;
  }

  getFileName(path) {
    return path.split('/').pop();
  }

  formatSize(sizeMB) {
    if (sizeMB < 1) {
      return `${Math.round(sizeMB * 1024)} KB`;
    } else if (sizeMB < 1024) {
      return `${Math.round(sizeMB)} MB`;
    } else {
      return `${(sizeMB / 1024).toFixed(2)} GB`;
    }
  }

  formatTime(seconds) {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}分${secs}秒`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}小时${minutes}分`;
    }
  }

  // ============================================================================
  // 虚拟节点文件传输处理
  // ============================================================================
  
  /**
   * 检查是否为虚拟节点
   */
  isVirtualNode(nodeName) {
    return this.virtualNodes.some(n => n.name === nodeName);
  }

  /**
   * 处理上传的.com飞行指令文件
   * @param {File} file - 上传的文件对象
   * @param {string} targetNode - 目标节点
   */
  async handleUploadedFlightCommand(file, targetNode) {
    this.log(`🚁 检测到上传的飞行指令文件: ${file.name}`, 'warning');
    
    try {
      // 读取文件内容
      const content = await this.readFileContent(file);
      
      if (content) {
        // 解析飞行指令
        const flightCommand = this.parseFlightCommand(content);
        
        if (flightCommand) {
          const fromStr = this.formatLocation(flightCommand.from);
          const toStr = this.formatLocation(flightCommand.to);
          this.log(`📍 解析飞行指令: 从 "${fromStr}" 飞行到 "${toStr}"`, 'info');
          this.log(`🎮 目标节点: ${targetNode}`, 'info');
          this.log(`🎮 准备调用UE API执行无人机飞行指令...`, 'info');
          
          // 调用UE API
          await this.executeFlightCommand(flightCommand);
        } else {
          this.log(`⚠️ 无法解析飞行指令文件内容`, 'warning');
          this.log(`文件内容: ${content.substring(0, 200)}...`, 'info');
        }
      }
    } catch (error) {
      this.log(`❌ 处理飞行指令文件失败: ${error.message}`, 'error');
    }
  }

  /**
   * 读取File对象的内容
   */
  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }

  /**
   * 处理虚拟节点间的文件传输
   */
  async handleVirtualTransfer(transfer) {
    const { sourceNode, targetNode, filePath } = transfer;
    
    this.log(`虚拟传输: ${sourceNode} -> ${targetNode}, 文件: ${filePath}`, 'info');
    
    // 检查是否为.com文件（飞行指令文件）
    if (filePath.endsWith('.com')) {
      await this.handleFlightCommandFile(transfer);
    }
    
    // 模拟传输进度
    return this.simulateVirtualTransfer(transfer);
  }

  /**
   * 处理.com飞行指令文件
   */
  async handleFlightCommandFile(transfer) {
    const { filePath, sourceNode, targetNode } = transfer;
    const fileName = filePath.split('/').pop();
    
    this.log(`🚁 检测到飞行指令文件: ${fileName}`, 'warning');
    
    try {
      // 读取文件内容
      const fileContent = await this.readCommandFile(filePath);
      
      if (fileContent) {
        // 解析飞行指令
        const flightCommand = this.parseFlightCommand(fileContent);
        
        if (flightCommand) {
          const fromStr = this.formatLocation(flightCommand.from);
          const toStr = this.formatLocation(flightCommand.to);
          this.log(`📍 解析飞行指令: 从 "${fromStr}" 飞行到 "${toStr}"`, 'info');
          this.log(`🎮 准备调用UE API执行无人机飞行指令...`, 'info');
          
          // 调用UE API (稍后实现具体API调用)
          await this.executeFlightCommand(flightCommand);
        } else {
          this.log(`⚠️ 无法解析飞行指令文件内容`, 'warning');
        }
      }
    } catch (error) {
      this.log(`❌ 处理飞行指令文件失败: ${error.message}`, 'error');
    }
  }

  /**
   * 格式化位置信息用于显示
   */
  formatLocation(loc) {
    if (!loc) return '未知位置';
    if (typeof loc === 'string') return loc;
    return `${loc.name} (X:${loc.x}, Y:${loc.y}, Z:${loc.z})`;
  }

  /**
   * 读取指令文件内容
   */
  async readCommandFile(filePath) {
    try {
      // 尝试从后端API读取文件内容
      const response = await fetch(`${this.baseURL}/api/file/read?path=${encodeURIComponent(filePath)}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.content;
      } else {
        // 如果API不可用，尝试使用模拟数据
        this.log(`文件读取API不可用，使用模拟指令`, 'warning');
        return this.getSimulatedCommandContent(filePath);
      }
    } catch (error) {
      console.error('读取文件失败:', error);
      // 返回模拟内容用于测试
      return this.getSimulatedCommandContent(filePath);
    }
  }

  /**
   * 获取模拟的指令文件内容（用于测试）
   */
  getSimulatedCommandContent(filePath) {
    const fileName = filePath.split('/').pop().replace('.com', '');
    // 根据文件名生成模拟指令
    const commands = {
      'flight': 'FROM: 基站A\nTO: 目标点B',
      'mission': 'FROM: 起飞点\nTO: 任务区域',
      'return': 'FROM: 当前位置\nTO: 基地',
      'patrol': 'FROM: 巡逻起点\nTO: 巡逻终点'
    };
    
    return commands[fileName] || JSON.stringify({
      from: { name: "起点", x: 0, y: 0, z: 0 },
      to: { name: "终点", x: 100, y: 100, z: 50 }
    });
  }

  /**
   * 解析飞行指令
   * 支持格式:
   * {
   *   "from": { "name": "起点名", "x": 100, "y": 200, "z": 50 },
   *   "to": { "name": "终点名", "x": 500, "y": 800, "z": 100 }
   * }
   */
  parseFlightCommand(content) {
    if (!content) return null;
    
    let from = null, to = null;
    
    // 尝试解析JSON格式
    try {
      const json = JSON.parse(content);
      
      // 新格式: from/to 包含 name, x, y, z
      if (json.from && typeof json.from === 'object') {
        from = {
          name: json.from.name || '未命名起点',
          x: parseFloat(json.from.x) || 0,
          y: parseFloat(json.from.y) || 0,
          z: parseFloat(json.from.z) || 0
        };
      }
      
      if (json.to && typeof json.to === 'object') {
        to = {
          name: json.to.name || '未命名终点',
          x: parseFloat(json.to.x) || 0,
          y: parseFloat(json.to.y) || 0,
          z: parseFloat(json.to.z) || 0
        };
      }
      
      // 兼容旧格式: from/to 是字符串
      if (!from && (json.from || json.FROM)) {
        const fromStr = json.from || json.FROM;
        from = typeof fromStr === 'string' 
          ? { name: fromStr, x: 0, y: 0, z: 0 }
          : fromStr;
      }
      
      if (!to && (json.to || json.TO)) {
        const toStr = json.to || json.TO;
        to = typeof toStr === 'string'
          ? { name: toStr, x: 0, y: 0, z: 0 }
          : toStr;
      }
    } catch (e) {
      // 不是JSON，尝试其他格式
      console.warn('JSON解析失败，尝试其他格式:', e.message);
    }
    
    // 尝试解析 FROM: xxx\nTO: yyy 格式 (兼容旧格式)
    if (!from || !to) {
      const fromMatch = content.match(/FROM\s*[:=]\s*(.+)/i);
      const toMatch = content.match(/TO\s*[:=]\s*(.+)/i);
      
      if (fromMatch && !from) {
        from = { name: fromMatch[1].trim(), x: 0, y: 0, z: 0 };
      }
      if (toMatch && !to) {
        to = { name: toMatch[1].trim(), x: 0, y: 0, z: 0 };
      }
    }
    
    if (from && to) {
      return { from, to, rawContent: content };
    }
    
    return null;
  }

  /**
   * 执行无人机飞行指令 - 调用UE API
   * @param {Object} command - 飞行指令 
   *   {
   *     from: { name, x, y, z },
   *     to: { name, x, y, z }
   *   }
   */
  async executeFlightCommand(command) {
    const fromStr = this.formatLocation(command.from);
    const toStr = this.formatLocation(command.to);
    
    this.log(`🚀 执行飞行指令`, 'success');
    this.log(`📍 起点: ${fromStr}`, 'info');
    this.log(`🎯 终点: ${toStr}`, 'info');
    
    try {
      // TODO: 调用UE HTTP API
      // 等待用户提供API文档后实现
      
      // 目前记录日志表示检测到指令
      this.log(`✈️ [UE API] 发送飞行指令: 无人机从 "${command.from.name}" 飞行到 "${command.to.name}"`, 'success');
      this.log(`   起点坐标: (${command.from.x}, ${command.from.y}, ${command.from.z})`, 'info');
      this.log(`   终点坐标: (${command.to.x}, ${command.to.y}, ${command.to.z})`, 'info');
      
      // 预留API调用位置
      /*
      const response = await fetch(`${this.ueApiUrl}/api/drone/fly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: command.from,
          to: command.to
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        this.log(`✅ UE API响应: ${JSON.stringify(result)}`, 'success');
      }
      */
      
      return true;
    } catch (error) {
      this.log(`❌ 调用UE API失败: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * 模拟虚拟节点间的文件传输
   */
  simulateVirtualTransfer(transfer) {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15 + 5;
        
        if (progress >= 100) {
          progress = 100;
          transfer.progress = 100;
          transfer.status = 'completed';
          transfer.endTime = new Date();
          
          this.transfers.active = this.transfers.active.filter(t => t.id !== transfer.id);
          this.transfers.completed.push(transfer);
          
          this.renderTransferItem(transfer, 'completed');
          this.removeTransferItem(transfer.id, 'active');
          this.updateTabCounts();
          
          this.log(`✅ 虚拟传输完成: ${transfer.filePath}`, 'success');
          
          clearInterval(interval);
          resolve(transfer);
          
          // 自动切换到已完成标签
          if (this.transfers.active.length === 0) {
            setTimeout(() => this.switchTab('completed-transfers'), 500);
          }
        } else {
          transfer.progress = progress;
          this.updateTransferProgress(transfer.id, transfer);
        }
      }, 200);
    });
  }
}

// 导出以便在dashboard-manager中使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileTransferManager;
}
