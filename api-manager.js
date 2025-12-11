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
    // 关卡蓝图路径（打包后）- 更新为 NewMap_C_2（UE v1.2 正确版本）
    this.levelScriptActorPath = "/Game/NewMap.NewMap:PersistentLevel.NewMap_C_2";

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
    const result = await this.sendRequest(this.levelScriptActorPath, "Fly", {});
    
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
      this.levelScriptActorPath,
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
    const flyResult = await this.sendRequest(this.levelScriptActorPath, "Fly", {});
    
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

  // 读取无人机属性 (通过 UE Remote Control Property API)
  async readDroneProperty(propertyName) {
    const propertyPath = `/Script/Engine.Character:${propertyName}`;
    
    const payload = {
      objectPath: this.droneActorPath,
      propertyName: propertyName,
      access: "READ_ACCESS"
    };

    try {
      console.log(`读取无人机属性: ${propertyName}`);
      
      const response = await fetch("http://10.30.2.11:30010/remote/object/property", {
        method: "GET",
        headers: this.headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`属性值: ${propertyName} = ${data.value}`);
      
      return {
        success: true,
        propertyName: propertyName,
        value: data.value,
        returnValue: data.value
      };
    } catch (error) {
      console.error(`读取属性失败 [${propertyName}]:`, error.message);
      return {
        success: false,
        propertyName: propertyName,
        error: error.message
      };
    }
  }

  // 【核心】检测无人机是否在飞行 - 通过读取 bArePropellersActive 属性
  async isUAVFlying() {
    try {
      const result = await this.readDroneProperty("bArePropellersActive");
      
      if (result.success) {
        const isFlying = result.value === true || result.value === 1 || result.value === "true";
        console.log(`无人机飞行状态: ${isFlying ? '✈️ 飞行中' : '🛑 停止'}`);
        
        return {
          success: true,
          isFlying: isFlying,
          propellerActive: result.value
        };
      } else {
        // 备用: 如果读取属性失败，尝试调用函数
        console.warn('属性读取失败，尝试备用方案...');
        return await this.getDroneStatus();
      }
    } catch (error) {
      console.error('检测飞行状态失败:', error);
      return {
        success: false,
        isFlying: false,
        error: error.message
      };
    }
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

// 创建全局实例（两个名字都支持以兼容不同的代码）
window.apiManager = new UnrealEngineAPIManager();
window.ueApiManager = window.apiManager;  // 别名，确保兼容性

