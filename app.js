document.addEventListener("DOMContentLoaded", () => {
  // Initialize Pixel Streaming (保持原有功能)
  pixelStreamingManager.initialize();

  // Initialize new enhanced components
  initializeEnhancedComponents();

  // Initialize data displays
  initializeDataDisplays();

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
          
          // Start mission display with simulated data
          startMissionDisplay(from, to);
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

// Data Display Management
let droneData = {
  position: { x: -850.00, y: -30.00, z: 62.00 },
  battery: 87,
  speed: 15.2,
  mission: {
    status: 'STANDBY',
    target: 'Library',
    distance: 245.6
  },
  environment: {
    windSpeed: 12.3,
    temperature: 22.5
  }
};

let missionInProgress = false;
let dataUpdateInterval;

function initializeDataDisplays() {
  console.log('初始化数据显示...');
  
  // Start real-time data updates
  startDataUpdates();
  
  // Update system time every second
  setInterval(updateSystemTime, 1000);
  
  // Initial display update
  updateAllDisplays();
  
  console.log('数据显示初始化完成');
}

function startDataUpdates() {
  // Update telemetry data every 2 seconds
  dataUpdateInterval = setInterval(() => {
    if (missionInProgress) {
      simulateMissionData();
    } else {
      simulateIdleData();
    }
    updateAllDisplays();
  }, 2000);
}

function simulateIdleData() {
  // Simulate small variations in idle state
  droneData.position.x += (Math.random() - 0.5) * 2;
  droneData.position.y += (Math.random() - 0.5) * 2;
  droneData.position.z += (Math.random() - 0.5) * 1;
  
  // Battery slowly decreases
  if (droneData.battery > 15) {
    droneData.battery -= Math.random() * 0.1;
  }
  
  // Wind speed variation
  droneData.environment.windSpeed = 8 + Math.random() * 8;
  
  // Low speed when idle
  droneData.speed = Math.random() * 3;
}

function simulateMissionData() {
  // Simulate mission progress
  const targetLocation = ueApiManager.locations[droneData.mission.target];
  
  if (targetLocation) {
    // Move towards target
    const dx = targetLocation.x - droneData.position.x;
    const dy = targetLocation.y - droneData.position.y;
    const dz = targetLocation.z - droneData.position.z;
    
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    if (distance > 5) {
      // Move closer to target
      const moveSpeed = 0.3;
      droneData.position.x += dx * moveSpeed / distance;
      droneData.position.y += dy * moveSpeed / distance;
      droneData.position.z += dz * moveSpeed / distance;
      
      droneData.speed = 15 + Math.random() * 10;
      droneData.mission.distance = distance;
      droneData.mission.status = 'EN ROUTE';
    } else {
      // Arrived at target
      droneData.mission.status = 'DELIVERED';
      droneData.speed = 0;
      droneData.mission.distance = 0;
      
      // Mission complete after a delay
      setTimeout(() => {
        missionInProgress = false;
        droneData.mission.status = 'STANDBY';
        droneData.mission.target = 'None';
      }, 3000);
    }
  }
  
  // Battery drains faster during missions
  droneData.battery -= Math.random() * 0.3;
  
  // Higher wind resistance during flight
  droneData.environment.windSpeed = 10 + Math.random() * 15;
}

function updateAllDisplays() {
  // Update drone telemetry (left overlay)
  updateElement('drone-x', droneData.position.x.toFixed(2));
  updateElement('drone-y', droneData.position.y.toFixed(2));
  updateElement('drone-z', droneData.position.z.toFixed(2) + 'm');
  
  // Battery with color coding
  const batteryElement = document.getElementById('drone-battery');
  if (batteryElement) {
    batteryElement.textContent = droneData.battery.toFixed(1) + '%';
    batteryElement.className = 'data-value';
    if (droneData.battery < 20) {
      batteryElement.classList.add('danger');
    } else if (droneData.battery < 40) {
      batteryElement.classList.add('warning');
    }
  }
  
  updateElement('drone-speed', droneData.speed.toFixed(1) + ' m/s');
  
  // Update mission status (right overlay)
  const statusElement = document.getElementById('mission-status');
  if (statusElement) {
    statusElement.textContent = droneData.mission.status;
    statusElement.className = 'data-value';
    if (droneData.mission.status === 'EN ROUTE') {
      statusElement.classList.add('warning');
    } else if (droneData.mission.status === 'DELIVERED') {
      statusElement.style.color = 'var(--success-neon)';
    }
  }
  
  updateElement('mission-target', droneData.mission.target);
  updateElement('target-distance', droneData.mission.distance.toFixed(1) + 'm');
  
  // Wind speed with warning if too high
  const windElement = document.getElementById('wind-speed');
  if (windElement) {
    windElement.textContent = droneData.environment.windSpeed.toFixed(1) + ' km/h';
    windElement.className = 'data-value';
    if (droneData.environment.windSpeed > 20) {
      windElement.classList.add('danger');
    } else if (droneData.environment.windSpeed > 15) {
      windElement.classList.add('warning');
    }
  }
}

function updateElement(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function updateSystemTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('zh-CN', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  updateElement('system-time', timeString);
}

// Initialize enhanced components
function initializeEnhancedComponents() {
  console.log('初始化增强组件...');
  
  // Initialize components in proper order
  setTimeout(() => {
    if (window.mapManager) {
      mapManager.initialize();
    }
  }, 500);

  setTimeout(() => {
    if (window.cameraPresetManager) {
      cameraPresetManager.initialize();
    }
  }, 1000);

  setTimeout(() => {
    if (window.stationManager) {
      stationManager.initialize();
    }
  }, 1500);

  setTimeout(() => {
    if (window.taskManager) {
      taskManager.initialize();
    }
  }, 2000);

  // Setup data integration
  setupDataIntegration();
  
  console.log('增强组件初始化完成');
}

// Setup data integration between components
function setupDataIntegration() {
  // Update map manager with drone position changes
  const originalUpdateAllDisplays = updateAllDisplays;
  updateAllDisplays = function() {
    originalUpdateAllDisplays();
    
    // Update map manager with new drone position
    if (window.mapManager) {
      mapManager.updateDronePosition(
        droneData.position.x,
        droneData.position.y,
        droneData.position.z
      );
    }
  };

  // Listen for task completion to update mission data
  window.addEventListener('taskComplete', (event) => {
    const task = event.detail;
    if (task.type === 'delivery') {
      droneData.mission.target = task.targetLocation || 'None';
      droneData.mission.status = 'STANDBY';
      missionInProgress = false;
    }
  });
}

// Enhanced mission start function
function startMissionDisplay(from, to) {
  console.log(`开始任务显示: ${from} → ${to}`);
  
  missionInProgress = true;
  droneData.mission.status = 'PREPARING';
  droneData.mission.target = to;
  
  // Calculate initial distance
  const targetLocation = ueApiManager.locations[to];
  if (targetLocation) {
    const dx = targetLocation.x - droneData.position.x;
    const dy = targetLocation.y - droneData.position.y;
    const dz = targetLocation.z - droneData.position.z;
    droneData.mission.distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
  }
  
  // Update display immediately
  updateAllDisplays();
  
  // Start mission after brief delay
  setTimeout(() => {
    if (missionInProgress) {
      droneData.mission.status = 'LAUNCHING';
    }
  }, 2000);
}

// 添加调试控制面板
function addDebugControls() {
  const debugPanel = document.createElement("div");
  debugPanel.className = "debug-panel";
  debugPanel.innerHTML = `
        <h3>调试控制</h3>
        <div>
            <h4>Pixel Streaming</h4>
            <input type="text" id="streaming-url" placeholder="流地址" value="http://10.30.2.11:80" style="width: 200px;">
            <button id="connect-streaming">连接流</button>
            <button id="api-only-mode">仅API模式</button>
        </div>
        <div>
            <h4>无人机控制</h4>
            <button id="test-drone-action">测试无人机动作(Fly)</button>
            <button id="test-change-view">测试切换视角</button>
        </div>
        <div>
            <label>自定义位置:</label>
            <input type="number" id="custom-x" placeholder="X" value="-1600">
            <input type="number" id="custom-y" placeholder="Y" value="-350">
            <input type="number" id="custom-z" placeholder="Z" value="62">
            <button id="set-custom-location">设置位置(SetLocation)</button>
        </div>
    `;

  document.querySelector(".controls").appendChild(debugPanel);

  // 绑定流控制按钮
  document.getElementById("connect-streaming").addEventListener("click", () => {
    const url = document.getElementById("streaming-url").value;
    if (url) {
      pixelStreamingManager.switchToUrl(url);
    }
  });

  document.getElementById("api-only-mode").addEventListener("click", () => {
    pixelStreamingManager.useApiOnlyMode();
  });

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
