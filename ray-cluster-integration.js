// CastRay 集成管理器
class CastRayIntegration {
    constructor() {
        this.websocket = null;
        this.apiBase = 'http://localhost:8000';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.init();
    }

    init() {
        this.setupControlPanel();
        this.connectWebSocket();
    }

    setupControlPanel() {
        // 添加控制面板
        const header = document.querySelector('header');
        const controlPanel = document.createElement('div');
        controlPanel.className = 'castray-controls';
        controlPanel.innerHTML = `
            <div class="control-group">
                <button id="createNodeBtn">创建节点</button>
                <button id="sendMessageBtn">发送消息</button>
                <button id="fileTransferBtn">文件传输</button>
                <button id="toggleAutoTransfer">切换自动传输</button>
            </div>
            <div class="status-indicators">
                <span id="wsStatus" class="status-indicator">WebSocket: 断开</span>
                <span id="apiStatus" class="status-indicator">API: 未知</span>
            </div>
        `;
        header.appendChild(controlPanel);

        // 绑定事件
        this.bindControlEvents();
    }

    bindControlEvents() {
        document.getElementById('createNodeBtn').addEventListener('click', () => {
            this.createNode();
        });

        document.getElementById('sendMessageBtn').addEventListener('click', () => {
            this.showSendMessageDialog();
        });

        document.getElementById('fileTransferBtn').addEventListener('click', () => {
            this.showFileTransferDialog();
        });

        document.getElementById('toggleAutoTransfer').addEventListener('click', () => {
            this.toggleAutoTransfer();
        });
    }

    connectWebSocket() {
        try {
            this.websocket = new WebSocket('ws://localhost:8000/ws');
            
            this.websocket.onopen = () => {
                console.log('CastRay WebSocket 连接已建立');
                document.getElementById('wsStatus').textContent = 'WebSocket: 已连接';
                document.getElementById('wsStatus').className = 'status-indicator connected';
                this.reconnectAttempts = 0;
            };

            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (e) {
                    console.error('解析 WebSocket 消息失败:', e);
                }
            };

            this.websocket.onclose = () => {
                console.log('CastRay WebSocket 连接已关闭');
                document.getElementById('wsStatus').textContent = 'WebSocket: 断开';
                document.getElementById('wsStatus').className = 'status-indicator disconnected';
                this.scheduleReconnect();
            };

            this.websocket.onerror = (error) => {
                console.error('CastRay WebSocket 错误:', error);
            };
        } catch (error) {
            console.error('创建 WebSocket 连接失败:', error);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                console.log(`尝试重新连接 WebSocket (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                this.reconnectAttempts++;
                this.connectWebSocket();
            }, 5000);
        }
    }

    handleWebSocketMessage(data) {
        console.log('收到 CastRay 消息:', data);
        
        // 在界面上显示实时消息
        this.showNotification(data);
        
        // 根据消息类型更新相应的界面元素
        if (data.type === 'node_created') {
            this.showNotification(`节点已创建: ${data.node_id}`, 'success');
        } else if (data.type === 'message_sent') {
            this.showNotification(`消息已发送: ${data.message_id}`, 'info');
        } else if (data.type === 'file_transfer') {
            this.showNotification(`文件传输: ${data.status}`, 'info');
        }
    }

    async createNode() {
        try {
            const nodeId = `node_${Date.now()}`;
            const response = await fetch(`${this.apiBase}/api/nodes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ node_id: nodeId })
            });

            if (response.ok) {
                const result = await response.json();
                this.showNotification(`节点创建成功: ${nodeId}`, 'success');
            } else {
                throw new Error(`创建节点失败: ${response.status}`);
            }
        } catch (error) {
            console.error('创建节点失败:', error);
            this.showNotification(`创建节点失败: ${error.message}`, 'error');
        }
    }

    showSendMessageDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'modal-dialog';
        dialog.innerHTML = `
            <div class="modal-content">
                <h3>发送消息</h3>
                <form id="sendMessageForm">
                    <label>目标节点:</label>
                    <input type="text" id="targetNode" placeholder="节点ID" required>
                    
                    <label>消息类型:</label>
                    <select id="messageType">
                        <option value="text">文本消息</option>
                        <option value="command">命令</option>
                        <option value="data">数据</option>
                    </select>
                    
                    <label>消息内容:</label>
                    <textarea id="messageContent" placeholder="输入消息内容" required></textarea>
                    
                    <div class="dialog-buttons">
                        <button type="submit">发送</button>
                        <button type="button" onclick="this.closest('.modal-dialog').remove()">取消</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        document.getElementById('sendMessageForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.sendMessage(
                document.getElementById('targetNode').value,
                document.getElementById('messageType').value,
                document.getElementById('messageContent').value
            );
            dialog.remove();
        });
    }

    async sendMessage(targetNode, messageType, content) {
        try {
            const response = await fetch(`${this.apiBase}/api/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    target_node: targetNode,
                    message_type: messageType,
                    content: content
                })
            });

            if (response.ok) {
                this.showNotification('消息发送成功', 'success');
            } else {
                throw new Error(`发送消息失败: ${response.status}`);
            }
        } catch (error) {
            console.error('发送消息失败:', error);
            this.showNotification(`发送消息失败: ${error.message}`, 'error');
        }
    }

    showFileTransferDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'modal-dialog';
        dialog.innerHTML = `
            <div class="modal-content">
                <h3>文件传输</h3>
                <form id="fileTransferForm">
                    <label>选择文件:</label>
                    <input type="file" id="fileInput" required>
                    
                    <label>目标节点:</label>
                    <input type="text" id="targetFileNode" placeholder="节点ID">
                    
                    <div class="dialog-buttons">
                        <button type="submit">上传</button>
                        <button type="button" onclick="this.closest('.modal-dialog').remove()">取消</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        document.getElementById('fileTransferForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.uploadFile();
            dialog.remove();
        });
    }

    async uploadFile() {
        try {
            const fileInput = document.getElementById('fileInput');
            const file = fileInput.files[0];
            const targetNode = document.getElementById('targetFileNode').value;

            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);
            if (targetNode) {
                formData.append('target_node', targetNode);
            }

            const response = await fetch(`${this.apiBase}/api/upload`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                this.showNotification('文件上传成功', 'success');
            } else {
                throw new Error(`文件上传失败: ${response.status}`);
            }
        } catch (error) {
            console.error('文件上传失败:', error);
            this.showNotification(`文件上传失败: ${error.message}`, 'error');
        }
    }

    async toggleAutoTransfer() {
        try {
            const response = await fetch(`${this.apiBase}/api/file-transfers/auto/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                this.showNotification(`自动传输已${result.enabled ? '启用' : '禁用'}`, 'info');
            } else {
                throw new Error(`切换自动传输失败: ${response.status}`);
            }
        } catch (error) {
            console.error('切换自动传输失败:', error);
            this.showNotification(`切换自动传输失败: ${error.message}`, 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.castrayIntegration = new CastRayIntegration();
});
