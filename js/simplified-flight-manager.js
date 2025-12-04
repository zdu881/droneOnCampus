/**
 * 简化版无人机飞行控制管理器
 * 仅需选择起点和终点坐标，自动执行飞行
 * 与 CM-ZSB 基站运维检测和灯光控制集成
 */
class SimplifiedDroneFlightManager {
  constructor(apiManager) {
    this.apiManager = apiManager;
    this.isFlying = false;
    this.currentLocation = { x: 0, y: 0, z: 100 };
    
    // 预设位置
    this.presetLocations = {
      warehouse: { label: '仓库', x: 0, y: 0, z: 100 },
      library: { label: '图书馆', x: -850, y: -30, z: 62 },
      dormitory: { label: '宿舍', x: 500, y: 400, z: 80 },
      cafeteria: { label: '食堂', x: -200, y: 300, z: 75 }
    };

    // 事件回调
    this.onFlightStart = null;
    this.onFlightEnd = null;
    this.onFlightError = null;
    this.onStatusUpdate = null;
  }

  /**
   * 从 A 点飞往 B 点
   * @param {Object} startPoint - 起点 {x, y, z}
   * @param {Object} endPoint - 终点 {x, y, z}
   * @returns {Promise<Object>} 飞行结果
   */
  async flyFromTo(startPoint, endPoint) {
    if (this.isFlying) {
      return { success: false, error: '无人机正在飞行中' };
    }

    if (!this._validatePoint(startPoint) || !this._validatePoint(endPoint)) {
      return { success: false, error: '无效的坐标' };
    }

    this.isFlying = true;
    this._updateStatus(`开始飞行：(${startPoint.x}, ${startPoint.y}, ${startPoint.z}) → (${endPoint.x}, ${endPoint.y}, ${endPoint.z})`);
    this.onFlightStart?.(startPoint, endPoint);

    try {
      // 设置起点
      console.log('设置起点位置...');
      let result = await this.apiManager.setDroneLocation(startPoint.x, startPoint.y, startPoint.z);
      if (!result.success) {
        throw new Error('设置起点失败: ' + (result.error || '未知错误'));
      }

      // 等待 1 秒
      await this._sleep(1000);

      // 设置终点
      console.log('设置终点位置...');
      result = await this.apiManager.setDroneLocation(endPoint.x, endPoint.y, endPoint.z);
      if (!result.success) {
        throw new Error('设置终点失败: ' + (result.error || '未知错误'));
      }

      // 执行飞行
      console.log('执行飞行...');
      result = await this.apiManager.triggerDroneAction();
      if (!result.success) {
        throw new Error('执行飞行失败: ' + (result.error || '未知错误'));
      }

      this.currentLocation = { ...endPoint };
      this._updateStatus(`飞行完成！当前位置：(${endPoint.x}, ${endPoint.y}, ${endPoint.z})`);
      this.onFlightEnd?.(endPoint);

      return {
        success: true,
        message: '飞行完成',
        startPoint,
        endPoint,
        currentLocation: this.currentLocation
      };

    } catch (error) {
      const errorMsg = error.message;
      console.error('飞行过程中出错:', errorMsg);
      this._updateStatus(`飞行错误：${errorMsg}`);
      this.onFlightError?.(errorMsg);
      return { success: false, error: errorMsg };

    } finally {
      this.isFlying = false;
    }
  }

  /**
   * 从预设位置 A 飞往预设位置 B
   * @param {string} fromKey - 起点的预设位置键
   * @param {string} toKey - 终点的预设位置键
   * @returns {Promise<Object>}
   */
  async flyBetweenPresets(fromKey, toKey) {
    const from = this.presetLocations[fromKey];
    const to = this.presetLocations[toKey];

    if (!from || !to) {
      return { success: false, error: '无效的预设位置' };
    }

    console.log(`开始飞行：${from.label} → ${to.label}`);
    return await this.flyFromTo(from, to);
  }

  /**
   * 获取所有预设位置
   * @returns {Object}
   */
  getPresetLocations() {
    return this.presetLocations;
  }

  /**
   * 验证坐标
   * @private
   */
  _validatePoint(point) {
    return point && 
           typeof point.x === 'number' &&
           typeof point.y === 'number' &&
           typeof point.z === 'number';
  }

  /**
   * 延迟函数
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 更新状态
   * @private
   */
  _updateStatus(message) {
    console.log(`[飞行状态] ${message}`);
    this.onStatusUpdate?.(message);
  }

  /**
   * 获取当前位置
   */
  getCurrentLocation() {
    return this.currentLocation;
  }

  /**
   * 获取飞行状态
   */
  isCurrentlyFlying() {
    return this.isFlying;
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimplifiedDroneFlightManager;
}
