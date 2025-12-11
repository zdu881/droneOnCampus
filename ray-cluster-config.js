// CastRay 后端服务配置
const CASTRAY_CONFIG = {
    // CastRay 内嵌服务地址（端口 28823）
    API_BASE: 'http://10.30.2.11:28823',
    
    // WebSocket 连接地址
    WS_URL: 'ws://10.30.2.11:28823/ws',
    
    // API 端点
    ENDPOINTS: {
        STATUS: '/api/status',
        NODES: '/api/nodes',
        SEND_MESSAGE: '/api/send',
        FILE_TRANSFERS: '/api/file-transfers/status',
        UPLOAD: '/api/upload'
    },
    
    // 更新间隔 (毫秒)
    UPDATE_INTERVAL: 3000,
    
    // 是否启用调试模式
    DEBUG: true
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CASTRAY_CONFIG;
}
