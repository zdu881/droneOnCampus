// 任务管理器 - 负责任务选择、创建、执行和结果展示
class TaskManager {
  constructor() {
    this.tasks = [];
    this.taskTypes = {
      delivery: {
        name: '配送任务',
        icon: '📦',
        color: '#00ff41',
        description: '物品配送和运输',
        templates: [
          { name: '普通配送', priority: 'normal', estimatedTime: '10-15分钟' },
          { name: '紧急配送', priority: 'high', estimatedTime: '5-8分钟' },
          { name: '批量配送', priority: 'normal', estimatedTime: '20-30分钟' }
        ]
      },
      patrol: {
        name: '巡检任务',
        icon: '🔍',
        color: '#0099ff',
        description: '设施巡检和监控',
        templates: [
          { name: '设施巡检', priority: 'normal', estimatedTime: '15-20分钟' },
          { name: '安全巡逻', priority: 'high', estimatedTime: '25-35分钟' },
          { name: '夜间巡检', priority: 'normal', estimatedTime: '30-40分钟' }
        ]
      },
      monitoring: {
        name: '数据收集',
        icon: '📊',
        color: '#ffaa00',
        description: '环境监测和数据采集',
        templates: [
          { name: '人流统计', priority: 'low', estimatedTime: '20-25分钟' },
          { name: '设备检查', priority: 'normal', estimatedTime: '15-20分钟' },
          { name: '环境监测', priority: 'normal', estimatedTime: '10-15分钟' }
        ]
      }
    };
    
    this.nextTaskId = 1;
    this.currentTask = null;
    this.taskPanel = null;
    this.createTaskModal = null;
    this.taskHistoryPanel = null;
  }

  initialize() {
    console.log('初始化任务管理器...');
    this.createTaskPanel();
    this.createTaskModal();
    this.setupTaskEventListeners();
    console.log('任务管理器初始化完成');
  }

  createTaskPanel() {
    const videoContainer = document.querySelector('.video-container');
    
    // 创建任务控制面板
    this.taskPanel = document.createElement('div');
    this.taskPanel.className = 'task-control-panel';
    this.taskPanel.style.cssText = `
      position: absolute;
      bottom: 15px;
      right: 15px;
      z-index: 15;
      background: rgba(26, 26, 46, 0.2);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 153, 255, 0.4);
      border-radius: 8px;
      padding: 15px;
      min-width: 300px;
      max-height: 350px;
      overflow-y: auto;
    `;

    // 添加标题和控制按钮
    const header = document.createElement('div');
    header.className = 'task-header';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    `;

    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = '📋 任务控制';
    title.style.cssText = `
      font-family: 'Orbitron', monospace;
      font-weight: 700;
      color: #0099ff;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-size: 12px;
      text-shadow: 0 0 5px #0099ff;
    `;

    const headerButtons = document.createElement('div');
    headerButtons.style.cssText = 'display: flex; gap: 8px;';

    const createBtn = document.createElement('button');
    createBtn.className = 'create-task-btn';
    createBtn.innerHTML = '➕ 创建';
    createBtn.style.cssText = `
      padding: 4px 8px;
      background: rgba(0, 153, 255, 0.1);
      border: 1px solid #0099ff;
      color: #0099ff;
      border-radius: 4px;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    createBtn.addEventListener('click', () => this.showCreateTaskModal());

    const historyBtn = document.createElement('button');
    historyBtn.className = 'task-history-btn';
    historyBtn.innerHTML = '📈 历史';
    historyBtn.style.cssText = createBtn.style.cssText;
    historyBtn.addEventListener('click', () => this.showTaskHistory());

    headerButtons.appendChild(createBtn);
    headerButtons.appendChild(historyBtn);
    header.appendChild(title);
    header.appendChild(headerButtons);
    this.taskPanel.appendChild(header);

    // 添加当前任务显示
    const currentTaskSection = document.createElement('div');
    currentTaskSection.className = 'current-task-section';
    currentTaskSection.id = 'current-task-section';
    currentTaskSection.style.cssText = `
      margin-bottom: 15px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      border: 1px solid rgba(0, 153, 255, 0.3);
    `;

    this.taskPanel.appendChild(currentTaskSection);

    // 添加快速任务按钮
    const quickTasksSection = document.createElement('div');
    quickTasksSection.className = 'quick-tasks-section';
    quickTasksSection.innerHTML = `
      <div class="section-title" style="
        font-size: 11px;
        font-weight: 600;
        color: #a0a9c0;
        margin-bottom: 8px;
        text-transform: uppercase;
      ">快速任务</div>
    `;

    const quickTasksGrid = document.createElement('div');
    quickTasksGrid.className = 'quick-tasks-grid';
    quickTasksGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    `;

    // 添加快速任务按钮
    this.createQuickTaskButtons(quickTasksGrid);
    
    quickTasksSection.appendChild(quickTasksGrid);
    this.taskPanel.appendChild(quickTasksSection);

    videoContainer.appendChild(this.taskPanel);

    // 更新当前任务显示
    this.updateCurrentTaskDisplay();

    // 添加样式
    this.addTaskPanelStyles();
  }

  createQuickTaskButtons(container) {
    const quickTasks = [
      { type: 'delivery', from: 'Warehouse', to: 'Library', name: '仓库→图书馆' },
      { type: 'delivery', from: 'Library', to: 'Dormitory', name: '图书馆→宿舍' },
      { type: 'patrol', area: 'Campus', name: '校园巡检' },
      { type: 'monitoring', area: 'MainGate', name: '入口监控' }
    ];

    quickTasks.forEach(task => {
      const btn = document.createElement('button');
      btn.className = 'quick-task-btn';
      btn.innerHTML = `
        <div class="quick-task-icon">${this.taskTypes[task.type].icon}</div>
        <div class="quick-task-name">${task.name}</div>
      `;
      btn.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 8px 6px;
        background: rgba(0, 153, 255, 0.05);
        border: 1px solid rgba(0, 153, 255, 0.3);
        border-radius: 6px;
        color: #ffffff;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 10px;
      `;

      btn.addEventListener('click', () => this.executeQuickTask(task));
      container.appendChild(btn);
    });
  }

  addTaskPanelStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .create-task-btn:hover, .task-history-btn:hover {
        background: rgba(0, 153, 255, 0.2) !important;
        box-shadow: 0 0 8px rgba(0, 153, 255, 0.3) !important;
      }
      
      .quick-task-btn:hover {
        background: rgba(0, 153, 255, 0.15) !important;
        border-color: rgba(0, 153, 255, 0.6) !important;
        transform: translateY(-1px);
      }
      
      .quick-task-icon {
        font-size: 16px;
      }
      
      .quick-task-name {
        font-size: 9px;
        text-align: center;
        line-height: 1.2;
      }
      
      .task-progress-bar {
        width: 100%;
        height: 6px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 3px;
        overflow: hidden;
        margin-top: 8px;
      }
      
      .task-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #0099ff, #00ff41);
        transition: width 0.3s ease;
      }
      
      .task-control-buttons {
        display: flex;
        gap: 6px;
        margin-top: 8px;
      }
      
      .task-control-btn {
        flex: 1;
        padding: 4px 8px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: #ffffff;
        font-size: 9px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      
      .task-control-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .task-control-btn.pause {
        border-color: #ffaa00;
        color: #ffaa00;
      }
      
      .task-control-btn.stop {
        border-color: #ff3030;
        color: #ff3030;
      }
      
      /* 自定义滚动条 */
      .task-control-panel::-webkit-scrollbar {
        width: 4px;
      }
      
      .task-control-panel::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 2px;
      }
      
      .task-control-panel::-webkit-scrollbar-thumb {
        background: rgba(0, 153, 255, 0.4);
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  createTaskModal() {
    // 创建任务创建模态框
    this.createTaskModal = document.createElement('div');
    this.createTaskModal.className = 'create-task-modal';
    this.createTaskModal.style.cssText = `
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
      border: 1px solid rgba(0, 153, 255, 0.6);
      border-radius: 12px;
      padding: 25px;
      width: 450px;
      max-width: 90vw;
      color: #ffffff;
      font-family: 'Rajdhani', monospace;
      max-height: 80vh;
      overflow-y: auto;
    `;

    modalContent.innerHTML = `
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="margin: 0; color: #0099ff; font-family: 'Orbitron', monospace;">📋 创建新任务</h3>
        <button class="close-modal-btn" style="background: none; border: none; color: #ffffff; font-size: 24px; cursor: pointer;">×</button>
      </div>
      
      <form class="create-task-form">
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #a0a9c0;">任务名称:</label>
          <input type="text" name="taskName" placeholder="输入任务名称" required style="width: 100%; padding: 8px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(0, 153, 255, 0.5); border-radius: 4px; color: #ffffff; font-size: 14px;">
        </div>
        
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #a0a9c0;">任务类型:</label>
          <select name="taskType" required style="width: 100%; padding: 8px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(0, 153, 255, 0.5); border-radius: 4px; color: #ffffff; font-size: 14px;">
            <option value="">选择任务类型</option>
            <option value="delivery">📦 配送任务</option>
            <option value="patrol">🔍 巡检任务</option>
            <option value="monitoring">📊 数据收集</option>
          </select>
        </div>
        
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #a0a9c0;">优先级:</label>
          <select name="priority" required style="width: 100%; padding: 8px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(0, 153, 255, 0.5); border-radius: 4px; color: #ffffff; font-size: 14px;">
            <option value="">选择优先级</option>
            <option value="low">🟢 低优先级</option>
            <option value="normal">🟡 普通优先级</option>
            <option value="high">🔴 高优先级</option>
          </select>
        </div>
        
        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
          <div class="form-group">
            <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #a0a9c0;">起始位置:</label>
            <select name="startLocation" style="width: 100%; padding: 6px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(0, 153, 255, 0.5); border-radius: 4px; color: #ffffff; font-size: 12px;">
              <option value="">选择起始位置</option>
              <option value="Warehouse">📦 仓库</option>
              <option value="Library">📚 图书馆</option>
              <option value="Dormitory">🏠 宿舍区</option>
              <option value="Cafeteria">🍽️ 食堂</option>
            </select>
          </div>
          <div class="form-group">
            <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #a0a9c0;">目标位置:</label>
            <select name="targetLocation" style="width: 100%; padding: 6px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(0, 153, 255, 0.5); border-radius: 4px; color: #ffffff; font-size: 12px;">
              <option value="">选择目标位置</option>
              <option value="Warehouse">📦 仓库</option>
              <option value="Library">📚 图书馆</option>
              <option value="Dormitory">🏠 宿舍区</option>
              <option value="Cafeteria">🍽️ 食堂</option>
            </select>
          </div>
        </div>
        
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #a0a9c0;">任务描述:</label>
          <textarea name="description" placeholder="输入任务详细描述..." rows="3" style="width: 100%; padding: 8px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(0, 153, 255, 0.5); border-radius: 4px; color: #ffffff; font-size: 12px; resize: vertical;"></textarea>
        </div>
        
        <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
          <button type="button" class="cancel-btn" style="padding: 10px 20px; background: rgba(255, 48, 48, 0.2); border: 1px solid #ff3030; color: #ff3030; border-radius: 6px; cursor: pointer;">取消</button>
          <button type="submit" class="submit-btn" style="padding: 10px 20px; background: rgba(0, 153, 255, 0.2); border: 1px solid #0099ff; color: #0099ff; border-radius: 6px; cursor: pointer;">创建任务</button>
        </div>
      </form>
    `;

    this.createTaskModal.appendChild(modalContent);
    document.body.appendChild(this.createTaskModal);

    // 绑定事件
    this.setupTaskModalEvents();
  }

  setupTaskModalEvents() {
    const closeBtn = this.createTaskModal.querySelector('.close-modal-btn');
    const cancelBtn = this.createTaskModal.querySelector('.cancel-btn');
    const form = this.createTaskModal.querySelector('.create-task-form');

    closeBtn.addEventListener('click', () => this.hideCreateTaskModal());
    cancelBtn.addEventListener('click', () => this.hideCreateTaskModal());
    
    // 点击模态框外部关闭
    this.createTaskModal.addEventListener('click', (e) => {
      if (e.target === this.createTaskModal) {
        this.hideCreateTaskModal();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateTask(new FormData(form));
    });
  }

  setupTaskEventListeners() {
    // 监听摄像头预设变化事件
    window.addEventListener('cameraPresetChange', (event) => {
      if (this.currentTask && this.currentTask.type === 'monitoring') {
        console.log('摄像头预设变化，更新监控任务数据');
        this.updateTaskProgress();
      }
    });
  }

  showCreateTaskModal() {
    this.createTaskModal.style.display = 'flex';
  }

  hideCreateTaskModal() {
    this.createTaskModal.style.display = 'none';
    // 重置表单
    const form = this.createTaskModal.querySelector('.create-task-form');
    form.reset();
  }

  async handleCreateTask(formData) {
    const taskData = {
      id: this.nextTaskId++,
      name: formData.get('taskName'),
      type: formData.get('taskType'),
      priority: formData.get('priority'),
      startLocation: formData.get('startLocation'),
      targetLocation: formData.get('targetLocation'),
      description: formData.get('description'),
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      estimatedTime: this.getEstimatedTime(formData.get('taskType')),
      actualStartTime: null,
      actualEndTime: null
    };

    try {
      // 验证任务数据
      if (!this.validateTaskData(taskData)) {
        return;
      }

      // 添加到任务列表
      this.tasks.push(taskData);
      
      console.log(`任务创建成功: ${taskData.name}`);
      this.hideCreateTaskModal();
      
      // 显示成功提示
      this.showNotification(`任务 "${taskData.name}" 创建成功!`, 'success');
      
      // 如果没有当前任务，自动开始执行
      if (!this.currentTask) {
        this.executeTask(taskData);
      }
    } catch (error) {
      console.error('任务创建出错:', error);
      this.showNotification('任务创建出错', 'error');
    }
  }

  validateTaskData(taskData) {
    if (!taskData.name || !taskData.type || !taskData.priority) {
      this.showNotification('请填写完整的任务信息', 'error');
      return false;
    }

    if (taskData.type === 'delivery' && (!taskData.startLocation || !taskData.targetLocation)) {
      this.showNotification('配送任务需要指定起始和目标位置', 'error');
      return false;
    }

    return true;
  }

  async executeQuickTask(taskTemplate) {
    const taskData = {
      id: this.nextTaskId++,
      name: taskTemplate.name,
      type: taskTemplate.type,
      priority: 'normal',
      startLocation: taskTemplate.from,
      targetLocation: taskTemplate.to,
      area: taskTemplate.area,
      description: `快速${taskTemplate.name}任务`,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      estimatedTime: this.getEstimatedTime(taskTemplate.type),
      actualStartTime: null,
      actualEndTime: null
    };

    // 添加到任务列表
    this.tasks.push(taskData);
    
    // 执行任务
    await this.executeTask(taskData);
  }

  async executeTask(taskData) {
    if (this.currentTask) {
      this.showNotification('已有任务正在执行中', 'warning');
      return;
    }

    this.currentTask = taskData;
    taskData.status = 'running';
    taskData.actualStartTime = new Date().toISOString();
    
    console.log(`开始执行任务: ${taskData.name}`);
    
    try {
      // 根据任务类型调用相应的执行函数
      const result = await this.callTaskExecutionAPI(taskData);
      
      if (result.success) {
        // 开始任务进度模拟
        this.startTaskProgressSimulation(taskData);
        
        // 更新UI
        this.updateCurrentTaskDisplay();
        
        this.showNotification(`任务 "${taskData.name}" 开始执行`, 'success');
      } else {
        console.error('任务执行失败:', result.error);
        taskData.status = 'failed';
        this.currentTask = null;
        this.showNotification(`任务执行失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('任务执行出错:', error);
      taskData.status = 'failed';
      this.currentTask = null;
      this.showNotification('任务执行出错', 'error');
    }
  }

  async callTaskExecutionAPI(taskData) {
    if (!window.ueApiManager) {
      return { success: false, error: 'UE API Manager未初始化' };
    }

    // 根据任务类型调用不同的UE函数
    switch (taskData.type) {
      case 'delivery':
        return await ueApiManager.startDelivery(taskData.startLocation, taskData.targetLocation);
      
      case 'patrol':
        return await ueApiManager.sendRequest(
          ueApiManager.levelScriptActorPath,
          'StartPatrol',
          { 
            PatrolArea: taskData.area || 'Campus',
            TaskID: taskData.id 
          }
        );
      
      case 'monitoring':
        return await ueApiManager.sendRequest(
          ueApiManager.levelScriptActorPath,
          'StartMonitoring',
          { 
            MonitoringArea: taskData.area || taskData.targetLocation,
            TaskID: taskData.id 
          }
        );
      
      default:
        return { success: false, error: '未知的任务类型' };
    }
  }

  startTaskProgressSimulation(taskData) {
    const progressInterval = setInterval(() => {
      if (!this.currentTask || this.currentTask.id !== taskData.id) {
        clearInterval(progressInterval);
        return;
      }

      if (taskData.progress < 100) {
        // 模拟进度增长
        taskData.progress += Math.random() * 5 + 2;
        
        if (taskData.progress >= 100) {
          taskData.progress = 100;
          this.completeTask(taskData);
          clearInterval(progressInterval);
        }
        
        this.updateCurrentTaskDisplay();
      }
    }, 2000);
  }

  completeTask(taskData) {
    taskData.status = 'completed';
    taskData.actualEndTime = new Date().toISOString();
    
    console.log(`任务完成: ${taskData.name}`);
    this.showNotification(`任务 "${taskData.name}" 执行完成!`, 'success');
    
    // 清除当前任务
    this.currentTask = null;
    this.updateCurrentTaskDisplay();
    
    // 检查是否有等待的任务
    const nextTask = this.tasks.find(t => t.status === 'pending');
    if (nextTask) {
      setTimeout(() => {
        this.executeTask(nextTask);
      }, 3000); // 3秒后自动开始下一个任务
    }
  }

  pauseCurrentTask() {
    if (!this.currentTask) return;
    
    this.currentTask.status = 'paused';
    console.log(`任务暂停: ${this.currentTask.name}`);
    this.showNotification(`任务 "${this.currentTask.name}" 已暂停`, 'warning');
    this.updateCurrentTaskDisplay();
  }

  resumeCurrentTask() {
    if (!this.currentTask) return;
    
    this.currentTask.status = 'running';
    console.log(`任务恢复: ${this.currentTask.name}`);
    this.showNotification(`任务 "${this.currentTask.name}" 已恢复`, 'success');
    this.updateCurrentTaskDisplay();
    
    // 重新开始进度模拟
    this.startTaskProgressSimulation(this.currentTask);
  }

  stopCurrentTask() {
    if (!this.currentTask) return;
    
    this.currentTask.status = 'stopped';
    this.currentTask.actualEndTime = new Date().toISOString();
    
    console.log(`任务停止: ${this.currentTask.name}`);
    this.showNotification(`任务 "${this.currentTask.name}" 已停止`, 'warning');
    
    this.currentTask = null;
    this.updateCurrentTaskDisplay();
  }

  updateCurrentTaskDisplay() {
    const section = document.getElementById('current-task-section');
    if (!section) return;

    if (!this.currentTask) {
      section.innerHTML = `
        <div style="text-align: center; color: #a0a9c0; font-size: 12px;">
          <div style="font-size: 24px; margin-bottom: 8px;">💤</div>
          <div>暂无执行中的任务</div>
        </div>
      `;
      return;
    }

    const task = this.currentTask;
    const statusColors = {
      running: '#00ff41',
      paused: '#ffaa00',
      stopped: '#ff3030'
    };

    section.innerHTML = `
      <div class="current-task-info">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <div style="font-size: 13px; font-weight: 600; color: #ffffff; margin-bottom: 2px;">
              ${this.taskTypes[task.type].icon} ${task.name}
            </div>
            <div style="font-size: 10px; color: #a0a9c0;">
              ${this.taskTypes[task.type].name} • ${task.priority.toUpperCase()}
            </div>
          </div>
          <div style="
            padding: 2px 8px; 
            background: rgba(${statusColors[task.status] || '#ffffff'}, 0.2); 
            border: 1px solid ${statusColors[task.status] || '#ffffff'}; 
            border-radius: 12px; 
            font-size: 10px; 
            color: ${statusColors[task.status] || '#ffffff'};
            font-weight: 600;
          ">
            ${task.status.toUpperCase()}
          </div>
        </div>
        
        <div class="task-progress-bar">
          <div class="task-progress-fill" style="width: ${task.progress}%"></div>
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #a0a9c0; margin-top: 4px;">
          <span>进度: ${Math.round(task.progress)}%</span>
          <span>预计: ${task.estimatedTime}</span>
        </div>
        
        <div class="task-control-buttons">
          ${task.status === 'running' ? 
            '<button class="task-control-btn pause" onclick="taskManager.pauseCurrentTask()">⏸️ 暂停</button>' :
            '<button class="task-control-btn" onclick="taskManager.resumeCurrentTask()">▶️ 继续</button>'
          }
          <button class="task-control-btn stop" onclick="taskManager.stopCurrentTask()">⏹️ 停止</button>
        </div>
      </div>
    `;
  }

  updateTaskProgress() {
    // 外部调用更新任务进度的方法
    if (this.currentTask) {
      this.updateCurrentTaskDisplay();
    }
  }

  getEstimatedTime(taskType) {
    const estimates = {
      delivery: '10-15分钟',
      patrol: '20-30分钟',
      monitoring: '15-20分钟'
    };
    return estimates[taskType] || '15-20分钟';
  }

  showTaskHistory() {
    // 显示任务历史记录（简化版本）
    const completedTasks = this.tasks.filter(t => t.status === 'completed' || t.status === 'stopped');
    
    if (completedTasks.length === 0) {
      this.showNotification('暂无历史任务记录', 'info');
      return;
    }

    console.log('任务历史记录:', completedTasks);
    this.showNotification(`共有 ${completedTasks.length} 条历史任务记录`, 'info');
  }

  showNotification(message, type) {
    // 通知显示方法（与基站管理器相同）
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2000;
      padding: 12px 20px;
      border-radius: 6px;
      color: white;
      font-family: 'Rajdhani', monospace;
      font-weight: 600;
      background: ${type === 'success' ? 'rgba(0, 255, 65, 0.2)' : 
                   type === 'warning' ? 'rgba(255, 170, 0, 0.2)' : 
                   type === 'info' ? 'rgba(0, 153, 255, 0.2)' : 
                   'rgba(255, 48, 48, 0.2)'};
      border: 1px solid ${type === 'success' ? '#00ff41' : 
                         type === 'warning' ? '#ffaa00' : 
                         type === 'info' ? '#0099ff' : 
                         '#ff3030'};
      backdrop-filter: blur(10px);
      animation: taskNotificationAnim 3s ease-in-out forwards;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);

    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes taskNotificationAnim {
        0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        15%, 85% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
    `;
    document.head.appendChild(style);

    // 3秒后自动删除
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 3000);
  }

  // 获取所有任务
  getAllTasks() {
    return [...this.tasks];
  }

  // 根据状态获取任务
  getTasksByStatus(status) {
    return this.tasks.filter(t => t.status === status);
  }

  // 根据类型获取任务
  getTasksByType(type) {
    return this.tasks.filter(t => t.type === type);
  }

  // 获取当前任务
  getCurrentTask() {
    return this.currentTask;
  }
}

// 创建全局实例
window.taskManager = new TaskManager();
