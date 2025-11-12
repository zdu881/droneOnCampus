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

    // 辅助：更稳健地查找节点卡片元素，兼容 full id / short8 / short12
    findNodeCardElement(nodeId) {
        if (!nodeId) return null;
        // 尝试几种常见的 id 形式
        // 先尝试按 data-full-id 精确匹配
        try {
            const byData = document.querySelector(`[data-full-id="${nodeId}"]`);
            if (byData) return byData;
        } catch (e) { /* ignore selector errors */ }
        const candidates = [];
        const s = String(nodeId);
        candidates.push(`node-card-${s}`);
        if (s.length >= 12) candidates.push(`node-card-${s.substring(0,12)}`);
        if (s.length >= 8) candidates.push(`node-card-${s.substring(0,8)}`);

        for (const cid of candidates) {
            const el = document.getElementById(cid);
            if (el) return el;
        }

        // 最后尝试在页面中查找 id 包含短片段的元素
        const short8 = s.substring(0,8);
        const all = document.querySelectorAll('[id^="node-card-"]');
        for (const el of all) {
            if (el.id && el.id.includes(short8)) return el;
        }

        // 尝试通过卡片文本中查找节点 id (宽松匹配)
        for (const el of all) {
            try {
                if (el.innerText && el.innerText.indexOf(short8) !== -1) return el;
            } catch (e) { /* ignore */ }
        }

        return null;
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
        if (!nodeId) return;
        const el = this.findNodeCardElement(nodeId);
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
        // 更稳健地查找卡片（支持多种 id 形式）
        const srcEl = this.findNodeCardElement(srcNode);
        const tgtEl = tgtNode ? this.findNodeCardElement(tgtNode) : null;
        if (!srcEl) {
            // 诊断信息：在控制台打印 nodeId 与当前页面存在的 node-card id 列表，帮助调试
            console.warn('startUserTransfer: source node card not found', { srcNode });
            const existing = Array.from(document.querySelectorAll('[id^="node-card-"]')).map(e=>e.id);
            console.warn('Existing node-card ids:', existing.slice(0,50));
            alert('找不到源节点卡片 (已在Console打印详细信息)');
            // 额外尝试：基于 unifiedNodeManager 的 keys 做后缀模糊匹配
            try {
                const unified = window.unifiedNodeManager && window.unifiedNodeManager.unifiedNodes ? Array.from(window.unifiedNodeManager.unifiedNodes.keys()) : [];
                const s = String(srcNode);
                const last12 = s.length>=12 ? s.substring(s.length-12) : s;
                const last8 = s.substring(s.length-8);
                const cand12 = unified.filter(k=>k.endsWith(last12));
                const cand8 = unified.filter(k=>k.endsWith(last8));
                const candidates = cand12.length>0 ? cand12 : (cand8.length>0 ? cand8 : []);
                if (candidates.length === 1) {
                    const chosen = candidates[0];
                    console.log('Auto-matched source node to canonical id:', chosen);
                    // update srcNode to canonical id and find element
                    srcNode = chosen;
                    const newEl = this.findNodeCardElement(chosen);
                    if (newEl) {
                        // optionally reassign stored mapping to canonical id
                        if (confirm('检测到本地保存的节点ID与当前节点不一致，是否将该节点归属更新为新的 canonical id？')) {
                            const prevOwner = src; // source user id
                            // reassign in storage: remove old key, add canonical
                            if (this.nodeToUser.has(srcNode) && this.nodeToUser.get(srcNode) === src) {
                                // nothing
                            }
                            // ensure the source user's nodes include canonical id
                            const u = this.users.get(src);
                            if (u) {
                                u.nodes.delete(srcNode); // remove any stale
                                u.nodes.add(chosen);
                                this.nodeToUser.set(chosen, src);
                                this.save();
                            }
                        }
                        // continue with newEl
                        srcEl = newEl;
                    }
                } else if (candidates.length > 1) {
                    // ask user to choose among candidates
                    const listStr = candidates.map((c,i)=>`${i}: ${c}`).join('\n');
                    const pick = prompt(`找到多个可能匹配的节点，请输入序号选择:\n${listStr}`);
                    const idx = parseInt(pick);
                    if (!isNaN(idx) && candidates[idx]) {
                        srcNode = candidates[idx];
                        const newEl = this.findNodeCardElement(srcNode);
                        if (newEl) srcEl = newEl;
                    } else {
                        alert('未选择有效候选，取消传输');
                        return;
                    }
                } else {
                    // 无候选，放弃
                    return;
                }
            } catch (e) {
                console.error('fuzzy match failed', e);
                return;
            }
        }
    // (diagnostic handled above) continue

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
