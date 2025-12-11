// 渲染进程脚本
// 文件: src/renderer.js

class StreamUI {
  constructor() {
    this.statusElement = document.getElementById('status');
    this.statusText = document.getElementById('status-text');
    this.streamContainer = document.getElementById('stream-container');
    this.logElement = document.getElementById('log-entries');
    this.isStreaming = false;
    this.isFlying = false;
    this.startTime = null;
  }

  init() {
    // 设置按钮事件
    document.getElementById('start-btn').addEventListener('click', () => {
      window.electronAPI.startStream();
    });

    document.getElementById('stop-btn').addEventListener('click', () => {
      window.electronAPI.stopStream();
    });

    document.getElementById('config-save').addEventListener('click', () => {
      const config = {
        dashboardUrl: document.getElementById('config-dashboard').value,
        streamUrl: document.getElementById('config-stream').value
      };
      window.electronAPI.updateConfig(config);
      this.log('✅ 配置已保存', 'success');
    });

    // 监听流状态更新
    window.electronAPI.onStreamStatus((event, data) => {
      this.updateStatus(data.status, data.message);
    });

    // 监听错误
    window.electronAPI.onStreamError((event, data) => {
      this.log(`❌ 错误: ${data.message}`, 'error');
    });

    // 配置更新回调
    window.electronAPI.onConfigUpdated((event, data) => {
      if (data.success) {
        this.log('⚙️ 配置更新成功', 'success');
      }
    });

    // 初始状态查询
    window.electronAPI.requestStatus();

    // 定时更新运行时间
    setInterval(() => this.updateUptime(), 1000);

    this.log('🚀 应用已启动', 'success');
  }

  updateStatus(status, message) {
    // 更新状态显示
    this.statusElement.className = `${status}`;
    this.statusText.textContent = message || '未知状态';

    // 更新统计
    if (status === 'streaming') {
      this.isStreaming = true;
      this.startTime = Date.now();
      document.getElementById('stat-streaming').textContent = '运行中';
      document.getElementById('stat-streaming').style.color = '#00ff00';
      this.startDisplayingStream();
      this.log('🎬 像素流已启动', 'success');
    } else {
      this.isStreaming = false;
      document.getElementById('stat-streaming').textContent = '停止';
      document.getElementById('stat-streaming').style.color = '#ff6b6b';
      this.stopDisplayingStream();
      this.log('⏹️ 像素流已停止', 'warning');
    }

    this.log(`📊 状态: ${status} - ${message}`, 'info');
  }

  startDisplayingStream() {
    const iframe = document.createElement('iframe');
    iframe.src = document.getElementById('config-stream').value || 'http://10.30.2.11:80';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    
    this.streamContainer.innerHTML = '';
    this.streamContainer.appendChild(iframe);

    // 监听 iframe 加载完成，自动点击 "Click to start" 按钮
    iframe.onload = () => {
      setTimeout(() => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          
          // 尝试找到并点击启动按钮（UE Pixel Stream 特定）
          const startButton = iframeDoc?.querySelector('button[type="button"]');
          if (startButton) {
            startButton.click();
            this.log('✅ 像素流已自动启动', 'success');
          } else {
            // 如果找不到按钮，尝试查找所有按钮并点击第一个
            const buttons = iframeDoc?.querySelectorAll('button');
            if (buttons && buttons.length > 0) {
              buttons[0].click();
              this.log('✅ 像素流已自动启动 (通用按钮)', 'success');
            }
          }
        } catch (error) {
          // 跨域限制，记录但不中断
          this.log('⚠️ 无法自动启动流 (跨域限制): 请检查 CORS 配置', 'warning');
        }
      }, 500);
    };
  }

  stopDisplayingStream() {
    this.streamContainer.innerHTML = `
      <div class="placeholder">
        <i class="fas fa-stop-circle"></i>
        <p>📡 流已停止</p>
        <p style="font-size: 11px; color: #444; margin-top: 10px;">
          等待无人机飞行或手动启动
        </p>
      </div>
    `;
  }

  updateUptime() {
    if (this.isStreaming && this.startTime) {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      
      const uptime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      document.getElementById('stat-uptime').textContent = uptime;
    } else {
      document.getElementById('stat-uptime').textContent = '-';
    }
  }

  log(message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
    
    this.logElement.appendChild(entry);
    this.logElement.scrollTop = this.logElement.scrollHeight;

    // 限制日志数量 (最多 100 条)
    while (this.logElement.children.length > 100) {
      this.logElement.removeChild(this.logElement.firstChild);
    }
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const ui = new StreamUI();
  ui.init();
});
