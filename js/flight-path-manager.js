/**
 * 简化的无人机飞行路径管理器
 * 支持从起点飞往终点的简单功能
 */
class FlightPathManager {
  constructor(apiManager) {
    this.apiManager = apiManager;
    this.startLocation = null;
    this.targetLocation = null;
    this.isFlying = false;
    this.listeners = {
      onFlightStarted: [],
      onFlightCompleted: [],
      onFlightError: []
    };
  }

  /**
   * 设置起点
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setStartLocation(x, y, z) {
    this.startLocation = { x: Number(x), y: Number(y), z: Number(z) };
    console.log('起点已设置:', this.startLocation);
  }

  /**
   * 设置终点
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setTargetLocation(x, y, z) {
    this.targetLocation = { x: Number(x), y: Number(y), z: Number(z) };
    console.log('终点已设置:', this.targetLocation);
  }

  /**
   * 获取路径描述
   * @returns {string}
   */
  getPathDescription() {
    if (!this.startLocation || !this.targetLocation) {
      return '未设置起点或终点';
    }
    const start = this.startLocation;
    const target = this.targetLocation;
    return `从 (${start.x}, ${start.y}, ${start.z}) 飞往 (${target.x}, ${target.y}, ${target.z})`;
  }

  /**
   * 开始飞行
   * @returns {Promise<Object>}
   */
  async startFlight() {
    if (!this.startLocation || !this.targetLocation) {
      return { success: false, error: '未设置起点或终点' };
    }

    if (this.isFlying) {
      return { success: false, error: '飞行已在进行中' };
    }

    this.isFlying = true;
    this.emit('onFlightStarted', {
      start: this.startLocation,
      target: this.targetLocation
    });

    try {
      // 步骤1：设置无人机位置到终点
      const setResult = await this.apiManager.setDroneLocation(
        this.targetLocation.x,
        this.targetLocation.y,
        this.targetLocation.z
      );

      if (!setResult.success) {
        throw new Error('设置位置失败: ' + (setResult.error || '未知错误'));
      }

      console.log('✓ 位置已设置');

      // 步骤2：执行飞行
      const flyResult = await this.apiManager.triggerDroneAction();
      if (!flyResult.success) {
        throw new Error('执行飞行失败: ' + (flyResult.error || '未知错误'));
      }

      console.log('✓ 飞行已执行');

      this.emit('onFlightCompleted', {
        success: true,
        message: '飞行完成',
        start: this.startLocation,
        target: this.targetLocation
      });

      return { success: true, message: '飞行完成' };
    } catch (error) {
      console.error('飞行错误:', error.message);
      this.emit('onFlightError', { error: error.message });
      return { success: false, error: error.message };
    } finally {
      this.isFlying = false;
    }
  }

  /**
   * 添加事件监听
   */
  on(eventName, callback) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].push(callback);
    }
  }

  /**
   * 移除事件监听
   */
  off(eventName, callback) {
    if (this.listeners[eventName]) {
      this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback);
    }
  }

  /**
   * 触发事件
   * @private
   */
  emit(eventName, data) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件 ${eventName} 的回调执行失败:`, error);
        }
      });
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FlightPathManager;
}

  /**
   * 路径数据格式 - 支持三种模式
   * 
   * 模式 1: 单点飞行（最简单）
   * {
   *   type: "single",
   *   target: { x: 100, y: 200, z: 150 },
   *   speed: "normal"  // 可选: slow/normal/fast
   * }
   * 
   * 模式 2: 顺序多点飞行
   * {
   *   type: "sequential",
   *   waypoints: [
   *     { x: 0, y: 0, z: 100 },
   *     { x: 100, y: 100, z: 120 },
   *     { x: 200, y: 0, z: 150 }
   *   ],
   *   speed: "normal"  // 所有路径点共用速度
   * }
   * 
   * 模式 3: 高级（支持每个路径点的独立速度和延迟）
   * {
   *   type: "advanced",
   *   waypoints: [
   *     { 
   *       x: 0, y: 0, z: 100, 
   *       speed: "slow",      // 可选
   *       delayBefore: 0      // 到达本点前的延迟（毫秒）
   *     },
   *     { x: 100, y: 100, z: 120, speed: "normal" },
   *     { x: 200, y: 0, z: 150, speed: "fast", delayBefore: 2000 }
   *   ],
   *   loopCount: 1,           // 循环执行次数，默认1
   *   autoReturn: false       // 执行完毕后是否返回起点
   * }
   */

  /**
   * 验证路径数据的有效性
   * @param {Object} pathData - 路径数据
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validatePath(pathData) {
    const errors = [];

    if (!pathData || typeof pathData !== 'object') {
      errors.push('路径数据必须是对象');
      return { valid: false, errors };
    }

    if (!pathData.type) {
      errors.push('缺少必需的字段: type');
    } else if (!['single', 'sequential', 'advanced'].includes(pathData.type)) {
      errors.push('无效的路径类型: ' + pathData.type);
    }

    // 根据类型进行额外验证
    if (pathData.type === 'single') {
      if (!pathData.target) {
        errors.push('单点飞行需要 target 字段');
      } else if (!this._validateCoordinate(pathData.target)) {
        errors.push('target 坐标无效: ' + JSON.stringify(pathData.target));
      }
    } else if (pathData.type === 'sequential' || pathData.type === 'advanced') {
      if (!Array.isArray(pathData.waypoints) || pathData.waypoints.length === 0) {
        errors.push('需要至少一个路径点');
      } else {
        pathData.waypoints.forEach((wp, idx) => {
          if (!this._validateCoordinate(wp)) {
            errors.push(`路径点 ${idx} 坐标无效: ${JSON.stringify(wp)}`);
          }
        });
      }
    }

    // 验证可选字段
    if (pathData.speed && !['slow', 'normal', 'fast'].includes(pathData.speed)) {
      errors.push('无效的速度值: ' + pathData.speed);
    }

    if (pathData.loopCount && (typeof pathData.loopCount !== 'number' || pathData.loopCount < 1)) {
      errors.push('循环次数必须是正整数');
    }

    return { 
      valid: errors.length === 0, 
      errors 
    };
  }

  /**
   * 验证坐标是否有效 (包含x, y, z数字字段)
   * @private
   */
  _validateCoordinate(coord) {
    return coord && 
           typeof coord === 'object' &&
           typeof coord.x === 'number' &&
           typeof coord.y === 'number' &&
           typeof coord.z === 'number';
  }

  /**
   * 创建单点飞行路径
   * @param {number} x - X 坐标
   * @param {number} y - Y 坐标
   * @param {number} z - Z 坐标
   * @param {string} speed - 速度等级: slow/normal/fast
   * @returns {Object} 路径对象
   */
  createSinglePathTo(x, y, z, speed = 'normal') {
    return {
      type: 'single',
      target: { x, y, z },
      speed
    };
  }

  /**
   * 创建顺序多点飞行路径
   * @param {Array} waypoints - 路径点数组: [{x, y, z}, ...]
   * @param {string} speed - 所有路径点共用的速度等级
   * @returns {Object} 路径对象
   */
  createSequentialPath(waypoints, speed = 'normal') {
    return {
      type: 'sequential',
      waypoints,
      speed
    };
  }

  /**
   * 创建高级飞行路径（支持循环、延迟、返回起点等）
   * @param {Array} waypoints - 路径点数组，每个点可选 speed 和 delayBefore
   * @param {number} loopCount - 循环次数，默认1
   * @param {boolean} autoReturn - 完成后是否返回起点，默认false
   * @returns {Object} 路径对象
   */
  createAdvancedPath(waypoints, loopCount = 1, autoReturn = false) {
    return {
      type: 'advanced',
      waypoints,
      loopCount,
      autoReturn
    };
  }

  /**
   * 设置当前飞行路径
   * @param {Object} pathData - 路径数据
   * @returns {boolean} 设置成功
   */
  setPath(pathData) {
    const validation = this.validatePath(pathData);
    if (!validation.valid) {
      this.emit('onFlightError', {
        message: '路径验证失败',
        errors: validation.errors
      });
      return false;
    }

    this.currentPath = JSON.parse(JSON.stringify(pathData)); // 深拷贝
    this.currentWaypointIndex = 0;
    this.emit('onPathUpdated', this.currentPath);
    return true;
  }

  /**
   * 开始执行飞行路径
   * @returns {Promise<Object>} 飞行结果
   */
  async startFlight() {
    if (!this.currentPath) {
      return { success: false, error: '未设置飞行路径' };
    }

    if (this.isFlying) {
      return { success: false, error: '飞行已在进行中' };
    }

    this.isFlying = true;
    this.emit('onFlightStarted', this.currentPath);

    try {
      return await this._executePath();
    } catch (error) {
      this.emit('onFlightError', { error: error.message });
      return { success: false, error: error.message };
    } finally {
      this.isFlying = false;
    }
  }

  /**
   * 执行路径飞行（内部方法）
   * @private
   */
  async _executePath() {
    const path = this.currentPath;

    if (path.type === 'single') {
      return await this._executeSingleFlight(path);
    } else if (path.type === 'sequential') {
      return await this._executeSequentialFlight(path);
    } else if (path.type === 'advanced') {
      return await this._executeAdvancedFlight(path);
    }

    return { success: false, error: '未知的路径类型' };
  }

  /**
   * 执行单点飞行
   * @private
   */
  async _executeSingleFlight(path) {
    const target = path.target;
    
    // 设置位置
    const setResult = await this.apiManager.setDroneLocation(target.x, target.y, target.z);
    if (!setResult.success) {
      throw new Error('设置位置失败: ' + (setResult.error || '未知错误'));
    }

    // 执行飞行
    const flyResult = await this.apiManager.triggerDroneAction();
    if (!flyResult.success) {
      throw new Error('执行飞行失败: ' + (flyResult.error || '未知错误'));
    }

    this.emit('onWaypointReached', { index: 0, coordinate: target });
    this.emit('onFlightCompleted', { 
      success: true, 
      message: '单点飞行完成',
      targetReached: target 
    });

    return { success: true, message: '单点飞行完成' };
  }

  /**
   * 执行顺序多点飞行
   * @private
   */
  async _executeSequentialFlight(path) {
    const waypoints = path.waypoints;

    for (let i = 0; i < waypoints.length; i++) {
      if (!this.isFlying) break; // 允许被中断

      const waypoint = waypoints[i];

      // 设置位置
      const setResult = await this.apiManager.setDroneLocation(
        waypoint.x,
        waypoint.y,
        waypoint.z
      );

      if (!setResult.success) {
        throw new Error(`设置路径点 ${i} 失败: ${setResult.error || '未知错误'}`);
      }

      // 执行飞行
      const flyResult = await this.apiManager.triggerDroneAction();
      if (!flyResult.success) {
        throw new Error(`执行路径点 ${i} 飞行失败: ${flyResult.error || '未知错误'}`);
      }

      this.currentWaypointIndex = i;
      this.emit('onWaypointReached', { index: i, coordinate: waypoint });

      // 在路径点之间添加小延迟，避免过快执行
      if (i < waypoints.length - 1) {
        await this._sleep(500);
      }
    }

    this.emit('onFlightCompleted', {
      success: true,
      message: '顺序多点飞行完成',
      totalWaypoints: waypoints.length
    });

    return { success: true, message: '顺序多点飞行完成' };
  }

  /**
   * 执行高级飞行（支持循环、延迟等）
   * @private
   */
  async _executeAdvancedFlight(path) {
    const waypoints = path.waypoints;
    const loopCount = path.loopCount || 1;
    const autoReturn = path.autoReturn || false;
    const startPoint = waypoints[0]; // 记录起点，用于返回

    for (let loop = 0; loop < loopCount; loop++) {
      for (let i = 0; i < waypoints.length; i++) {
        if (!this.isFlying) break;

        const waypoint = waypoints[i];

        // 处理延迟
        if (waypoint.delayBefore && waypoint.delayBefore > 0) {
          await this._sleep(waypoint.delayBefore);
        }

        // 设置位置
        const setResult = await this.apiManager.setDroneLocation(
          waypoint.x,
          waypoint.y,
          waypoint.z
        );

        if (!setResult.success) {
          throw new Error(`设置路径点 ${i}(循环${loop + 1}) 失败: ${setResult.error || '未知错误'}`);
        }

        // 执行飞行
        const flyResult = await this.apiManager.triggerDroneAction();
        if (!flyResult.success) {
          throw new Error(`执行路径点 ${i}(循环${loop + 1}) 飞行失败: ${flyResult.error || '未知错误'}`);
        }

        this.currentWaypointIndex = i;
        this.emit('onWaypointReached', { 
          index: i, 
          coordinate: waypoint,
          loop: loop + 1
        });

        // 路径点间延迟
        if (i < waypoints.length - 1) {
          await this._sleep(500);
        }
      }

      if (!this.isFlying) break;
    }

    // 如果启用自动返回，飞回起点
    if (autoReturn && this.isFlying) {
      const returnResult = await this.apiManager.setDroneLocation(
        startPoint.x,
        startPoint.y,
        startPoint.z
      );

      if (!returnResult.success) {
        throw new Error('返回起点失败: ' + (returnResult.error || '未知错误'));
      }

      await this.apiManager.triggerDroneAction();
      this.emit('onWaypointReached', { 
        index: 'return', 
        coordinate: startPoint,
        message: '返回起点'
      });
    }

    this.emit('onFlightCompleted', {
      success: true,
      message: '高级飞行完成',
      totalWaypoints: waypoints.length,
      totalLoops: loopCount,
      autoReturned: autoReturn
    });

    return { success: true, message: '高级飞行完成' };
  }

  /**
   * 暂停飞行（停止当前飞行循环）
   */
  pauseFlight() {
    if (this.isFlying) {
      this.isFlying = false;
      this.emit('onFlightPaused', { 
        currentIndex: this.currentWaypointIndex,
        message: '飞行已暂停'
      });
      return { success: true, message: '飞行已暂停' };
    }
    return { success: false, error: '没有正在进行的飞行' };
  }

  /**
   * 清空当前路径
   */
  clearPath() {
    this.currentPath = null;
    this.currentWaypointIndex = 0;
    this.emit('onPathUpdated', null);
    return { success: true, message: '路径已清空' };
  }

  /**
   * 获取路径的文本描述
   * @returns {string}
   */
  getPathDescription() {
    if (!this.currentPath) {
      return '未设置路径';
    }

    const path = this.currentPath;
    let desc = '';

    if (path.type === 'single') {
      const t = path.target;
      desc = `单点飞行: 目标位置 (${t.x}, ${t.y}, ${t.z}), 速度: ${path.speed}`;
    } else if (path.type === 'sequential') {
      desc = `顺序飞行: ${path.waypoints.length} 个路径点, 速度: ${path.speed}`;
    } else if (path.type === 'advanced') {
      desc = `高级飞行: ${path.waypoints.length} 个路径点, ${path.loopCount} 次循环`;
      if (path.autoReturn) desc += ', 自动返回起点';
    }

    return desc;
  }

  /**
   * 序列化路径为JSON字符串（用于保存）
   * @returns {string}
   */
  serializePath() {
    return JSON.stringify(this.currentPath, null, 2);
  }

  /**
   * 从JSON字符串反序列化路径
   * @param {string} jsonString
   * @returns {boolean}
   */
  deserializePath(jsonString) {
    try {
      const pathData = JSON.parse(jsonString);
      return this.setPath(pathData);
    } catch (error) {
      this.emit('onFlightError', { error: '路径反序列化失败: ' + error.message });
      return false;
    }
  }

  /**
   * 获取飞行历史
   * @returns {Array}
   */
  getFlightHistory() {
    return this.pathHistory;
  }

  /**
   * 清空飞行历史
   */
  clearHistory() {
    this.pathHistory = [];
  }

  /**
   * 添加事件监听
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   */
  on(eventName, callback) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].push(callback);
    }
  }

  /**
   * 移除事件监听
   * @param {string} eventName
   * @param {Function} callback
   */
  off(eventName, callback) {
    if (this.listeners[eventName]) {
      this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback);
    }
  }

  /**
   * 触发事件
   * @private
   */
  emit(eventName, data) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件 ${eventName} 的回调执行失败:`, error);
        }
      });
    }
  }

  /**
   * 延迟函数（毫秒）
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FlightPathManager;
}
