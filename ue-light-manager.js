/**
 * UE 灯光控制管理器
 * 
 * 用于控制Unreal Engine中的基站灯光（信号指示灯）
 * 支持红、绿、黄三种颜色状态显示
 * 
 * 灯光对象路径：
 * - Light 1: /Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9CFA302_2066102057
 * - Light 2: /Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1321381589
 * - Light 3: /Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1393896590
 * 
 * 颜色映射：
 * - 0: Red (红) - 错误/检测中
 * - 1: Green (绿) - 正常/空闲
 * - 2: Yellow (黄) - 警告/处理中
 */

class UELightManager {
  constructor() {
    // UE Remote Control API 配置
    // 注意：与 api-manager.js 使用相同的 baseUrl
    this.baseUrl = "http://10.30.2.11:30010/remote/object/call";
    this.method = "POST";  // UE Remote Control API 使用 POST 方法发送 Payload 和调用函数
    this.headers = {
      "Content-Type": "application/json"
    };

    // 灯光对象路径映射
    this.lights = {
      light1: {
        path: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9CFA302_2066102057",
        name: "基站灯1",
        currentColor: 1  // 默认绿色
      },
      light2: {
        path: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1321381589",
        name: "基站灯2",
        currentColor: 1
      },
      light3: {
        path: "/Game/NewMap.NewMap:PersistentLevel.light_C_UAID_A0AD9F0755B9D2A302_1393896590",
        name: "基站灯3",
        currentColor: 1
      }
    };

    // 颜色映射
    this.colors = {
      red: 0,      // 红色 - 错误/检测中
      green: 1,    // 绿色 - 正常/空闲
      yellow: 2    // 黄色 - 警告/处理中
    };

    // 颜色名称反向映射
    this.colorNames = {
      0: "红色",
      1: "绿色",
      2: "黄色"
    };

    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  /**
   * 发送请求到UE Remote Control API
   * @param {string} objectPath - UE对象路径
   * @param {string} functionName - 函数名称
   * @param {object} parameters - 参数对象
   * @returns {Promise<object>} API响应
   */
  async sendRequest(objectPath, functionName, parameters = {}) {
    const payload = {
      objectPath: objectPath,
      functionName: functionName,
      parameters: parameters,
      generateTransaction: true
    };

    try {
      console.log(`[UE Light] 调用函数 '${functionName}' on ${objectPath}`);
      console.log(`[UE Light] 参数:`, parameters);

      const response = await fetch(this.baseUrl, {
        method: this.method,
        headers: this.headers,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[UE Light] 响应成功:`, data);
        this.isConnected = true;
        return { success: true, data: data };
      } else {
        const error = await response.text();
        console.error(`[UE Light] 请求失败 (${response.status}):`, error);
        return { success: false, error: error, status: response.status };
      }
    } catch (error) {
      console.error(`[UE Light] 请求异常:`, error);
      this.isConnected = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * 改变灯光颜色
   * @param {string} lightId - 灯光ID (light1, light2, light3 或 all)
   * @param {number|string} color - 颜色代码 (0=红, 1=绿, 2=黄) 或颜色名称 (red, green, yellow)
   * @returns {Promise<object>} 操作结果
   */
  async changeLightColor(lightId, color) {
    // 解析颜色参数
    let colorCode = color;
    if (typeof color === "string") {
      colorCode = this.colors[color.toLowerCase()];
      if (colorCode === undefined) {
        return { success: false, error: `未知颜色: ${color}` };
      }
    }

    // 获取目标灯光
    const lightsToChange = lightId === "all" 
      ? Object.keys(this.lights)
      : [lightId];

    const results = [];

    for (const id of lightsToChange) {
      if (!this.lights[id]) {
        results.push({
          lightId: id,
          success: false,
          error: `未知灯光ID: ${id}`
        });
        continue;
      }

      const light = this.lights[id];
      const result = await this.sendRequest(
        light.path,
        "ChangeColorAPI",
        { Active: colorCode }
      );

      if (result.success) {
        light.currentColor = colorCode;
      }

      results.push({
        lightId: id,
        lightName: light.name,
        color: this.colorNames[colorCode],
        ...result
      });
    }

    return {
      success: results.every(r => r.success),
      results: results
    };
  }

  /**
   * 设置灯光为绿色（正常/空闲状态）
   * @param {string} lightId - 灯光ID (light1, light2, light3 或 all)
   * @returns {Promise<object>} 操作结果
   */
  async setGreen(lightId = "all") {
    console.log(`[UE Light] 设置 ${lightId} 为绿色`);
    return await this.changeLightColor(lightId, this.colors.green);
  }

  /**
   * 设置灯光为红色（错误/检测中状态）
   * @param {string} lightId - 灯光ID (light1, light2, light3 或 all)
   * @returns {Promise<object>} 操作结果
   */
  async setRed(lightId = "all") {
    console.log(`[UE Light] 设置 ${lightId} 为红色`);
    return await this.changeLightColor(lightId, this.colors.red);
  }

  /**
   * 设置灯光为黄色（警告/处理中状态）
   * @param {string} lightId - 灯光ID (light1, light2, light3 或 all)
   * @returns {Promise<object>} 操作结果
   */
  async setYellow(lightId = "all") {
    console.log(`[UE Light] 设置 ${lightId} 为黄色`);
    return await this.changeLightColor(lightId, this.colors.yellow);
  }

  /**
   * 闪烁灯光（快速切换颜色）
   * @param {string} lightId - 灯光ID
   * @param {number} color - 目标颜色
   * @param {number} count - 闪烁次数 (默认3次)
   * @param {number} interval - 闪烁间隔（毫秒）(默认200ms)
   * @returns {Promise<object>} 操作结果
   */
  async blinkLight(lightId, color, count = 3, interval = 200) {
    console.log(`[UE Light] ${lightId} 闪烁 ${count} 次`);

    const results = [];

    for (let i = 0; i < count; i++) {
      // 开启灯光
      const onResult = await this.changeLightColor(lightId, color);
      results.push(onResult);

      await this.delay(interval);

      // 关闭灯光（设为绿色）
      const offResult = await this.changeLightColor(lightId, this.colors.green);
      results.push(offResult);

      if (i < count - 1) {
        await this.delay(interval);
      }
    }

    return {
      success: results.every(r => r.success),
      results: results
    };
  }

  /**
   * 顺序点亮灯光（类似波浪效果）
   * @param {number} interval - 灯光间隔时间（毫秒）
   * @param {number} color - 灯光颜色
   * @returns {Promise<object>} 操作结果
   */
  async lightSequence(color = 1, interval = 500) {
    console.log(`[UE Light] 顺序点亮灯光`);

    const lightIds = ["light1", "light2", "light3"];
    const results = [];

    // 先全部设为绿色
    await this.setGreen("all");
    await this.delay(interval);

    // 依次点亮
    for (const lightId of lightIds) {
      const result = await this.changeLightColor(lightId, color);
      results.push(result);
      await this.delay(interval);
    }

    // 全部熄灭（设为绿色）
    const finalResult = await this.setGreen("all");
    results.push(finalResult);

    return {
      success: results.every(r => r.success),
      results: results
    };
  }

  /**
   * 根据节点状态自动设置灯光颜色
   * @param {string} lightId - 灯光ID
   * @param {string} status - 节点状态 (idle, detecting, sending, error)
   * @returns {Promise<object>} 操作结果
   */
  async setStatusLight(lightId, status) {
    let color;
    switch (status) {
      case "idle":
        color = "green";  // 空闲 - 绿色
        break;
      case "detecting":
        color = "yellow"; // 检测中 - 黄色
        break;
      case "sending":
        color = "red";    // 发送中 - 红色
        break;
      case "error":
        color = "red";    // 错误 - 红色
        break;
      default:
        return { success: false, error: `未知状态: ${status}` };
    }

    console.log(`[UE Light] 设置 ${lightId} 状态为 ${status} (${color})`);
    return await this.changeLightColor(lightId, color);
  }

  /**
   * 测试连接
   * @returns {Promise<object>} 连接测试结果
   */
  async testConnection() {
    console.log(`[UE Light] 测试连接到 ${this.baseUrl}`);
    
    try {
      const result = await this.sendRequest(
        this.lights.light1.path,
        "ChangeColorAPI",
        { Active: 1 }  // 设为绿色
      );

      if (result.success) {
        this.isConnected = true;
        console.log(`[UE Light] ✓ 连接成功`);
      } else {
        this.isConnected = false;
        console.log(`[UE Light] ✗ 连接失败`);
      }

      return result;
    } catch (error) {
      this.isConnected = false;
      console.error(`[UE Light] 连接异常:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取灯光当前状态
   * @returns {object} 所有灯光的当前颜色状态
   */
  getStatus() {
    const status = {};
    for (const [id, light] of Object.entries(this.lights)) {
      status[id] = {
        name: light.name,
        currentColor: light.currentColor,
        colorName: this.colorNames[light.currentColor]
      };
    }
    return {
      isConnected: this.isConnected,
      lights: status
    };
  }

  /**
   * 延迟函数（毫秒）
   * @param {number} ms - 延迟时间
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 设置基础URL（如果需要自定义UE服务器地址）
   * @param {string} url - UE Remote Control API URL
   */
  setBaseUrl(url) {
    this.baseUrl = url;
    console.log(`[UE Light] 基础URL已更新: ${url}`);
  }

  /**
   * 批量执行灯光操作
   * @param {array} operations - 操作数组
   * @returns {Promise<array>} 执行结果
   */
  async executeBatch(operations) {
    console.log(`[UE Light] 执行批量操作 (${operations.length} 个)`);

    const results = [];
    for (const op of operations) {
      const result = await this[op.action](...op.args);
      results.push({
        action: op.action,
        args: op.args,
        ...result
      });
      
      // 操作间隔
      if (operations.indexOf(op) < operations.length - 1) {
        await this.delay(100);
      }
    }

    return {
      success: results.every(r => r.success),
      results: results
    };
  }
}

// 创建全局实例
window.ueLightManager = new UELightManager();

// 导出供其他模块使用
if (typeof module !== "undefined" && module.exports) {
  module.exports = UELightManager;
}
