// Web Remote Control API管理器，用于与UE进行HTTP通信
class UnrealEngineAPIManager {
  constructor() {
    this.baseUrl = "http://10.30.2.11:30010/remote/object/call";
    this.method = "PUT";  // UE Remote Control API 官方文档规范：使用 PUT 方法调用函数
    this.headers = {
      "Content-Type": "application/json",
    };

    // 运行时路径配置 - 使用关卡蓝图路径（推荐）
    // PIE模式路径: /Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_3
    // 打包后路径: /Game/NewMap.NewMap:PersistentLevel.NewMap_C_3
    this.droneActorPath = "/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_3"; // 关卡蓝图路径
    this.levelScriptActorPath =
      "/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_3"; // 关卡蓝图路径

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
        method: this.method,  // 使用 PUT 方法（UE官方规范）
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
    return await this.sendRequest(this.droneActorPath, "Fly", {});
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
    return await this.sendRequest(this.droneActorPath, "Fly", {});
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
  async getDroneStatus() {
    return await this.sendRequest(this.droneActorPath, "GetDroneStatus", {});
  }

  // 获取无人机当前位置
  async getDronePosition() {
    return await this.sendRequest(this.droneActorPath, "GetPosition", {});
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
  async setVehiclePosition(x, y, z = 0) {
    return await this.sendRequest(this.droneActorPath, "SetVehicleLocation", {
      X: x,
      Y: y,
      Z: z,
    });
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
  async getVehicleStatus() {
    return await this.sendRequest(this.droneActorPath, "GetVehicleStatus", {});
  }

  // ==================== 基站灯光控制方法 ====================
  
  // 基站灯光对象路径（根据UE API规范）
  getBaseStationLightPaths() {
    return {
      light1: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9CFA302_2066102057",
      light2: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1321381589",
      light3: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1393896590"
    };
  }

  // 改变基站灯光颜色
  // lightIndex: 1, 2, 3 (单个灯) 或 0 (全部灯)
  // colorCode: 0=红, 1=绿, 2=黄
  async changeBaseStationLight(lightIndex, colorCode) {
    const lightPaths = this.getBaseStationLightPaths();
    
    if (lightIndex === 0) {
      // 改变所有灯光
      const results = [];
      for (let i = 1; i <= 3; i++) {
        const result = await this.sendRequest(
          lightPaths[`light${i}`],
          "ChangeColorAPI",
          { Active: colorCode }
        );
        results.push(result);
      }
      return { 
        success: results.every(r => r.success), 
        results: results 
      };
    } else if (lightIndex >= 1 && lightIndex <= 3) {
      // 改变单个灯光
      return await this.sendRequest(
        lightPaths[`light${lightIndex}`],
        "ChangeColorAPI",
        { Active: colorCode }
      );
    } else {
      return { 
        success: false, 
        error: "无效的灯光索引，应该是0-3" 
      };
    }
  }

  // 设置基站灯光为绿色（正常状态）
  async setBaseStationGreen(lightIndex = 0) {
    console.log(`设置基站灯光${lightIndex === 0 ? "全部" : lightIndex}为绿色`);
    return await this.changeBaseStationLight(lightIndex, 1); // 1 = 绿色
  }

  // 设置基站灯光为红色（错误/检测中状态）
  async setBaseStationRed(lightIndex = 0) {
    console.log(`设置基站灯光${lightIndex === 0 ? "全部" : lightIndex}为红色`);
    return await this.changeBaseStationLight(lightIndex, 0); // 0 = 红色
  }

  // 设置基站灯光为黄色（警告/处理中状态）
  async setBaseStationYellow(lightIndex = 0) {
    console.log(`设置基站灯光${lightIndex === 0 ? "全部" : lightIndex}为黄色`);
    return await this.changeBaseStationLight(lightIndex, 2); // 2 = 黄色
  }

  // 根据状态自动设置灯光颜色
  // status: "idle" (绿) | "detecting" (黄) | "sending" (红) | "error" (红)
  async setBaseStationStatusLight(lightIndex, status) {
    let colorCode;
    switch (status) {
      case "idle":
        colorCode = 1; // 绿色
        break;
      case "detecting":
        colorCode = 2; // 黄色
        break;
      case "sending":
      case "error":
        colorCode = 0; // 红色
        break;
      default:
        return { success: false, error: `未知状态: ${status}` };
    }
    
    console.log(`设置基站灯光${lightIndex}状态为${status}`);
    return await this.changeBaseStationLight(lightIndex, colorCode);
  }

  // 灯光闪烁效果
  async blinkBaseStationLight(lightIndex, colorCode, count = 3, interval = 300) {
    console.log(`基站灯光${lightIndex}闪烁${count}次`);
    
    const results = [];
    for (let i = 0; i < count; i++) {
      const onResult = await this.changeBaseStationLight(lightIndex, colorCode);
      results.push(onResult);
      
      await new Promise(resolve => setTimeout(resolve, interval));
      
      const offResult = await this.changeBaseStationLight(lightIndex, 1); // 恢复为绿色
      results.push(offResult);
      
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    return {
      success: results.every(r => r.success),
      results: results
    };
  }
}

// 创建全局实例
window.ueApiManager = new UnrealEngineAPIManager();
