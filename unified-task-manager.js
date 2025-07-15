// 统一面板任务管理器
class UnifiedTaskManager {
  constructor() {
    this.tasks = [];
    this.currentTask = null;
    this.taskIdCounter = 1;
    this.isRunning = false;
    this.isPaused = false;

    this.taskTypes = {
      delivery: { name: "配送任务", icon: "📦", color: "#00b4d8" },
      patrol: { name: "巡逻任务", icon: "🛡️", color: "#f77f00" },
      inspection: { name: "检查任务", icon: "🔍", color: "#fcbf49" },
      emergency: { name: "紧急任务", icon: "🚨", color: "#d62828" }
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.updateUI();
    console.log("统一任务管理器初始化完成");
  }

  bindEvents() {
    // 任务控制按钮
    const startBtn = document.getElementById('start-task-btn');
    const pauseBtn = document.getElementById('pause-task-btn');
    const stopBtn = document.getElementById('stop-task-btn');
    const addTaskBtn = document.getElementById('add-task-btn');

    if (startBtn) {
      startBtn.addEventListener('click', () => this.startTask());
    }
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.pauseTask());
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopTask());
    }
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => this.addTask());
    }

    // 回车键添加任务
    const taskInput = document.getElementById('task-description');
    if (taskInput) {
      taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.addTask();
        }
      });
    }
  }

  addTask() {
    const typeSelect = document.getElementById('task-type-select');
    const descInput = document.getElementById('task-description');

    if (!typeSelect || !descInput) return;

    const type = typeSelect.value;
    const description = descInput.value.trim();

    if (!description) {
      alert('请输入任务描述');
      return;
    }

    const task = {
      id: this.taskIdCounter++,
      type: type,
      description: description,
      status: 'pending',
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      progress: 0
    };

    this.tasks.push(task);
    descInput.value = '';
    
    this.updateUI();
    this.showNotification(`已添加${this.taskTypes[type].name}: ${description}`, 'success');

    console.log('添加任务:', task);
  }

  startTask() {
    if (this.currentTask && this.isPaused) {
      // 恢复暂停的任务
      this.isPaused = false;
      this.isRunning = true;
      this.updateTaskButtons();
      this.showNotification('任务已恢复', 'success');
      return;
    }

    if (this.tasks.length === 0) {
      alert('任务队列为空，请先添加任务');
      return;
    }

    // 开始新任务
    const nextTask = this.tasks.find(task => task.status === 'pending');
    if (!nextTask) {
      alert('没有待执行的任务');
      return;
    }

    this.currentTask = nextTask;
    this.currentTask.status = 'running';
    this.currentTask.startedAt = new Date();
    this.isRunning = true;
    this.isPaused = false;

    this.simulateTaskProgress();
    this.updateUI();
    this.showNotification(`开始执行: ${this.currentTask.description}`, 'success');

    console.log('开始任务:', this.currentTask);
  }

  pauseTask() {
    if (this.currentTask && this.isRunning) {
      this.isPaused = true;
      this.isRunning = false;
      this.currentTask.status = 'paused';
      this.updateUI();
      this.showNotification('任务已暂停', 'warning');
      console.log('暂停任务:', this.currentTask);
    }
  }

  stopTask() {
    if (this.currentTask) {
      this.currentTask.status = 'failed';
      this.currentTask.progress = 0;
      this.currentTask = null;
      this.isRunning = false;
      this.isPaused = false;
      this.updateUI();
      this.showNotification('任务已停止', 'danger');
      console.log('停止任务');
    }
  }

  removeTask(taskId) {
    const taskIndex = this.tasks.findIndex(task => task.id === taskId);
    if (taskIndex > -1) {
      const task = this.tasks[taskIndex];
      if (task === this.currentTask) {
        this.stopTask();
      }
      this.tasks.splice(taskIndex, 1);
      this.updateUI();
      this.showNotification(`已删除任务: ${task.description}`, 'info');
    }
  }

  executeTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task && task.status === 'pending') {
      // 将任务移到队列前面
      const taskIndex = this.tasks.indexOf(task);
      this.tasks.splice(taskIndex, 1);
      this.tasks.unshift(task);
      
      this.startTask();
    }
  }

  simulateTaskProgress() {
    if (!this.currentTask || !this.isRunning) return;

    const progressInterval = setInterval(() => {
      if (!this.currentTask || !this.isRunning || this.isPaused) {
        clearInterval(progressInterval);
        return;
      }

      this.currentTask.progress += Math.random() * 10;
      
      if (this.currentTask.progress >= 100) {
        this.currentTask.progress = 100;
        this.currentTask.status = 'completed';
        this.currentTask.completedAt = new Date();
        
        this.showNotification(`任务完成: ${this.currentTask.description}`, 'success');
        console.log('任务完成:', this.currentTask);
        
        this.currentTask = null;
        this.isRunning = false;
        this.isPaused = false;
        
        clearInterval(progressInterval);
        
        // 自动开始下一个任务
        setTimeout(() => {
          const nextTask = this.tasks.find(task => task.status === 'pending');
          if (nextTask) {
            this.startTask();
          }
        }, 1000);
      }
      
      this.updateUI();
    }, 500);
  }

  updateUI() {
    this.updateTaskStatus();
    this.updateTaskQueue();
    this.updateTaskStats();
    this.updateTaskButtons();
  }

  updateTaskStatus() {
    const currentTaskEl = document.getElementById('current-task');
    const taskProgressEl = document.getElementById('task-progress');
    const taskStatusEl = document.getElementById('task-status');

    if (currentTaskEl) {
      currentTaskEl.textContent = this.currentTask ? this.currentTask.description : '待机中';
    }
    
    if (taskProgressEl) {
      const progress = this.currentTask ? Math.round(this.currentTask.progress) : 0;
      taskProgressEl.textContent = `${progress}%`;
    }
    
    if (taskStatusEl) {
      let status = '空闲';
      if (this.currentTask) {
        switch (this.currentTask.status) {
          case 'running': status = '执行中'; break;
          case 'paused': status = '暂停'; break;
          case 'completed': status = '已完成'; break;
          case 'failed': status = '已停止'; break;
          default: status = '待机';
        }
      }
      taskStatusEl.textContent = status;
    }
  }

  updateTaskQueue() {
    const queueEl = document.getElementById('task-queue');
    if (!queueEl) return;

    if (this.tasks.length === 0) {
      queueEl.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">暂无任务</div>';
      return;
    }

    queueEl.innerHTML = this.tasks.map(task => {
      const taskType = this.taskTypes[task.type];
      const isCurrentTask = task === this.currentTask;
      
      return `
        <div class="task-item ${isCurrentTask ? 'current' : ''}">
          <div class="task-info">
            <div class="task-type">
              <span class="task-status-indicator ${task.status}"></span>
              ${taskType.icon} ${taskType.name}
            </div>
            <div class="task-description">${task.description}</div>
            ${isCurrentTask ? `<div style="font-size: 11px; color: #0099ff; margin-top: 2px;">进度: ${Math.round(task.progress)}%</div>` : ''}
          </div>
          <div class="task-actions-mini">
            ${task.status === 'pending' ? `<button class="task-action-btn execute" onclick="unifiedTaskManager.executeTask(${task.id})">执行</button>` : ''}
            <button class="task-action-btn remove" onclick="unifiedTaskManager.removeTask(${task.id})">删除</button>
          </div>
        </div>
      `;
    }).join('');
  }

  updateTaskStats() {
    const totalTasksEl = document.getElementById('total-tasks');
    const completedTasksEl = document.getElementById('completed-tasks');
    const queuedTasksEl = document.getElementById('queued-tasks');

    if (totalTasksEl) {
      totalTasksEl.textContent = this.tasks.length;
    }
    
    if (completedTasksEl) {
      const completed = this.tasks.filter(task => task.status === 'completed').length;
      completedTasksEl.textContent = completed;
    }
    
    if (queuedTasksEl) {
      const queued = this.tasks.filter(task => task.status === 'pending').length;
      queuedTasksEl.textContent = queued;
    }
  }

  updateTaskButtons() {
    const startBtn = document.getElementById('start-task-btn');
    const pauseBtn = document.getElementById('pause-task-btn');
    const stopBtn = document.getElementById('stop-task-btn');

    if (startBtn) {
      if (this.isPaused) {
        startBtn.textContent = '恢复任务';
        startBtn.disabled = false;
      } else if (this.isRunning) {
        startBtn.textContent = '开始任务';
        startBtn.disabled = true;
      } else {
        startBtn.textContent = '开始任务';
        startBtn.disabled = false;
      }
    }

    if (pauseBtn) {
      pauseBtn.disabled = !this.isRunning;
    }

    if (stopBtn) {
      stopBtn.disabled = !this.currentTask;
    }
  }

  showNotification(message, type = 'info') {
    // 使用全局的通知系统
    if (window.updateStatus) {
      window.updateStatus(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // API 集成方法
  async syncWithAPI() {
    try {
      // 这里可以添加与后端API的同步逻辑
      console.log('与API同步任务数据...');
    } catch (error) {
      console.error('API同步失败:', error);
    }
  }

  // 获取任务统计数据
  getTaskStats() {
    return {
      total: this.tasks.length,
      pending: this.tasks.filter(t => t.status === 'pending').length,
      running: this.tasks.filter(t => t.status === 'running').length,
      completed: this.tasks.filter(t => t.status === 'completed').length,
      failed: this.tasks.filter(t => t.status === 'failed').length,
      currentTask: this.currentTask
    };
  }
}

// 全局实例
window.unifiedTaskManager = new UnifiedTaskManager();
