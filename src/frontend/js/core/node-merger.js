/*
 * core/node-merger.js
 * 纯函数：合并 Ray 节点与 CastRay 节点数据，返回序列化结果和 unmatched 列表
 * 设计为在浏览器环境中可直接挂载到 window.nodeMerger
 */
(function(global){
    function mergeNodeData(rayNodes = [], castrayNodes = []) {
        const unifiedMap = new Map();
        const unmatchedRay = [];
        const unmatchedCastRay = [];
        const candidateMap = new Map();

        // 处理 Ray 节点，建立 canonical id 与候选 key 映射
        (rayNodes || []).forEach(rayNode => {
            const canonical = rayNode.nodeId || rayNode.id || null;
            if (!canonical) return;
            const s = String(canonical);
            const candidates = new Set();
            candidates.add(s);
            if (s.length >= 12) candidates.add(s.substring(0,12));
            if (s.length >= 8) candidates.add(s.substring(0,8));
            if (s.length >= 12) candidates.add(s.substring(s.length-12));
            if (s.length >= 8) candidates.add(s.substring(Math.max(0, s.length-8)));
            if (rayNode.id) candidates.add(String(rayNode.id));
            if (rayNode.nodeIp && rayNode.name) candidates.add(`${rayNode.nodeIp}_${rayNode.name}`);

            for (const c of candidates) candidateMap.set(c, s);

            unifiedMap.set(s, {
                rayNodeId: s,
                hostname: rayNode.name || rayNode.fullName || null,
                ip: rayNode.nodeIp || rayNode.ip || null,
                rayData: {
                    id: rayNode.id,
                    name: rayNode.name,
                    fullName: rayNode.fullName,
                    state: rayNode.state || rayNode.node_state || null,
                    isHeadNode: rayNode.isHeadNode || rayNode.is_head_node || false,
                    cpu: rayNode.cpu || rayNode.resources?.CPU || rayNode.resources_total?.CPU || 0,
                    memory: rayNode.memory || rayNode.resources?.memory || rayNode.resources_total?.memory || 0,
                    gpu: rayNode.gpu || rayNode.resources?.GPU || rayNode.resources_total?.GPU || 0,
                    tasks: rayNode.tasks || rayNode.task_list || [] ,
                    status: rayNode.status || (rayNode.state && String(rayNode.state).toLowerCase() === 'alive' ? 'active' : rayNode.status) || null,
                    connectionType: rayNode.connectionType,
                    resources: rayNode.resources || rayNode.resources_total || null
                },
                castrayData: null
            });
        });

        // 处理 CastRay 节点
        (castrayNodes || []).forEach(castrayNode => {
            let rayNodeIdRaw = castrayNode.rayNodeId || castrayNode.ray_node_id || castrayNode.node_id || castrayNode.nodeId || castrayNode.ray_node || null;

            // 尝试通过 ip+name 匹配
            if (!rayNodeIdRaw) {
                const candidateIpName = castrayNode.ip && castrayNode._raw && castrayNode._raw.name ? `${castrayNode.ip}_${castrayNode._raw.name}` : null;
                if (candidateIpName && candidateMap.has(candidateIpName)) rayNodeIdRaw = candidateMap.get(candidateIpName);
            }

            let matchedCanonical = null;
            if (rayNodeIdRaw) {
                if (unifiedMap.has(rayNodeIdRaw)) matchedCanonical = rayNodeIdRaw;
                else if (candidateMap.has(rayNodeIdRaw)) matchedCanonical = candidateMap.get(rayNodeIdRaw);
                else {
                    const r = String(rayNodeIdRaw);
                    const pref12 = r.substring(0, Math.min(12, r.length));
                    const pref8 = r.substring(0, Math.min(8, r.length));
                    const suf12 = r.length >= 12 ? r.substring(r.length-12) : null;
                    const suf8 = r.substring(Math.max(0, r.length-8));
                    if (candidateMap.has(pref12)) matchedCanonical = candidateMap.get(pref12);
                    else if (candidateMap.has(pref8)) matchedCanonical = candidateMap.get(pref8);
                    else if (suf12 && candidateMap.has(suf12)) matchedCanonical = candidateMap.get(suf12);
                    else if (candidateMap.has(suf8)) matchedCanonical = candidateMap.get(suf8);
                }
            }

            if (!matchedCanonical) {
                unmatchedCastRay.push(castrayNode);
                const key = rayNodeIdRaw || (`castray-${Math.random().toString(36).slice(2,8)}`);
                if (!unifiedMap.has(key)) {
                    unifiedMap.set(key, {
                        rayNodeId: key,
                        hostname: castrayNode.hostname || castrayNode._raw?.name || 'Unknown',
                        ip: castrayNode.ip || null,
                        rayData: null,
                        castrayData: {
                            agentId: castrayNode.agentId || castrayNode.agent_id || null,
                            status: castrayNode.status || castrayNode.state || null,
                            bitrate: castrayNode.bitrate || castrayNode.stream_rate || null,
                            streamingState: castrayNode.streamingState || castrayNode.state || null,
                            connections: castrayNode.connections || castrayNode.conn || 0,
                            lastUpdate: castrayNode.lastUpdate || castrayNode.updated_at || null,
                            _raw: castrayNode._raw || castrayNode
                        }
                    });
                }
            } else {
                const existing = unifiedMap.get(matchedCanonical) || { rayNodeId: matchedCanonical, hostname: null, ip: null, rayData: null, castrayData: null };
                existing.castrayData = {
                    agentId: castrayNode.agentId || castrayNode.agent_id || null,
                    status: castrayNode.status || castrayNode.state || null,
                    bitrate: castrayNode.bitrate || castrayNode.stream_rate || null,
                    streamingState: castrayNode.streamingState || castrayNode.state || null,
                    connections: castrayNode.connections || castrayNode.conn || 0,
                    lastUpdate: castrayNode.lastUpdate || castrayNode.updated_at || null,
                    _raw: castrayNode._raw || castrayNode
                };
                unifiedMap.set(matchedCanonical, existing);
            }
        });

        // 查找未被 CastRay 匹配的 Ray 节点
        unifiedMap.forEach(node => {
            if (node.rayData && !node.castrayData) unmatchedRay.push(node);
        });

        return {
            unifiedNodes: Array.from(unifiedMap.values()),
            unmatchedRay,
            unmatchedCastRay
        };
    }

    // 将函数挂到 window 上以便在非 module 项目中引用
    try {
        if (!global.nodeMerger) global.nodeMerger = {};
        global.nodeMerger.mergeNodeData = mergeNodeData;
    } catch (e) {
        // ignore
    }

    // 支持模块系统（如果未来需要）
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { mergeNodeData };
    }
})(typeof window !== 'undefined' ? window : this);
