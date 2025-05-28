# Campus Drone Delivery Visualization - Frontend

This is the web frontend for visualizing drone deliveries on campus using Unreal Engine Pixel Streaming technology and Web Remote Control API.

## Project Structure

```
droneOnCampus/
├── index.html        # Main HTML file with UI structure
├── styles.css       # CSS styling for the interface
├── pixel-streaming.js # Pixel Streaming integration
├── api-manager.js   # UE Web Remote Control API manager
└── app.js           # Application logic and controls
```

## Setup Instructions

1. **Prerequisites**:

   - Modern web browser (Chrome, Firefox, Edge)
   - Python 3.x (for local testing)
   - Unreal Engine with Pixel Streaming server running
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

### Pixel Streaming Connection

Edit `pixel-streaming.js` to change the streaming server URL:

```javascript
// Change this line to match your UE server
initialize((streamerUrl = "ws://localhost:80"));
```

### UE Web Remote Control API

Edit `api-manager.js` to update runtime paths and locations:

```javascript
// Update drone actor runtime path (changes every PIE restart)
this.droneActorPath =
  "/Memory/UEDPIE_0_[YOUR_PIE_SESSION].NewMap:PersistentLevel.FbxScene_Drone_C_[YOUR_INSTANCE_ID]";

// Update level script actor path
this.levelScriptActorPath =
  "/Game/UEDPIE_0_NewMap.NewMap:PersistentLevel.NewMap_C_[YOUR_INSTANCE_ID]";

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

The frontend communicates with UE via two methods:

### 1. Web Remote Control API (HTTP)

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

### 2. Pixel Streaming (WebSocket)

Used for receiving real-time updates from UE:

- **Status Updates**:

  ```json
  {
    "type": "statusUpdate",
    "status": "inProgress",
    "message": "Drone en route"
  }
  ```

- **Delivery Updates**:
  ```json
  {
    "type": "deliveryUpdate",
    "deliveryId": "123",
    "status": "completed",
    "location": "Library"
  }
  ```

## UE Blueprint Interface Requirements

Ensure your UE project has the following functions implemented:

1. **Drone Actor Interface**:

   - `SetTargetLocation(X: float, Y: float, Z: float)` - 设置无人机目标位置
   - `Action()` - 触发无人机动作

2. **Level Script Interface**:
   - `ChangeView()` - 改变摄像头视角

## Troubleshooting

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
