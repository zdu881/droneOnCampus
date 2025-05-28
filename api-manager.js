// Web Remote Control API管理器，用于与UE进行HTTP通信
class UnrealEngineAPIManager {
  constructor() {
    this.baseUrl = "http://localhost:30010/remote/object/call";
    this.headers = {
      "Content-Type": "application/json",
    };

    // 运行时路径配置 - 这些路径是动态的，每次PIE启动都可能改变
    this.droneActorPath =
      "/Memory/UEDPIE_0_450VU4JLHPSITSM21TWRCZ36J.NewMap:PersistentLevel.FbxScene_Drone_C_UAID_107C61AAC641276C02_1958446408";
    this.levelScriptActorPath =
      "/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_5";

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

  // 设置无人机目标位置 (对应 setlocation.py)
  async setDroneLocation(x, y, z) {
    return await this.sendRequest(this.droneActorPath, "SetTargetLocation", {
      X: x,
      Y: y,
      Z: z,
    });
  }

  // 触发无人机动作 (对应 fly.py)
  async triggerDroneAction() {
    return await this.sendRequest(this.droneActorPath, "Action", {});
  }

  // 改变摄像头视角 (对应 changeview.py)
  async changeView() {
    return await this.sendRequest(this.levelScriptActorPath, "ChangeView", {});
  }

  // 开始配送任务
  async startDelivery(fromLocation, toLocation) {
    if (!this.locations[toLocation]) {
      console.error(`未知的目标位置: ${toLocation}`);
      return { success: false, error: `未知的目标位置: ${toLocation}` };
    }

    const targetPos = this.locations[toLocation];
    console.log(`开始配送任务: ${fromLocation} → ${toLocation}`);

    // 首先设置目标位置
    const setLocationResult = await this.setDroneLocation(
      targetPos.x,
      targetPos.y,
      targetPos.z
    );
    if (!setLocationResult.success) {
      return setLocationResult;
    }

    // 然后触发无人机动作
    return await this.triggerDroneAction();
  }

  // 更新运行时路径（当PIE重启时需要调用）
  updateRuntimePaths(droneActorPath, levelScriptActorPath) {
    this.droneActorPath = droneActorPath;
    this.levelScriptActorPath = levelScriptActorPath;
    console.log("已更新运行时路径");
  }

  // 添加或更新位置
  addLocation(name, x, y, z) {
    this.locations[name] = { x, y, z };
    console.log(`已添加/更新位置 ${name}: (${x}, ${y}, ${z})`);
  }
}

// 创建全局实例
window.ueApiManager = new UnrealEngineAPIManager();
