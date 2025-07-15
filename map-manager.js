// 地图管理器 - 负责2D平面地图和3D视图切换
class MapManager {
  constructor() {
    this.map = null;
    this.droneMarker = null;
    this.stationMarkers = [];
    this.isMapMode = false;
    this.mapContainer = null;
    this.dronePosition = { x: -850, y: -30, z: 62 };
    this.campusCenter = [39.9042, 116.4074]; // 默认坐标（可调整为实际校园坐标）
    this.campusZoom = 16;
  }

  initialize() {
    console.log('初始化地图管理器...');
    this.createMapContainer();
    this.setupMapControls();
    this.initializeLeafletMap();
    console.log('地图管理器初始化完成');
  }

  createMapContainer() {
    const videoContainer = document.querySelector('.video-container');
    
    // 创建地图容器
    this.mapContainer = document.createElement('div');
    this.mapContainer.id = 'campus-map';
    this.mapContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #1a1a2e;
      display: none;
      z-index: 5;
    `;
    
    videoContainer.appendChild(this.mapContainer);
  }

  setupMapControls() {
    // 添加地图/3D切换按钮
    const videoContainer = document.querySelector('.video-container');
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'map-controls';
    controlsContainer.style.cssText = `
      position: absolute;
      top: 15px;
      left: 15px;
      z-index: 15;
      display: flex;
      gap: 10px;
    `;

    const map2DBtn = document.createElement('button');
    map2DBtn.id = 'map-2d-btn';
    map2DBtn.textContent = '🗺️ 平面地图';
    map2DBtn.className = 'map-control-btn';
    map2DBtn.style.cssText = `
      padding: 8px 15px;
      background: rgba(0, 255, 255, 0.1);
      border: 1px solid #00ffff;
      color: #00ffff;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
    `;

    const map3DBtn = document.createElement('button');
    map3DBtn.id = 'map-3d-btn';
    map3DBtn.textContent = '🎥 3D场景';
    map3DBtn.className = 'map-control-btn active';
    map3DBtn.style.cssText = map2DBtn.style.cssText;

    // 设置初始状态
    this.updateButtonStates(map3DBtn, map2DBtn);

    controlsContainer.appendChild(map2DBtn);
    controlsContainer.appendChild(map3DBtn);
    videoContainer.appendChild(controlsContainer);

    // 绑定事件
    map2DBtn.addEventListener('click', () => this.switchToMapView(map2DBtn, map3DBtn));
    map3DBtn.addEventListener('click', () => this.switchTo3DView(map3DBtn, map2DBtn));
  }

  initializeLeafletMap() {
    // 使用CDN加载Leaflet
    if (!window.L) {
      this.loadLeafletLibrary(() => {
        this.createMap();
      });
    } else {
      this.createMap();
    }
  }

  loadLeafletLibrary(callback) {
    // 加载Leaflet CSS
    const leafletCSS = document.createElement('link');
    leafletCSS.rel = 'stylesheet';
    leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(leafletCSS);

    // 加载Leaflet JS
    const leafletJS = document.createElement('script');
    leafletJS.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    leafletJS.onload = callback;
    document.head.appendChild(leafletJS);
  }

  createMap() {
    // 初始化Leaflet地图
    this.map = L.map('campus-map', {
      center: this.campusCenter,
      zoom: this.campusZoom,
      minZoom: 14,
      maxZoom: 20,
      zoomControl: true,
      attributionControl: false
    });

    // 添加地图图层（使用OpenStreetMap作为基础层）
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    // 添加校园边界
    this.addCampusBoundary();
    
    // 添加建筑物标记
    this.addBuildingMarkers();
    
    // 添加无人机标记
    this.addDroneMarker();

    console.log('Leaflet地图创建完成');
  }

  addCampusBoundary() {
    // 校园边界（示例坐标，实际使用时需要替换为真实校园坐标）
    const campusBounds = [
      [39.9000, 116.4000],
      [39.9000, 116.4100],
      [39.9080, 116.4100],
      [39.9080, 116.4000]
    ];

    L.polygon(campusBounds, {
      color: '#00ffff',
      weight: 2,
      opacity: 0.8,
      fillColor: '#00ffff',
      fillOpacity: 0.1
    }).addTo(this.map).bindPopup('校园区域');
  }

  addBuildingMarkers() {
    const buildings = [
      { name: '图书馆', coord: [39.9030, 116.4050], type: 'library' },
      { name: '宿舍区', coord: [39.9020, 116.4070], type: 'dormitory' },
      { name: '食堂', coord: [39.9040, 116.4060], type: 'cafeteria' },
      { name: '实验楼', coord: [39.9050, 116.4040], type: 'lab' },
      { name: '体育场', coord: [39.9035, 116.4080], type: 'stadium' },
      { name: '仓库', coord: [39.9042, 116.4074], type: 'warehouse' }
    ];

    buildings.forEach(building => {
      const icon = this.getBuildingIcon(building.type);
      L.marker(building.coord, { icon })
        .addTo(this.map)
        .bindPopup(`<b>${building.name}</b><br/>点击设置为目标点`)
        .on('click', () => this.setTargetLocation(building));
    });
  }

  getBuildingIcon(type) {
    const iconMap = {
      library: '📚',
      dormitory: '🏠',
      cafeteria: '🍽️',
      lab: '🔬',
      stadium: '🏟️',
      warehouse: '📦'
    };

    return L.divIcon({
      html: `<div style="background: rgba(0,255,255,0.2); border: 2px solid #00ffff; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px;">${iconMap[type] || '🏢'}</div>`,
      className: 'building-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  }

  addDroneMarker() {
    // 将UE坐标转换为地图坐标（简化转换，实际需要根据真实坐标系调整）
    const mapCoord = this.ueToMapCoordinates(this.dronePosition.x, this.dronePosition.y);
    
    const droneIcon = L.divIcon({
      html: `<div style="background: #ff0080; border: 2px solid #ffffff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; animation: pulse 2s infinite;">🚁</div>`,
      className: 'drone-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    this.droneMarker = L.marker(mapCoord, { icon: droneIcon })
      .addTo(this.map)
      .bindPopup('无人机当前位置');
  }

  ueToMapCoordinates(ueX, ueY) {
    // 简化的坐标转换（实际项目中需要精确的坐标转换算法）
    const centerLat = this.campusCenter[0];
    const centerLng = this.campusCenter[1];
    
    // 假设1000 UE单位 ≈ 0.01度
    const lat = centerLat + (ueY / 100000);
    const lng = centerLng + (ueX / 100000);
    
    return [lat, lng];
  }

  switchToMapView(map2DBtn, map3DBtn) {
    if (this.isMapMode) return;
    
    console.log('切换到平面地图视图');
    this.isMapMode = true;
    
    // 隐藏3D视图，显示地图
    const iframe = document.getElementById('pixel-streaming-iframe');
    const video = document.getElementById('video');
    const errorPlaceholder = document.getElementById('streaming-error-placeholder');
    const apiPlaceholder = document.getElementById('api-only-placeholder');
    
    if (iframe) iframe.style.display = 'none';
    if (video) video.style.display = 'none';
    if (errorPlaceholder) errorPlaceholder.style.display = 'none';
    if (apiPlaceholder) apiPlaceholder.style.display = 'none';
    
    this.mapContainer.style.display = 'block';
    
    // 刷新地图尺寸
    if (this.map) {
      setTimeout(() => {
        this.map.invalidateSize();
      }, 100);
    }
    
    this.updateButtonStates(map2DBtn, map3DBtn);
    
    // 更新状态显示
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = '平面地图模式';
      statusElement.dataset.status = 'connected';
    }
  }

  switchTo3DView(map3DBtn, map2DBtn) {
    if (!this.isMapMode) return;
    
    console.log('切换到3D场景视图');
    this.isMapMode = false;
    
    // 显示3D视图，隐藏地图
    this.mapContainer.style.display = 'none';
    
    const iframe = document.getElementById('pixel-streaming-iframe');
    const video = document.getElementById('video');
    const errorPlaceholder = document.getElementById('streaming-error-placeholder');
    const apiPlaceholder = document.getElementById('api-only-placeholder');
    
    if (iframe) {
      iframe.style.display = 'block';
    } else if (video) {
      video.style.display = 'block';
    } else if (errorPlaceholder) {
      errorPlaceholder.style.display = 'flex';
    } else if (apiPlaceholder) {
      apiPlaceholder.style.display = 'flex';
    }
    
    this.updateButtonStates(map3DBtn, map2DBtn);
    
    // 恢复原来的状态
    pixelStreamingManager.updateStatus('3D场景模式', 'connected');
  }

  updateButtonStates(activeBtn, inactiveBtn) {
    activeBtn.style.background = 'rgba(0, 255, 255, 0.3)';
    activeBtn.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.5)';
    
    inactiveBtn.style.background = 'rgba(0, 255, 255, 0.1)';
    inactiveBtn.style.boxShadow = 'none';
  }

  setTargetLocation(building) {
    console.log(`设置目标位置: ${building.name}`);
    
    // 这里可以调用UE API设置目标位置
    // 将地图坐标转换回UE坐标
    const ueCoords = this.mapToUECoordinates(building.coord[0], building.coord[1]);
    
    // 调用UE API
    if (window.ueApiManager) {
      ueApiManager.setDroneLocation(ueCoords.x, ueCoords.y, ueCoords.z);
    }
    
    // 在地图上添加目标标记
    if (this.targetMarker) {
      this.map.removeLayer(this.targetMarker);
    }
    
    const targetIcon = L.divIcon({
      html: `<div style="background: #ff0080; border: 2px solid #ffffff; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center;">🎯</div>`,
      className: 'target-marker',
      iconSize: [25, 25],
      iconAnchor: [12, 12]
    });
    
    this.targetMarker = L.marker(building.coord, { icon: targetIcon })
      .addTo(this.map)
      .bindPopup(`目标: ${building.name}`);
  }

  mapToUECoordinates(lat, lng) {
    // 简化的反向坐标转换
    const centerLat = this.campusCenter[0];
    const centerLng = this.campusCenter[1];
    
    const ueX = (lng - centerLng) * 100000;
    const ueY = (lat - centerLat) * 100000;
    
    return { x: ueX, y: ueY, z: 62 }; // 默认高度
  }

  updateDronePosition(x, y, z) {
    this.dronePosition = { x, y, z };
    
    if (this.droneMarker && this.map) {
      const mapCoord = this.ueToMapCoordinates(x, y);
      this.droneMarker.setLatLng(mapCoord);
      
      // 如果在地图模式下，让地图跟随无人机
      if (this.isMapMode) {
        this.map.panTo(mapCoord);
      }
    }
  }

  addStationMarker(station) {
    if (!this.map) return;
    
    const mapCoord = this.ueToMapCoordinates(station.x, station.y);
    const stationIcon = this.getStationIcon(station.type);
    
    const marker = L.marker(mapCoord, { icon: stationIcon })
      .addTo(this.map)
      .bindPopup(`<b>${station.name}</b><br/>类型: ${station.type}<br/>状态: ${station.status}`);
    
    this.stationMarkers.push({ id: station.id, marker });
  }

  getStationIcon(type) {
    const iconMap = {
      charging: '🔋',
      communication: '📡',
      weather: '🌡️',
      security: '🛡️'
    };

    return L.divIcon({
      html: `<div style="background: rgba(255,170,0,0.2); border: 2px solid #ffaa00; border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px;">${iconMap[type] || '📍'}</div>`,
      className: 'station-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  removeStationMarker(stationId) {
    const stationIndex = this.stationMarkers.findIndex(s => s.id === stationId);
    if (stationIndex !== -1) {
      this.map.removeLayer(this.stationMarkers[stationIndex].marker);
      this.stationMarkers.splice(stationIndex, 1);
    }
  }
}

// 创建全局实例
window.mapManager = new MapManager();
