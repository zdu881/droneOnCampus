// Web Remote Control API管理器，用于与UE进行HTTP通信
class UnrealEngineAPIManager {
  constructor() {
    this.baseUrl = "http://10.30.2.11:30010/remote/object/call";
    this.method = "PUT";  // UE Remote Control API 官方文档规范：使用 PUT 方法调用函数
    this.headers = {
      "Content-Type": "application/json",
    };

    // 运行时路径配置
    // 无人机Actor路径（打包后）
    this.droneActorPath = "/Game/NewMap.NewMap:PersistentLevel.FbxScene_Drone_C_UAID_107C61AAC641276C02_1958446408";
    // 关卡蓝图路径（打包后）
    this.levelScriptActorPath = "/Game/NewMap.NewMap:PersistentLevel.NewMap_C_3";

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

    // 判断是否为灯光相关操作（这些可能不存在）
    const isLightOperation = functionName === "ChangeColorAPI";

    try {
      if (!isLightOperation) {
        console.log(`调用函数 '${functionName}' 在对象: ${objectPath}`);
        console.log("发送参数:", parameters);
      }

      const response = await fetch(this.baseUrl, {
        method: this.method,  // 使用 PUT 方法（UE官方规范）
        headers: this.headers,
        body: JSON.stringify(payload),
      });

      if (!isLightOperation) {
        console.log(`响应状态码: ${response.status}`);
      }

      if (response.ok) {
        if (!isLightOperation) {
          console.log("请求成功!");
        }
        try {
          const responseData = await response.json();
          if (!isLightOperation) {
            console.log("响应内容:", responseData);
          }
          return { success: true, data: responseData };
        } catch (e) {
          const responseText = await response.text();
          if (!isLightOperation) {
            console.log("响应内容(非JSON):", responseText);
          }
          return { success: true, data: responseText };
        }
      } else {
        const errorText = await response.text();
        if (!isLightOperation) {
          console.error(`请求失败，状态码: ${response.status}`);
          console.error("错误内容:", errorText);
        }
        return { success: false, error: errorText };
      }
    } catch (error) {
      if (!isLightOperation) {
        console.error("请求过程中发生错误:", error);
      }
      return { success: false, error: error.message };
    }
  }

  // 设置无人机目标位置 - 使用 SetTargetLocation
  async setDroneLocation(x, y, z) {
    // 优先使用 SetTargetLocation，它更符合"目标位置"的语义
    return await this.sendRequest(this.droneActorPath, "SetTargetLocation", {
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
  
  // 基站灯光对象路径（打包后 Standalone 模式）
  getBaseStationLightPaths() {
    return {
      // 打包后 Standalone 模式的灯光对象路径
      light1: "/Game/NewMap/_Generated_/450VU4JLHPSITSM21TWRCZ36J.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1393896590",
      light2: "/Game/NewMap/_Generated_/BA1J4ULWYIRE2TCF6MZFVA30Z.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1321381589",
      light3: "/Game/NewMap/_Generated_/450VU4JLHPSITSM21TWRCZ36J.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9CFA302_2066102057"
    };
  }

  // 改变基站灯光颜色
  // lightIndex: 1, 2, 3 (单个灯) 或 0 (全部灯)
  // colorCode: 0=红, 1=绿, 2=黄
  async changeBaseStationLight(lightIndex, colorCode) {
    const paths = this.getBaseStationLightPaths();
    const lightsToChange = lightIndex === 0 
      ? [paths.light1, paths.light2, paths.light3] 
      : [paths[`light${lightIndex}`]];
    
    const results = [];
    for (const path of lightsToChange) {
      if (path) {
        const result = await this.sendRequest(path, "ChangeColorAPI", { Active: colorCode });
        results.push(result);
      }
    }
    
    return results.length === 1 ? results[0] : { success: results.every(r => r.success), results };
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
window.apiManager = new UnrealEngineAPIManager();
