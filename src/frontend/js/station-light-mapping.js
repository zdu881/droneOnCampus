/**
 * CM-ZSB 节点检测与灯光状态映射管理器
 * 实现自动驾驶场景中的基站状态检测和灯光控制联动
 */
class StationLightMappingManager {
  constructor(dashboardManager) {
    this.dashboardManager = dashboardManager;
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.monitoringIntervalMs = 3000; // 检测间隔（毫秒）
    this.nodes = [];
    this.statusCache = {};
    this.lightStatusMap = new Map(); // 节点状态 -> 灯光颜色映射

    this._initStatusToColorMap();
  }

  /**
   * 初始化状态到灯光颜色的映射
   * @private
   */
  _initStatusToColorMap() {
    // 灯光颜色代码: 0=红色, 1=绿色, 2=黄色
    this.statusToColorMap = {
      'idle': 1,        // 绿色 - 正常/空闲
      'detecting': 2,   // 黄色 - 检测进行中
      'sending': 2,     // 黄色 - 发送数据中
      'error': 0,       // 红色 - 错误状态
      'offline': 0,     // 红色 - 离线
      'ready': 1,       // 绿色 - 就绪
      'busy': 2,        // 黄色 - 忙碌
      'processing': 2   // 黄色 - 处理中
    };
  }

  /**
   * 初始化节点配置
   * @param {Array} nodes - 节点配置数组
   * 示例: [
   *   { nodeId: 'node-1', lightIndex: 1, checkUrl: 'http://10.30.2.11:8000/health' },
   *   { nodeId: 'node-2', lightIndex: 2, checkUrl: 'http://10.30.2.12:8000/health' },
   *   { nodeId: 'node-3', lightIndex: 3, checkUrl: 'http://10.30.2.13:8000/health' }
   * ]
   */
  initializeNodes(nodes) {
    this.nodes = nodes;
    nodes.forEach(node => {
      this.statusCache[node.nodeId] = {
        status: 'unknown',
        lastCheck: null,
        lightColor: null,
        cpuUsage: 0,
        memoryUsage: 0,
        error: null
      };
    });
    this.dashboardManager?.logToConsole(`已初始化 ${nodes.length} 个检测节点`, 'info');
  }

  /**
   * 开始后台监控（持续检测节点状态）
   * @param {number} intervalMs - 检测间隔（毫秒），默认3000
   */
  startMonitoring(intervalMs = 3000) {
    if (this.isMonitoring) {
      this.dashboardManager?.logToConsole('节点监控已在运行', 'warning');
      return;
    }

    this.monitoringIntervalMs = intervalMs;
    this.isMonitoring = true;

    // 立即执行一次
    this._performMonitoringCycle();

    // 定期执行
    this.monitoringInterval = setInterval(() => {
      if (this.isMonitoring) {
        this._performMonitoringCycle();
      }
    }, this.monitoringIntervalMs);

    this.dashboardManager?.logToConsole(`节点监控已启动（检测间隔: ${intervalMs}ms）`, 'success');
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    this.dashboardManager?.logToConsole('节点监控已停止', 'info');
  }

  /**
   * 执行一个监控周期
   * @private
   */
  async _performMonitoringCycle() {
    const checkPromises = this.nodes.map(node => this._checkNodeStatus(node));
    
    try {
      await Promise.all(checkPromises);
      this._updateLightsBasedOnStatus();
    } catch (error) {
      this.dashboardManager?.logToConsole(`监控周期执行出错: ${error.message}`, 'error');
    }
  }

  /**
   * 检查单个节点的状态
   * @private
   */
  async _checkNodeStatus(node) {
    try {
      const response = await fetch(node.checkUrl, {
        method: 'GET',
        timeout: 2000 // 2秒超时
      });

      const cache = this.statusCache[node.nodeId] || {};

      if (response.ok) {
        try {
          const data = await response.json();
          
          // 根据响应数据更新状态
          let status = 'ready';
          
          // 尝试从响应中提取状态信息
          if (data.status) {
            status = data.status.toLowerCase();
          } else if (data.detecting) {
            status = 'detecting';
          } else if (data.processing) {
            status = 'processing';
          }

          // 提取资源使用情况
          const cpuUsage = data.cpu_usage || data.cpuUsage || 0;
          const memoryUsage = data.memory_usage || data.memoryUsage || 0;

          // 更新缓存
          this.statusCache[node.nodeId] = {
            status: status,
            lastCheck: new Date(),
            lightColor: this.statusToColorMap[status] || 1,
            cpuUsage: cpuUsage,
            memoryUsage: memoryUsage,
            error: null
          };

          this.dashboardManager?.logToConsole(
            `节点 ${node.nodeId}: ${status} (CPU: ${cpuUsage.toFixed(1)}%, Mem: ${memoryUsage.toFixed(1)}%)`,
            'debug'
          );
        } catch (parseError) {
          // 响应不是有效的JSON，但连接成功，状态为就绪
          this.statusCache[node.nodeId] = {
            status: 'ready',
            lastCheck: new Date(),
            lightColor: 1, // 绿色
            cpuUsage: 0,
            memoryUsage: 0,
            error: null
          };
        }
      } else {
        // HTTP 错误
        this.statusCache[node.nodeId] = {
          status: 'error',
          lastCheck: new Date(),
          lightColor: 0, // 红色
          cpuUsage: 0,
          memoryUsage: 0,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      // 网络错误或超时
      this.statusCache[node.nodeId] = {
        status: 'offline',
        lastCheck: new Date(),
        lightColor: 0, // 红色
        cpuUsage: 0,
        memoryUsage: 0,
        error: error.message
      };

      this.dashboardManager?.logToConsole(
        `节点 ${node.nodeId} 检测失败: ${error.message}`,
        'warning'
      );
    }
  }

  /**
   * 根据节点状态更新灯光颜色
   * @private
   */
  async _updateLightsBasedOnStatus() {
    if (!window.ueApiManager) {
      this.dashboardManager?.logToConsole('UE API 管理器未就绪', 'warning');
      return;
    }

    // 为每个节点改变对应的灯光
    for (const node of this.nodes) {
      const cache = this.statusCache[node.nodeId];
      if (!cache) continue;

      const colorCode = cache.lightColor;
      const lightIndex = node.lightIndex;

      try {
        const result = await window.ueApiManager.changeBaseStationLight(
          lightIndex,
          colorCode
        );

        if (!result.success) {
          this.dashboardManager?.logToConsole(
            `更新灯光 ${lightIndex} 失败: ${result.error}`,
            'warning'
          );
        }
      } catch (error) {
        this.dashboardManager?.logToConsole(
          `灯光控制异常 (${lightIndex}): ${error.message}`,
          'error'
        );
      }
    }
  }

  /**
   * 手动检查单个节点状态（不影响灯光自动更新）
   * @param {string} nodeId - 节点 ID
   * @returns {Promise<Object>} 节点状态信息
   */
  async checkSingleNodeStatus(nodeId) {
    const node = this.nodes.find(n => n.nodeId === nodeId);
    if (!node) {
      return { success: false, error: '节点不存在' };
    }

    await this._checkNodeStatus(node);
    return this.statusCache[nodeId];
  }

  /**
   * 手动更新单个节点的灯光
   * @param {string} nodeId - 节点 ID
   * @returns {Promise<Object>}
   */
  async updateSingleLight(nodeId) {
    const node = this.nodes.find(n => n.nodeId === nodeId);
    if (!node) {
      return { success: false, error: '节点不存在' };
    }

    if (!window.ueApiManager) {
      return { success: false, error: 'UE API 管理器未就绪' };
    }

    const cache = this.statusCache[nodeId];
    if (!cache) {
      return { success: false, error: '节点状态未知' };
    }

    try {
      const result = await window.ueApiManager.changeBaseStationLight(
        node.lightIndex,
        cache.lightColor
      );

      if (result.success) {
        this.dashboardManager?.logToConsole(
          `灯光 ${node.lightIndex} 已更新 (${cache.status})`,
          'success'
        );
      }

      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 强制设置节点状态（用于测试）
   * @param {string} nodeId
   * @param {string} status
   */
  forceSetStatus(nodeId, status) {
    if (this.statusCache[nodeId]) {
      this.statusCache[nodeId].status = status;
      this.statusCache[nodeId].lightColor = this.statusToColorMap[status] || 1;
      this.dashboardManager?.logToConsole(`已强制设置节点 ${nodeId} 状态为: ${status}`, 'warning');
    }
  }

  /**
   * 获取所有节点的当前状态
   * @returns {Object}
   */
  getAllNodeStatus() {
    const statuses = {};
    for (const node of this.nodes) {
      statuses[node.nodeId] = this.statusCache[node.nodeId] || {
        status: 'unknown',
        error: '未检测'
      };
    }
    return statuses;
  }

  /**
   * 获取节点状态的简要文本描述
   * @param {string} nodeId
   * @returns {string}
   */
  getNodeStatusDescription(nodeId) {
    const cache = this.statusCache[nodeId];
    if (!cache) return '未检测';

    const statusText = {
      'idle': '✓ 就绪',
      'ready': '✓ 就绪',
      'detecting': '◆ 检测中',
      'sending': '◆ 发送中',
      'processing': '◆ 处理中',
      'busy': '◆ 忙碌',
      'error': '✗ 错误',
      'offline': '✗ 离线',
      'unknown': '? 未知'
    };

    let desc = statusText[cache.status] || `? ${cache.status}`;

    if (cache.cpuUsage > 0 || cache.memoryUsage > 0) {
      desc += ` (CPU: ${cache.cpuUsage.toFixed(0)}%, Mem: ${cache.memoryUsage.toFixed(0)}%)`;
    }

    if (cache.error) {
      desc += ` - ${cache.error}`;
    }

    return desc;
  }

  /**
   * 更新监控间隔
   * @param {number} intervalMs - 新的间隔时间（毫秒）
   */
  setMonitoringInterval(intervalMs) {
    this.monitoringIntervalMs = intervalMs;
    
    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring(intervalMs);
    }
  }

  /**
   * 添加自定义状态到灯光的映射规则
   * @param {string} status - 状态名称
   * @param {number} colorCode - 灯光颜色代码 (0=红, 1=绿, 2=黄)
   */
  addStatusColorMapping(status, colorCode) {
    this.statusToColorMap[status.toLowerCase()] = colorCode;
    this.dashboardManager?.logToConsole(`已添加状态映射: ${status} -> ${colorCode}`, 'debug');
  }

  /**
   * 获取灯光颜色对应的名称
   * @param {number} colorCode
   * @returns {string}
   */
  getColorName(colorCode) {
    const colorNames = {
      0: '红色',
      1: '绿色',
      2: '黄色'
    };
    return colorNames[colorCode] || '未知';
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.stopMonitoring();
    this.nodes = [];
    this.statusCache = {};
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StationLightMappingManager;
}
