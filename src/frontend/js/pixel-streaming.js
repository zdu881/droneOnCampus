// Pixel Streaming integration for Unreal Engine - 直接嵌入模式
class PixelStreamingManager {
  constructor() {
    this.iframe = null;
    this.videoElement = document.getElementById("video");
    this.statusElement = document.getElementById("status");
    this.connectionEstablished = false;
    this.streamingUrl = null;
  }

  initialize(streamerUrl = "http://10.30.2.11:80") {
    this.streamingUrl = streamerUrl;
    console.log("初始化Pixel Streaming嵌入模式");

    // 直接设置iframe嵌入
    this.setupIframeStreaming(streamerUrl);
  }

  setupIframeStreaming(streamerUrl) {
    try {
      // 隐藏video元素
      if (this.videoElement) {
        this.videoElement.style.display = "none";
      }

      // 创建iframe容器
      const container = this.videoElement.parentNode;

      // 检查是否已存在iframe
      const existingIframe = document.getElementById("pixel-streaming-iframe");
      if (existingIframe) {
        existingIframe.remove();
      }

      // 创建新的iframe
      this.iframe = document.createElement("iframe");
      this.iframe.id = "pixel-streaming-iframe";
      this.iframe.src = streamerUrl;
      this.iframe.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: none;
        background: #000;
      `;

      // 添加iframe事件监听
      this.iframe.onload = () => {
        console.log("Pixel Streaming iframe加载完成");
        this.connectionEstablished = true;
        this.updateStatus("已连接 (嵌入模式)", "connected");
      };

      this.iframe.onerror = () => {
        console.error("Pixel Streaming iframe加载失败");
        this.connectionEstablished = false;
        this.updateStatus("连接失败", "disconnected");
        this.showConnectionError();
      };

      container.appendChild(this.iframe);

      // 设置初始状态
      this.updateStatus("连接中...", "connecting");
    } catch (error) {
      console.error("设置iframe失败:", error);
      this.updateStatus("初始化错误", "disconnected");
      this.showConnectionError();
    }
  }

  updateStatus(message, status) {
    if (this.statusElement) {
      this.statusElement.textContent = message;
      this.statusElement.dataset.status = status;
    }
  }

  showConnectionError() {
    const container = this.videoElement.parentNode;

    // 移除失败的iframe
    const failedIframe = document.getElementById("pixel-streaming-iframe");
    if (failedIframe) {
      failedIframe.remove();
    }

    // 显示错误信息
    const errorPlaceholder = document.createElement("div");
    errorPlaceholder.id = "streaming-error-placeholder";
    errorPlaceholder.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #2c3e50;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      text-align: center;
    `;

    errorPlaceholder.innerHTML = `
      <div>
        <h3>无法连接到Pixel Streaming</h3>
        <p>URL: ${this.streamingUrl}</p>
        <p>请检查UE服务器是否运行</p>
        <button id="retry-streaming" style="
          margin-top: 15px;
          padding: 10px 20px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">重试连接</button>
        <button id="use-api-only" style="
          margin-top: 10px;
          margin-left: 10px;
          padding: 10px 20px;
          background: #f39c12;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">仅使用API控制</button>
      </div>
    `;

    container.appendChild(errorPlaceholder);

    // 绑定重试按钮
    document.getElementById("retry-streaming").addEventListener("click", () => {
      errorPlaceholder.remove();
      this.setupIframeStreaming(this.streamingUrl);
    });

    // 绑定API模式按钮
    document.getElementById("use-api-only").addEventListener("click", () => {
      errorPlaceholder.remove();
      this.useApiOnlyMode();
    });
  }

  useApiOnlyMode() {
    const container = this.videoElement.parentNode;

    const apiPlaceholder = document.createElement("div");
    apiPlaceholder.id = "api-only-placeholder";
    apiPlaceholder.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      text-align: center;
    `;

    apiPlaceholder.innerHTML = `
      <div>
        <h3>API控制模式</h3>
        <p>视频流不可用，但无人机控制功能正常</p>
        <p>使用下方按钮控制无人机</p>
        <div style="margin-top: 20px;">
          <div style="font-size: 48px; margin-bottom: 10px;">🚁</div>
          <div>Web Remote Control API 已就绪</div>
        </div>
      </div>
    `;

    container.appendChild(apiPlaceholder);

    this.connectionEstablished = false;
    this.updateStatus("API控制模式", "api-only");
  }

  // 简化的命令发送方法 - 在嵌入模式下不需要
  sendCommand(command) {
    console.log("嵌入模式下不支持直接命令发送");
    console.log("请使用Web Remote Control API:", command);
    return false;
  }

  // 重新连接方法
  reconnect() {
    console.log("重新连接Pixel Streaming");
    if (this.streamingUrl) {
      this.setupIframeStreaming(this.streamingUrl);
    }
  }

  // 切换到不同的流地址
  switchToUrl(newUrl) {
    this.streamingUrl = newUrl;
    console.log(`切换到新的流地址: ${newUrl}`);
    this.setupIframeStreaming(newUrl);
  }
}

// Create global instance
window.pixelStreamingManager = new PixelStreamingManager();
