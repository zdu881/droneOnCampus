// Simple user manager for node ownership and file-transfer animation
class UserManager {
    constructor() {
        this.users = new Map(); // userId -> {id,name,color,nodes:Set}
        this.nodeToUser = new Map(); // nodeId -> userId
        this.transferLogEl = null;
        // load from localStorage if available
        this.load();
        // default users
        if (this.users.size === 0) {
            this.createUser('alice', 'Alice', '#3b82f6');
            this.createUser('bob', 'Bob', '#10b981');
            this.createUser('carol', 'Carol', '#f59e0b');
        }
        // render panel if DOM ready
        document.addEventListener('DOMContentLoaded', () => this.renderPanel());
    }

    save() {
        try {
            const data = {
                users: Array.from(this.users.entries()).map(([id,u])=>({id,name:u.name,color:u.color,nodes:Array.from(u.nodes)})),
                nodeToUser: Array.from(this.nodeToUser.entries())
            };
            localStorage.setItem('userManager_v1', JSON.stringify(data));
        } catch(e){console.warn('save userManager',e)}
    }

    load() {
        try {
            const raw = localStorage.getItem('userManager_v1');
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data && data.users) {
                data.users.forEach(u=>{
                    this.users.set(u.id, {id:u.id, name:u.name, color:u.color, nodes:new Set(u.nodes||[]) });
                    (u.nodes||[]).forEach(n=> this.nodeToUser.set(n, u.id));
                });
            }
        } catch(e){console.warn('load userManager',e)}
    }

    createUser(id, name, color) {
        if (this.users.has(id)) return;
        this.users.set(id, {id,name,color,nodes:new Set()});
        this.save();
        this.renderPanel();
    }

    deleteUser(id) {
        const u = this.users.get(id);
        if (!u) return;
        // unassign nodes
        u.nodes.forEach(n=> this.nodeToUser.delete(n));
        this.users.delete(id);
        this.save();
        this.renderPanel();
    }

    assignNodeToUser(nodeId, userId) {
        // remove from previous owner
        const prev = this.nodeToUser.get(nodeId);
        if (prev) {
            const pu = this.users.get(prev);
            if (pu) pu.nodes.delete(nodeId);
        }
        this.nodeToUser.set(nodeId, userId);
        const u = this.users.get(userId);
        if (u) u.nodes.add(nodeId);
        this.save();
        this.updateNodeOwnerBadge(nodeId);
        this.renderPanel();
    }

    unassignNode(nodeId) {
        const prev = this.nodeToUser.get(nodeId);
        if (!prev) return;
        const pu = this.users.get(prev);
        if (pu) pu.nodes.delete(nodeId);
        this.nodeToUser.delete(nodeId);
        this.save();
        this.updateNodeOwnerBadge(nodeId);
        this.renderPanel();
    }

    getUserForNode(nodeId) { return this.nodeToUser.get(nodeId) || null; }

    // UI: render the user panel with lists and node counts
    renderPanel() {
        const panel = document.getElementById('userPanel');
        if (!panel) return;
        panel.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'user-panel-header';
        header.innerHTML = `
            <strong>用户与节点分配</strong>
            <div style="float:right">
                <button id="addUserBtn" class="control-btn">+ 添加用户</button>
            </div>
        `;
        panel.appendChild(header);

        const list = document.createElement('div');
        list.className = 'user-list';
        this.users.forEach(u => {
            const el = document.createElement('div');
            el.className = 'user-entry';
            el.style.borderLeft = `4px solid ${u.color}`;
            el.innerHTML = `<strong>${u.name}</strong> <span style="margin-left:8px;color:#999">(${u.nodes.size} 个节点)</span>`;
            el.onclick = ()=> this.showUserDetail(u.id);
            list.appendChild(el);
        });
        panel.appendChild(list);

        const transfers = document.createElement('div');
        transfers.className = 'user-transfer-controls';
        transfers.style.marginTop='8px';
        transfers.innerHTML = `
            <label>源用户</label>
            <select id="ui_sourceUser"></select>
            <label>目标用户</label>
            <select id="ui_targetUser"></select>
            <button id="ui_startUserTransfer" class="control-btn primary">发起用户间文件传输</button>
            <div id="ui_transferStatus" style="display:inline-block;margin-left:8px;color:#666"></div>
        `;
        panel.appendChild(transfers);

        // create transfer log container
        if (!this.transferLogEl) {
            const logWrap = document.createElement('div');
            logWrap.style.marginTop='8px';
            logWrap.innerHTML = `<h5>传输日志</h5><div id="transferLog" class="log-container" style="max-height:120px;overflow:auto;background:#111;padding:6px;color:#fff;border-radius:6px"></div>`;
            panel.appendChild(logWrap);
            this.transferLogEl = logWrap.querySelector('#transferLog');
        }

        // wire up buttons
        document.getElementById('addUserBtn').onclick = ()=>{
            const id = prompt('输入用户ID(英文小写):'); if (!id) return;
            const name = prompt('输入显示名:', id) || id;
            const color = prompt('输入颜色(HEX):', '#888888') || '#888888';
            this.createUser(id, name, color);
        };

        // populate selects
        const src = document.getElementById('ui_sourceUser');
        const tgt = document.getElementById('ui_targetUser');
        src.innerHTML = ''; tgt.innerHTML = '';
        this.users.forEach(u=>{
            const o1 = document.createElement('option'); o1.value=u.id; o1.text=u.name; src.appendChild(o1);
            const o2 = document.createElement('option'); o2.value=u.id; o2.text=u.name; tgt.appendChild(o2);
        });
        document.getElementById('ui_startUserTransfer').onclick = ()=> this.startUserTransfer();
    }

    showUserDetail(userId) {
        const u = this.users.get(userId);
        if (!u) return;
        const nodes = Array.from(u.nodes);
        alert(`${u.name} (ID:${u.id})\n拥有节点:\n- ${nodes.join('\n- ')}`);
    }

    // called by unified-node-manager when rendering each node card
    attachNodeCard(nodeId, nodeCardEl) {
        // create owner badge area
        let badge = nodeCardEl.querySelector('.owner-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'owner-badge';
            badge.style.cssText = 'position:absolute;right:8px;top:8px;padding:4px 8px;border-radius:12px;background:#222;color:#fff;font-size:12px;';
            nodeCardEl.style.position='relative';
            nodeCardEl.appendChild(badge);
        }

        const ownerId = this.getUserForNode(nodeId);
        if (ownerId) {
            const u = this.users.get(ownerId);
            badge.textContent = u.name;
            badge.style.background = u.color;
        } else {
            badge.textContent = '未分配';
            badge.style.background = '#444';
        }

        // add small assign button
        let btn = nodeCardEl.querySelector('.assign-node-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.className = 'assign-node-btn';
            btn.textContent = '分配';
            btn.style.cssText = 'position:absolute;left:8px;bottom:8px;padding:4px 6px;font-size:12px;';
            nodeCardEl.appendChild(btn);
            btn.onclick = (ev)=>{
                ev.stopPropagation();
                this.showAssignMenu(nodeId, nodeCardEl, btn);
            };
        }
    }

    showAssignMenu(nodeId, nodeCardEl, anchorEl) {
        // simple prompt-based assign for now
        const userIds = Array.from(this.users.keys());
        const pick = prompt('输入分配用户ID:\n' + userIds.join(', '));
        if (!pick) return;
        if (!this.users.has(pick)) { alert('不存在的用户ID'); return; }
        this.assignNodeToUser(nodeId, pick);
    }

    updateNodeOwnerBadge(nodeId) {
        const short = nodeId.substring(0,8);
        const el = document.getElementById(`node-card-${short}`);
        if (!el) return;
        const badge = el.querySelector('.owner-badge');
        const ownerId = this.getUserForNode(nodeId);
        if (ownerId) {
            const u = this.users.get(ownerId);
            if (badge) { badge.textContent = u.name; badge.style.background = u.color; }
        } else {
            if (badge) { badge.textContent = '未分配'; badge.style.background = '#444'; }
        }
    }

    // user-to-user transfer: pick one node from source user and one node from target user (simulate)
    async startUserTransfer() {
        const src = document.getElementById('ui_sourceUser').value;
        const tgt = document.getElementById('ui_targetUser').value;
        if (!src || !tgt || src === tgt) { alert('请选择不同的源/目标用户'); return; }
        const su = this.users.get(src);
        const tu = this.users.get(tgt);
        if (!su || !tu) return;
        if (su.nodes.size === 0) { alert('源用户没有节点可供传输'); return; }
        const srcNode = Array.from(su.nodes)[0];
        // pick target node if exists, otherwise choose null to simulate cross-user transfer
        const tgtNode = tu.nodes.size>0 ? Array.from(tu.nodes)[0] : null;

        // build visual animation between srcNode card and tgtNode card (or a generic area)
        const srcEl = document.getElementById(`node-card-${srcNode.substring(0,8)}`);
        const tgtEl = tgtNode ? document.getElementById(`node-card-${tgtNode.substring(0,8)}`) : null;
        if (!srcEl) { alert('找不到源节点卡片'); return; }

        const statusEl = document.getElementById('ui_transferStatus');
        statusEl.textContent = `正在从 ${su.name} 发往 ${tu.name} ...`;

        // create flying dot
        const fly = document.createElement('div');
        fly.className = 'transfer-dot';
        fly.style.cssText = 'position:fixed;width:12px;height:12px;border-radius:50%;background:#fff;z-index:9999;box-shadow:0 0 8px rgba(0,0,0,0.6)';
        document.body.appendChild(fly);

        // compute start and end
        const sRect = srcEl.getBoundingClientRect();
        let tRect = tgtEl ? tgtEl.getBoundingClientRect() : {left: window.innerWidth - 120, top: sRect.top};
        fly.style.left = (sRect.left + sRect.width/2) + 'px';
        fly.style.top = (sRect.top + sRect.height/2) + 'px';

        // animate using JS (linear)
        const steps = 30;
        for (let i=1;i<=steps;i++){
            await new Promise(r=>setTimeout(r, Math.max(10, 40)));
            const nx = sRect.left + (tRect.left - sRect.left) * (i/steps) + sRect.width/2;
            const ny = sRect.top + (tRect.top - sRect.top) * (i/steps) + sRect.height/2;
            fly.style.left = nx + 'px'; fly.style.top = ny + 'px';
        }

        // complete
        fly.remove();
        statusEl.textContent = `传输完成: ${su.name} -> ${tu.name}`;
        this.appendLog(`${new Date().toLocaleTimeString()} ${su.name} -> ${tu.name} (file)`);

        // optional: transfer effect push: assign node from source to target or keep both
        if (tgtNode) {
            // we simulate a file copy, not ownership change
        }

        // animate end status flash
        if (tgtEl) {
            tgtEl.style.transition = 'box-shadow 0.4s ease';
            tgtEl.style.boxShadow = `0 0 12px ${tu.color}`;
            setTimeout(()=>{ tgtEl.style.boxShadow=''; }, 800);
        }

        // update counters
        const logCountEl = document.getElementById('transferLog');
        if (logCountEl) logCountEl.scrollTop = logCountEl.scrollHeight;
    }

    appendLog(msg) {
        if (!this.transferLogEl) return;
        const el = document.createElement('div'); el.textContent = msg; el.style.padding='2px 0';
        this.transferLogEl.appendChild(el);
    }
}

window.userManager = new UserManager();
