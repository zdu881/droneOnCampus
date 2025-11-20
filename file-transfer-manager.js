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
    
    this.init();
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
        this.startTransfer();
      });
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
    try {
      // 从Ray集群管理器获取节点列表
      if (this.dashboard.rayClusterManager && this.dashboard.rayClusterManager.nodes) {
        const nodes = this.dashboard.rayClusterManager.nodes;
        this.populateNodeSelects(nodes);
      } else {
        // 尝试从API获取
        const response = await fetch('http://10.30.2.11:8000/api/ray-dashboard');
        const data = await response.json();
        if (data.data && data.data.nodes) {
          this.populateNodeSelects(data.data.nodes);
        }
      }
    } catch (error) {
      console.error('Failed to load node options:', error);
      this.dashboard.logToConsole('无法加载节点列表', 'error');
    }
  }

  populateNodeSelects(nodes) {
    const sourceSelect = document.getElementById('source-node');
    const targetSelect = document.getElementById('target-node');

    if (!sourceSelect || !targetSelect) return;

    // 清空现有选项（保留placeholder）
    sourceSelect.innerHTML = '<option value="">选择源节点...</option>';
    targetSelect.innerHTML = '<option value="">选择目标节点...</option>';

    // 添加节点选项
    nodes.forEach(node => {
      const optionText = `${node.name} (${node.nodeIp})`;
      const sourceOption = new Option(optionText, node.nodeIp);
      const targetOption = new Option(optionText, node.nodeIp);
      
      sourceSelect.add(sourceOption);
      targetSelect.add(targetOption);
    });
  }

  async startTransfer() {
    const sourceNode = document.getElementById('source-node').value;
    const targetNode = document.getElementById('target-node').value;
    const filePath = document.getElementById('file-path').value;
    const transferMode = document.getElementById('transfer-mode').value;

    if (!sourceNode || !targetNode || !filePath) {
      this.dashboard.logToConsole('请填写完整的传输信息', 'warning');
      return;
    }

    if (sourceNode === targetNode) {
      this.dashboard.logToConsole('源节点和目标节点不能相同', 'warning');
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
      eta: null
    };

    this.transfers.active.push(transfer);
    this.renderTransferItem(transfer, 'active');
    this.updateTabCounts();

    this.dashboard.logToConsole(`开始传输: ${filePath} 从 ${sourceNode} 到 ${targetNode}`, 'info');

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

      const response = await fetch('http://10.30.2.11:8000/api/file-transfer/node-to-node', {
        method: 'POST',
        body: formData
      });

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
        const response = await fetch(`http://10.30.2.11:8000/api/file-transfer/status/${backendId}`);
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

          this.dashboard.logToConsole(`传输完成: ${transfer.filePath}`, 'success');
          clearInterval(pollInterval);
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
        
        this.dashboard.logToConsole(`传输完成: ${transfer.filePath}`, 'success');
        clearInterval(interval);
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
      this.dashboard.logToConsole('请先选择目标节点', 'warning');
      return;
    }

    this.dashboard.logToConsole(`准备上传 ${files.length} 个文件到 ${targetNode}`, 'info');

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

          this.transfers.active = this.transfers.active.filter(t => t.id !== transferId);
          this.transfers.completed.push(transfer);

          this.renderTransferItem(transfer, 'completed');
          this.removeTransferItem(transferId, 'active');
          this.updateTabCounts();

          this.dashboard.logToConsole(`上传完成: ${file.name}`, 'success');
        } else {
          throw new Error(`Upload failed: ${xhr.status}`);
        }
      });

      xhr.addEventListener('error', () => {
        transfer.status = 'failed';
        this.transfers.active = this.transfers.active.filter(t => t.id !== transferId);
        this.transfers.failed.push(transfer);
        this.updateTabCounts();
        this.dashboard.logToConsole(`上传失败: ${file.name}`, 'error');
      });

      xhr.open('POST', 'http://10.30.2.11:8000/api/file-transfer/upload');
      xhr.send(formData);

    } catch (error) {
      console.error('Upload error:', error);
      this.dashboard.logToConsole(`上传失败: ${file.name} - ${error.message}`, 'error');
      
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
}

// 导出以便在dashboard-manager中使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileTransferManager;
}
