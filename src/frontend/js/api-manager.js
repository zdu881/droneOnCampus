// Web Remote Control API管理器，用于与UE进行HTTP通信
class UnrealEngineAPIManager {
  constructor() {
    this.baseUrl = "http://10.30.2.11:30010/remote/object/call";
    this.headers = {
      "Content-Type": "application/json",
    };

    // 运行时路径配置 - 更新为与(1).py文件一致的路径
    this.droneActorPath = "/Game/NewMap.NewMap:PersistentLevel.NewMap_C_0"; // 更新为新的无人机路径
    this.levelScriptActorPath =
      "/Game/NewMap.NewMap:PersistentLevel.NewMap_C_0";

    // 预定义的位置坐标
    this.locations = {
      Warehouse: { x: 0, y: 0, z: 100 },
      Library: { x: -850, y: -30, z: 62 },
      Dormitory: { x: 500, y: 400, z: 80 },
      Cafeteria: { x: -200, y: 300, z: 75 },
    };
  }

  // 发送HTTP请求到UE
  async sendRequest(objectPath, functionName, parameters = {}) {
    const payload = {
      objectPath: objectPath,
      functionName: functionName,
      parameters: parameters,
    };

    try {
      console.log(`调用函数 '${functionName}' 在对象: ${objectPath}`);
      console.log("发送参数:", parameters);

      const response = await fetch(this.baseUrl, {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      console.log(`响应状态码: ${response.status}`);

      if (response.ok) {
        console.log("请求成功!");
        try {
          const responseData = await response.json();
          console.log("响应内容:", responseData);
          return { success: true, data: responseData };
        } catch (e) {
          const responseText = await response.text();
          console.log("响应内容(非JSON):", responseText);
          return { success: true, data: responseText };
        }
      } else {
        const errorText = await response.text();
        console.error(`请求失败，状态码: ${response.status}`);
        console.error("错误内容:", errorText);
        return { success: false, error: errorText };
      }
    } catch (error) {
      console.error("请求过程中发生错误:", error);
      return { success: false, error: error.message };
    }
  }

  // 设置无人机目标位置 - 更新函数名为SetLocation
  async setDroneLocation(x, y, z) {
    return await this.sendRequest(this.droneActorPath, "SetLocation", {
      X: x,
      Y: y,
      Z: z,
    });
  }

  // 触发无人机动作 - 更新函数名为Fly
  async triggerDroneAction() {
    const result = await this.sendRequest(this.droneActorPath, "Fly", {});
    
    // 【新增】同步更新 Dashboard API 的飞行状态，供 Electron 应用检测
    if (result.success) {
      try {
        // 注意: 使用 10.30.2.11 而不是 localhost，以便 Electron 应用也能访问
        await fetch('http://10.30.2.11:8000/api/drone/status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isFlying: true,
            status: 'flying'
          })
        });
        console.log('✅ Dashboard API 飞行状态已更新');
      } catch (err) {
        console.warn('⚠️ 无法更新 Dashboard API 飞行状态:', err.message);
      }
    }
    
    return result;
  }

  // 改变摄像头视角 (对应 changeview.py)
  async changeView() {
    return await this.sendRequest(this.levelScriptActorPath, "ChangeView", {});
  }

  // 开始配送任务 - 更新坐标值以匹配(1).py文件
  async startDelivery(fromLocation, toLocation) {
    if (!this.locations[toLocation]) {
      console.error(`未知的目标位置: ${toLocation}`);
      return { success: false, error: `未知的目标位置: ${toLocation}` };
    }

    const targetPos = this.locations[toLocation];
    console.log(`开始配送任务: ${fromLocation} → ${toLocation}`);

    // 使用SetLocation函数而不是SetTargetLocation
    const setLocationResult = await this.sendRequest(
      this.droneActorPath,
      "SetLocation",
      {
        X: targetPos.x,
        Y: targetPos.y,
        Z: targetPos.z,
      }
    );

    if (!setLocationResult.success) {
      return setLocationResult;
    }

    // 使用Fly函数而不是Action
    const flyResult = await this.sendRequest(this.droneActorPath, "Fly", {});
    
    // 【新增】同步更新 Dashboard API 的飞行状态，供 Electron 应用检测
    if (flyResult.success) {
      try {
        // 注意: 使用 10.30.2.11 而不是 localhost，以便 Electron 应用也能访问
        await fetch('http://10.30.2.11:8000/api/drone/status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isFlying: true,
            status: 'flying'
          })
        });
        console.log('✅ Dashboard API 飞行状态已更新');
      } catch (err) {
        console.warn('⚠️ 无法更新 Dashboard API 飞行状态:', err.message);
      }
    }
    
    return flyResult;
  }

  // 更新运行时路径（当PIE重启时需要调用）
  updateRuntimePaths(droneActorPath, levelScriptActorPath) {
    this.droneActorPath = droneActorPath;
    this.levelScriptActorPath = levelScriptActorPath;
    console.log("已更新运行时路径");
  }

  // 摄像头预设切换 (新增)
  async setCameraPreset(presetName) {
    return await this.sendRequest(
      this.levelScriptActorPath,
      "SetCameraPreset",
      {
        PresetName: presetName,
      }
    );
  }

  // 基站管理 (新增)
  async addStation(stationType, x, y, z, stationName) {
    return await this.sendRequest(this.levelScriptActorPath, "AddStation", {
      StationType: stationType,
      X: x,
      Y: y,
      Z: z,
      StationName: stationName,
    });
  }

  async updateStationStatus(stationId, status) {
    return await this.sendRequest(
      this.levelScriptActorPath,
      "UpdateStationStatus",
      {
        StationID: stationId,
        Status: status,
      }
    );
  }

  async removeStation(stationId) {
    return await this.sendRequest(this.levelScriptActorPath, "RemoveStation", {
      StationID: stationId,
    });
  }

  async getStationStatus(stationId) {
    return await this.sendRequest(
      this.levelScriptActorPath,
      "GetStationStatus",
      {
        StationID: stationId,
      }
    );
  }

  // 任务管理 (新增)
  async startTask(taskType, parameters) {
    return await this.sendRequest(this.levelScriptActorPath, "StartTask", {
      TaskType: taskType,
      Parameters: parameters,
    });
  }

  async startPatrol(patrolArea, taskId) {
    return await this.sendRequest(this.levelScriptActorPath, "StartPatrol", {
      PatrolArea: patrolArea,
      TaskID: taskId,
    });
  }

  async startMonitoring(monitoringArea, taskId) {
    return await this.sendRequest(
      this.levelScriptActorPath,
      "StartMonitoring",
      {
        MonitoringArea: monitoringArea,
        TaskID: taskId,
      }
    );
  }

  async getTaskProgress(taskId) {
    return await this.sendRequest(
      this.levelScriptActorPath,
      "GetTaskProgress",
      {
        TaskID: taskId,
      }
    );
  }

  async pauseTask(taskId) {
    return await this.sendRequest(this.levelScriptActorPath, "PauseTask", {
      TaskID: taskId,
    });
  }

  async resumeTask(taskId) {
    return await this.sendRequest(this.levelScriptActorPath, "ResumeTask", {
      TaskID: taskId,
    });
  }

  async stopTask(taskId) {
    return await this.sendRequest(this.levelScriptActorPath, "StopTask", {
      TaskID: taskId,
    });
  }

  // 添加或更新位置
  addLocation(name, x, y, z) {
    this.locations[name] = { x, y, z };
    console.log(`已添加/更新位置 ${name}: (${x}, ${y}, ${z})`);
  }

  // 获取系统状态 (新增)
  async getSystemStatus() {
    return await this.sendRequest(
      this.levelScriptActorPath,
      "GetSystemStatus",
      {}
    );
  }

  // 获取无人机状态 (新增)
  // 注意: GetDroneStatus 函数在当前 UE 版本中不可用
  async getDroneStatus() {
    console.warn('getDroneStatus 不可用 - UE 中未实现此函数');
    return { 
      success: false, 
      error: 'GetDroneStatus 函数在当前 UE 版本中不可用',
      isFlying: false 
    };
  }

  // 获取无人机当前位置
  // 注意: GetPosition 函数在当前 UE 版本中不可用
  async getDronePosition() {
    console.warn('getDronePosition 不可用 - UE 中未实现此函数');
    return { 
      success: false, 
      error: 'GetPosition 函数在当前 UE 版本中不可用',
      position: { x: 0, y: 0, z: 0 }
    };
  }

  // 获取信号质量信息
  async getSignalQuality() {
    return await this.sendRequest(
      this.levelScriptActorPath,
      "GetSignalQuality",
      {}
    );
  }

  // 设置车辆位置 (Vehicle Scenario)
  // 注意: SetVehicleLocation 函数在当前 UE 版本中不可用
  async setVehiclePosition(x, y, z = 0) {
    console.warn('setVehiclePosition 不可用 - UE 中未实现此函数');
    return { 
      success: false, 
      error: 'SetVehicleLocation 函数在当前 UE 版本中不可用'
    };
  }

  // 启动车辆移动 (Vehicle Scenario)
  async startVehicleMovement(route) {
    return await this.sendRequest(
      this.levelScriptActorPath,
      "StartVehicleRoute",
      {
        Route: route,
      }
    );
  }

  // 获取车辆状态 (Vehicle Scenario)
  // 注意: GetVehicleStatus 函数在当前 UE 版本中不可用
  async getVehicleStatus() {
    console.warn('getVehicleStatus 不可用 - UE 中未实现此函数');
    return { 
      success: false, 
      error: 'GetVehicleStatus 函数在当前 UE 版本中不可用'
    };
  }

  // 简单的连通性检测，用于 dashboard-manager 的 testConnection 调用
  async testConnection() {
    try {
      const resp = await fetch(this.baseUrl, { method: 'GET' });
      if (resp.ok) {
        try {
          const data = await resp.json().catch(() => null);
          return { success: true, data };
        } catch (e) {
          return { success: true };
        }
      }
      return { success: false, status: resp.status, statusText: resp.statusText };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// 创建全局实例
window.ueApiManager = new UnrealEngineAPIManager();
