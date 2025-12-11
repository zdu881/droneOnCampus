// 飞行状态监控器
// 文件: src/drone-monitor.js

const EventEmitter = require('events');

/**
 * 无人机飞行状态监控器
 * 通过轮询 Dashboard API 检测无人机飞行状态
 */
class DroneFlightMonitor extends EventEmitter {
  constructor(serverUrl = 'http://10.30.2.11:8000') {
    super();
    this.serverUrl = serverUrl;
    this.isFlying = false;
    this.pollInterval = 500; // 检查间隔（毫秒）
    this.timeout = null;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  /**
   * 启动飞行状态监控
   */
  start() {
    if (this.timeout) {
      console.log('⚠️ Monitor already running');
      return;
    }

    console.log(`🎯 Starting flight monitor (polling every ${this.pollInterval}ms)`);
    console.log(`📍 Dashboard URL: ${this.serverUrl}`);
    
    this.checkFlightStatus();
  }

  /**
   * 停止飞行状态监控
   */
  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
      console.log('🎯 Flight monitor stopped');
    }
  }

  /**
   * 检查飞行状态（核心方法）
   */
  async checkFlightStatus() {
    try {
      // 调用 Dashboard 提供的飞行状态 API
      // 期望返回: { isFlying: boolean, timestamp: number }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.serverUrl}/api/drone/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const nowFlying = data.isFlying === true;

      // 状态变化检测
      if (nowFlying && !this.isFlying) {
        // 从停止状态变为飞行状态
        this.isFlying = true;
        console.log('✈️ DRONE FLIGHT STARTED');
        this.emit('flight:started', {
          timestamp: Date.now(),
          data: data
        });
        this.retryCount = 0;
      } else if (!nowFlying && this.isFlying) {
        // 从飞行状态变为停止状态
        this.isFlying = false;
        console.log('🛬 DRONE FLIGHT STOPPED');
        this.emit('flight:stopped', {
          timestamp: Date.now(),
          data: data
        });
        this.retryCount = 0;
      }

    } catch (error) {
      console.error(`❌ Failed to check flight status: ${error.message}`);
      this.retryCount++;

      // 检查是否是超时错误
      if (error.name === 'AbortError') {
        console.error('⏱️ Request timeout (5s)');
      }

      // 最多重试 3 次
      if (this.retryCount <= this.maxRetries) {
        console.log(`🔄 Retry ${this.retryCount}/${this.maxRetries}...`);
      } else {
        console.error('❌ Max retries reached');
        this.emit('error', new Error('无法连接到 Dashboard 服务'));
      }
    }

    // 继续轮询
    this.timeout = setTimeout(() => this.checkFlightStatus(), this.pollInterval);
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      isFlying: this.isFlying,
      timestamp: Date.now(),
      serverUrl: this.serverUrl
    };
  }

  /**
   * 更新服务器地址
   */
  setServerUrl(url) {
    this.serverUrl = url;
    console.log(`📍 Updated server URL: ${url}`);
  }

  /**
   * 更新轮询间隔
   */
  setPollInterval(interval) {
    this.pollInterval = interval;
    console.log(`⏱️ Updated poll interval: ${interval}ms`);
  }
}

module.exports = DroneFlightMonitor;
