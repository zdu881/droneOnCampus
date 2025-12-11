// 像素流管理器
// 文件: src/stream-manager.js

const EventEmitter = require('events');

/**
 * 像素流管理器
 * 管理像素流的启动、停止和状态
 */
class PixelStreamManager extends EventEmitter {
  constructor(streamUrl = 'http://10.30.2.11:80') {
    super();
    this.streamUrl = streamUrl;
    this.isActive = false;
    this.startTime = null;
  }

  /**
   * 启动像素流接收
   */
  startStream() {
    if (this.isActive) {
      console.log('⚠️ Stream already active');
      return;
    }

    this.isActive = true;
    this.startTime = Date.now();
    
    console.log('🎬 Starting pixel stream');
    console.log(`📡 Stream URL: ${this.streamUrl}`);

    // 发送事件
    this.emit('stream:started', {
      url: this.streamUrl,
      timestamp: this.startTime
    });
  }

  /**
   * 停止像素流接收
   */
  stopStream() {
    if (!this.isActive) {
      console.log('⚠️ Stream already stopped');
      return;
    }

    this.isActive = false;
    const duration = Date.now() - this.startTime;

    console.log('⏹️ Stopping pixel stream');
    console.log(`⏱️ Stream duration: ${(duration / 1000).toFixed(2)}s`);

    // 发送事件
    this.emit('stream:stopped', {
      timestamp: Date.now(),
      duration: duration
    });
  }

  /**
   * 获取流状态
   */
  getStatus() {
    return {
      isActive: this.isActive,
      url: this.streamUrl,
      startTime: this.startTime,
      uptime: this.isActive ? Date.now() - this.startTime : 0,
      timestamp: Date.now()
    };
  }

  /**
   * 更新流 URL
   */
  setStreamUrl(url) {
    this.streamUrl = url;
    console.log(`📡 Updated stream URL: ${url}`);
  }
}

module.exports = PixelStreamManager;
