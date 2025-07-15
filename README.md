# Campus Drone Delivery Visualization - Enhanced Frontend

This is an enhanced web frontend for comprehensive drone campus management, featuring map visualization, camera presets, station management, and task control using Unreal Engine Pixel Streaming technology and Web Remote Control API.

## Project Structure

```
droneOnCampus/
├── index.html           # Main HTML file with UI structure
├── styles.css          # Enhanced CSS styling for sci-fi interface
├── pixel-streaming.js   # Pixel Streaming iframe integration
├── api-manager.js       # Enhanced UE Web Remote Control API manager
├── map-manager.js       # 2D/3D map switching and visualization
├── camera-presets.js    # Multiple camera preset management
├── station-manager.js   # Base station equipment management
├── task-manager.js      # Task creation, execution and monitoring
└── app.js              # Enhanced application logic and integration
```

## Enhanced Features

### 🗺️ **Map Management**
- **2D/3D View Switching**: Toggle between flat campus map and 3D scene
- **Interactive Campus Map**: Built with Leaflet.js for responsive navigation
- **Real-time Drone Tracking**: Live position updates on both map and 3D views
- **Building Markers**: Pre-marked campus locations (Library, Dormitory, Cafeteria, etc.)
- **Click-to-Navigate**: Set drone target by clicking map locations

### 📹 **Camera Preset System**
- **Multiple Preset Positions**: 6 pre-configured camera angles
  - 🚪 Main Gate View
  - 📚 Library Overview 
  - 🏠 Dormitory Zone
  - 🍽️ Cafeteria Plaza
  - 🔬 Lab Building Top
  - 🏟️ Stadium Panorama
- **Follow Mode**: Dynamic drone-following camera
- **One-Click Switching**: Instant preset activation
- **Visual Feedback**: Active preset indication

### 🏗️ **Station Management**
- **Multiple Station Types**:
  - 🔋 **Charging Stations**: Drone power and docking
  - 📡 **Communication Hubs**: Signal relay and data transmission
  - 🌡️ **Weather Stations**: Environmental monitoring
  - 🛡️ **Security Stations**: Surveillance and alerts
- **Interactive Addition**: Modal-based station creation
- **Real-time Status**: Online/offline monitoring
- **Map Integration**: Station markers on campus map

### 📋 **Advanced Task Management**
- **Task Types**:
  - 📦 **Delivery Missions**: Package transport with route planning
  - 🔍 **Patrol Tasks**: Security and facility inspection
  - 📊 **Data Collection**: Environmental monitoring and analytics
- **Task Creation Wizard**: Comprehensive task configuration
- **Quick Task Buttons**: Pre-configured common operations
- **Progress Tracking**: Real-time task execution monitoring
- **Task Queue**: Automatic sequential task execution

### 🎨 **Enhanced User Interface**
- **Sci-Fi Theme**: Cyberpunk-inspired visual design
- **Real-time Data Overlays**: Live telemetry and mission status
- **Responsive Layout**: Multi-panel control interface
- **Status Notifications**: Success/error feedback system
- **Debug Controls**: Developer tools and testing functions

## Setup Instructions

1. **Prerequisites**:

   - Modern web browser (Chrome, Firefox, Edge)
   - Python 3.x (for local testing)
   - Unreal Engine with Pixel Streaming server running on port 80
   - UE Web Remote Control API enabled (port 30010)

2. **Installation**:

   ```bash
   git clone [repository-url]
   cd droneOnCampus
   ```

3. **Running the Frontend**:
   ```bash
   python -m http.server 8000
   ```
   Then open http://localhost:8000 in your browser.

## Configuration

### Pixel Streaming Connection (iframe 模式)

Edit `pixel-streaming.js` to change the streaming server URL:

```javascript
// Change this line to match your UE Pixel Streaming server
initialize((streamerUrl = "http://10.30.2.11:80"));
```

The frontend now uses iframe embedding instead of loading external libraries:

- More reliable connection
- No CDN dependencies
- Automatic fallback to API-only mode

### UE Web Remote Control API

Edit `api-manager.js` to update runtime paths and locations:

```javascript
// 更新无人机actor运行时路径 (与(1).py文件保持一致)
this.droneActorPath = "/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_0";

// 更新关卡脚本actor路径
this.levelScriptActorPath =
  "/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_0";

// Add/modify delivery locations
this.locations = {
  Warehouse: { x: 0, y: 0, z: 100 },
  Library: { x: -850, y: -30, z: 62 },
  // Add more locations...
};
```

### Delivery Locations

Edit `index.html` to add/remove delivery locations:

```html
<button class="delivery-btn" data-from="Location1" data-to="Location2">
  Location1 → Location2
</button>
```

## Integration with Unreal Engine

The frontend now uses iframe-based Pixel Streaming integration:

### 1. Pixel Streaming (iframe)

- Direct embedding of UE Pixel Streaming page
- No external library dependencies
- Automatic error handling and fallback modes

### 2. Web Remote Control API (HTTP)

Used for sending commands to UE:

- **Set Drone Location**:

  ```javascript
  ueApiManager.setDroneLocation(x, y, z);
  ```

- **Trigger Drone Action**:

  ```javascript
  ueApiManager.triggerDroneAction();
  ```

- **Change Camera View**:

  ```javascript
  ueApiManager.changeView();
  ```

- **Start Delivery**:
  ```javascript
  ueApiManager.startDelivery("Warehouse", "Library");
  ```

## UE Blueprint Interface Requirements

Ensure your UE project has the following functions implemented:

1. **Drone Actor Interface**:

   - `SetLocation(X: float, Y: float, Z: float)` - 设置无人机位置 (更新函数名)
   - `Fly()` - 触发无人机飞行动作 (更新函数名)

2. **Level Script Interface**:
   - `ChangeView()` - 改变摄像头视角

## Troubleshooting

### Pixel Streaming Issues

- If iframe fails to load, the system automatically offers:
  - Retry connection option
  - API-only mode (control without video)
- Check that UE Pixel Streaming server is running on the correct port

### Runtime Path Issues

The actor paths in `api-manager.js` are dynamic and change every time you start PIE. To get the current paths:

1. In your drone blueprint's BeginPlay event, print `Self->GetPathName()`
2. Update the paths in `api-manager.js`
3. Or implement a tag-based actor finding system for automatic path resolution

### Connection Issues

- Ensure UE Web Remote Control is enabled on port 30010
- Check that Pixel Streaming server is running
- Verify CORS settings if running from different domains

## Development

To modify the frontend:

1. Edit the HTML/CSS/JS files
2. Test changes locally
3. Update runtime paths when PIE restarts
4. The frontend will automatically reconnect to UE when refreshed

## License

MIT License
