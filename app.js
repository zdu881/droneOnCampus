document.addEventListener("DOMContentLoaded", () => {
  // Initialize Pixel Streaming (保持原有功能)
  pixelStreamingManager.initialize();

  // Setup delivery buttons - 使用新的UE API
  document.querySelectorAll(".delivery-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const from = btn.dataset.from;
      const to = btn.dataset.to;

      try {
        // 使用新的UE HTTP API而不是Pixel Streaming命令
        const result = await ueApiManager.startDelivery(from, to);

        if (result.success) {
          console.log(`配送任务已启动: ${from} → ${to}`);
          updateStatus(`配送任务进行中: ${from} → ${to}`, "inProgress");
        } else {
          console.error("配送任务启动失败:", result.error);
          alert(`配送任务启动失败: ${result.error}`);
        }
      } catch (error) {
        console.error("配送任务启动出错:", error);
        alert("配送任务启动出错，请检查连接。");
      }
    });
  });

  // Setup camera buttons - 使用新的UE API
  document.querySelectorAll(".camera-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const view = btn.dataset.view;

      try {
        // 所有摄像头切换都调用UE的ChangeView函数
        const result = await ueApiManager.changeView();

        if (result.success) {
          console.log(`摄像头视角已切换: ${view}`);
          updateStatus(`摄像头切换至: ${view}`, "success");
        } else {
          console.error("摄像头切换失败:", result.error);
          alert(`摄像头切换失败: ${result.error}`);
        }
      } catch (error) {
        console.error("摄像头切换出错:", error);
        alert("摄像头切换出错，请检查连接。");
      }
    });
  });

  // 保留Pixel Streaming消息监听 (用于接收UE的实时状态更新)
  window.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "statusUpdate") {
        updateStatus(data.message, data.status);
      } else if (data.type === "deliveryUpdate") {
        updateDeliveryStatus(data);
      }
    } catch (e) {
      console.log("收到非JSON消息:", event.data);
    }
  });

  // 状态更新函数
  function updateStatus(message, status) {
    const statusElement = document.getElementById("status");
    statusElement.textContent = message;

    // 设置状态样式
    if (status === "inProgress" || status === "success") {
      statusElement.dataset.status = "connected";
    } else if (status === "error") {
      statusElement.dataset.status = "disconnected";
    }
  }

  function updateDeliveryStatus(data) {
    console.log("配送状态更新:", data);
    // 可以在这里添加更详细的配送状态UI更新
  }

  // 添加调试按钮 (可选)
  addDebugControls();
});

// 添加调试控制面板
function addDebugControls() {
  const debugPanel = document.createElement("div");
  debugPanel.className = "debug-panel";
  debugPanel.innerHTML = `
        <h3>调试控制</h3>
        <button id="test-drone-action">测试无人机动作(Fly)</button>
        <button id="test-change-view">测试切换视角</button>
        <div>
            <label>自定义位置:</label>
            <input type="number" id="custom-x" placeholder="X" value="-1600">
            <input type="number" id="custom-y" placeholder="Y" value="-350">
            <input type="number" id="custom-z" placeholder="Z" value="62">
            <button id="set-custom-location">设置位置(SetLocation)</button>
        </div>
    `;

  document.querySelector(".controls").appendChild(debugPanel);

  // 绑定调试按钮事件
  document
    .getElementById("test-drone-action")
    .addEventListener("click", async () => {
      const result = await ueApiManager.triggerDroneAction();
      console.log("测试无人机动作结果:", result);
    });

  document
    .getElementById("test-change-view")
    .addEventListener("click", async () => {
      const result = await ueApiManager.changeView();
      console.log("测试切换视角结果:", result);
    });

  document
    .getElementById("set-custom-location")
    .addEventListener("click", async () => {
      const x = parseFloat(document.getElementById("custom-x").value);
      const y = parseFloat(document.getElementById("custom-y").value);
      const z = parseFloat(document.getElementById("custom-z").value);

      const result = await ueApiManager.setDroneLocation(x, y, z);
      console.log("设置自定义位置结果:", result);
    });
}
