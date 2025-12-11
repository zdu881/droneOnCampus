# System Architecture Overview

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DRONE ON CAMPUS SYSTEM ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────────┐
                              │   Windows Client     │
                              │  (Electron App)      │
                              │  - Pixel Stream Rx   │
                              │  - Flight Monitor    │
                              │  - Auto-Stream Ctrl  │
                              └──────────┬───────────┘
                                         │
                      ┌──────────────────┼──────────────────┐
                      │                  │                  │
                      ▼                  ▼                  ▼
         ┌─────────────────────┐ ┌─────────────────┐ ┌──────────────┐
         │   Dashboard Server  │ │  Pixel Stream   │ │ UE5 Program  │
         │   (Node.js:8000)    │ │  (HTTP:80)      │ │ (Port:30010) │
         └─────────────┬───────┘ └────────┬────────┘ └──────┬───────┘
                       │                  │                 │
       ┌───────────────┼──────────────────┴─────────────────┤
       │               │                                     │
       ▼               ▼                                     ▼
  ┌─────────────┐ ┌──────────────┐                  ┌────────────────┐
  │ Dashboard   │ │ File Server  │                  │ Remote Control │
  │ Frontend    │ │ (Static:8081)│                  │ API Endpoint   │
  │ (React/Vue) │ └──────────────┘                  └────────┬───────┘
  └─────────────┘                                            │
                                                    ┌─────────┴──────────┐
                                                    │                    │
                                            ┌───────▼────────┐  ┌───────▼────────┐
                                            │  Object Call   │  │  Property Get  │
                                            │  (Fly, Land,   │  │  (Position,    │
                                            │   ChangeView)  │  │   Status)      │
                                            └────────────────┘  └────────────────┘
```

---

## Detailed Module Architecture

### 1. Frontend Dashboard Module
```
┌─────────────────────────────────────────────────────┐
│         DASHBOARD FRONTEND (Dashboard Manager)       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │   Drone Control Panel                      │    │
│  │  ├─ Start Flight Button                    │    │
│  │  ├─ Land Button                            │    │
│  │  ├─ Position Control (X, Y, Z)             │    │
│  │  ├─ Preset Locations                       │    │
│  │  └─ View Change Button                     │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │   Ray Cluster Monitor                      │    │
│  │  ├─ Cluster Status                         │    │
│  │  ├─ Node List (IP, Status)                 │    │
│  │  ├─ Resource Usage (CPU, Memory)           │    │
│  │  └─ Service Health Check                   │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │   File Transfer Manager                    │    │
│  │  ├─ Upload/Download Progress               │    │
│  │  ├─ File List View                         │    │
│  │  └─ Transfer Log                           │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │   Station Management                       │    │
│  │  ├─ Light Control (ON/OFF)                 │    │
│  │  ├─ Station Maintenance                    │    │
│  │  └─ Status Display                         │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 2. API Server & Communication Layer
```
┌──────────────────────────────────────────────────────────┐
│         API SERVER (Node.js - server.js)                 │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │   Dashboard API Manager (api-manager.js)         │   │
│  │  ├─ GET /api/drone/status                        │   │
│  │  │  └─ Returns: {isFlying, position, status}    │   │
│  │  ├─ PUT /api/drone/status                        │   │
│  │  │  └─ Updates: Flight status                   │   │
│  │  └─ POST /api/drone/action                       │   │
│  │     └─ Triggers: Fly, Land, ChangeView          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │   UE API Manager (ue-api-manager.js)             │   │
│  │  ├─ triggerDroneAction()                         │   │
│  │  │  └─ Calls: /remote/object/call (Port:30010)  │   │
│  │  ├─ changeView()                                 │   │
│  │  ├─ setPosition(x, y, z)                         │   │
│  │  └─ getStatus()                                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │   File Transfer Manager (file-transfer-mgr.js)   │   │
│  │  ├─ POST /api/files/upload                       │   │
│  │  ├─ GET /api/files/download/:id                  │   │
│  │  ├─ GET /api/files/list                          │   │
│  │  └─ DELETE /api/files/:id                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │   Ray Cluster Integration (ray-cluster-mgr.js)   │   │
│  │  ├─ GET /api/ray/status                          │   │
│  │  ├─ GET /api/ray/nodes                           │   │
│  │  ├─ POST /api/ray/submit-job                     │   │
│  │  └─ GET /api/ray/jobs/:id                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │   Station Manager (station-manager.js)           │   │
│  │  ├─ GET /api/station/status                      │   │
│  │  ├─ POST /api/station/light/control              │   │
│  │  ├─ POST /api/station/maintenance                │   │
│  │  └─ GET /api/station/history                     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │   Error & Alert System (notification-mgr.js)     │   │
│  │  ├─ Error Logging                                │   │
│  │  ├─ Real-time Alerts (WebSocket)                 │   │
│  │  ├─ Alert History                                │   │
│  │  └─ Alert Classification (ERROR|WARNING|INFO)    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### 3. UE5 Simulation Module
```
┌────────────────────────────────────────────────────────┐
│         UE5 PROGRAM (Remote Control API)               │
├────────────────────────────────────────────────────────┤
│  Port: 30010 (HTTP Remote Object Invocation)           │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │   Actor: Drone_C                                │ │
│  │  ├─ Fly()                                        │ │
│  │  │  └─ Simulates: Takeoff & Flight Control      │ │
│  │  ├─ Land()                                       │ │
│  │  │  └─ Simulates: Landing Sequence              │ │
│  │  ├─ SetLocation(x, y, z)                        │ │
│  │  │  └─ Simulates: GPS-based Position Change     │ │
│  │  ├─ ChangeView()                                │ │
│  │  │  └─ Switches: 1st Person / 3rd Person        │ │
│  │  └─ GetStatus()                                 │ │
│  │     └─ Returns: Position, Battery, Status       │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │   Lighting System                                │ │
│  │  ├─ Base Station Lights (Billboard Lights)       │ │
│  │  ├─ Dynamic Light Control                        │ │
│  │  ├─ Color Mapping (Status → Color)               │ │
│  │  │  ├─ Green: Normal                             │ │
│  │  │  ├─ Yellow: Warning                           │ │
│  │  │  └─ Red: Error                                │ │
│  │  └─ Visual Feedback System                       │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │   Environment & Assets                          │ │
│  │  ├─ Campus Map                                   │ │
│  │  ├─ Building Models                              │ │
│  │  ├─ Vehicle Models                               │ │
│  │  ├─ Preset Locations                             │ │
│  │  └─ Camera Positions                             │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### 4. Pixel Streaming Module
```
┌─────────────────────────────────────────────────────────┐
│      PIXEL STREAMING SYSTEM                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  UE5 Pixel Streaming Server (Port: 80)                 │
│  ├─ Real-time Video Encoding (H.264/H.265)            │
│  ├─ Low-Latency Transmission (WebRTC)                  │
│  └─ Interactive Controls Support                       │
│                                                          │
│                          │                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐  │
│  │   Electron Pixel Stream Receiver                │  │
│  │  ├─ Fetch Stream URL (http://10.30.2.11:80)   │  │
│  │  ├─ Display via iframe                          │  │
│  │  ├─ Auto-start Stream                           │  │
│  │  │  └─ Simulates click on "Click to Start"     │  │
│  │  ├─ Stream Status Monitor                       │  │
│  │  └─ Error Recovery                              │  │
│  └─────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─────────────────────────────────────────────────┐  │
│  │   Streaming Features                            │  │
│  │  ├─ Latency: ~100-200ms                         │  │
│  │  ├─ Resolution: Full HD (1920x1080)             │  │
│  │  ├─ Frame Rate: 30-60 FPS                       │  │
│  │  └─ Quality: Adaptive Bitrate                   │  │
│  └─────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 5. Error & Alert Warning System
```
┌──────────────────────────────────────────────────────────┐
│         ERROR & ALERT WARNING SYSTEM                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │   Error Detection & Monitoring                    │ │
│  │  ├─ API Connection Failures                       │ │
│  │  ├─ UE5 Remote Call Errors                        │ │
│  │  ├─ File Transfer Interruptions                   │ │
│  │  ├─ Ray Cluster Node Failures                     │ │
│  │  ├─ Pixel Stream Connection Loss                  │ │
│  │  └─ Station Component Failures                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │   Alert Classification & Severity Levels         │ │
│  │                                                     │ │
│  │  CRITICAL (Red)                                   │ │
│  │  ├─ Drone flight failure                          │ │
│  │  ├─ API server down                               │ │
│  │  └─ Multiple component failures                   │ │
│  │                                                     │ │
│  │  WARNING (Yellow)                                 │ │
│  │  ├─ High latency detected                         │ │
│  │  ├─ File transfer slow                            │ │
│  │  └─ Ray cluster degraded                          │ │
│  │                                                     │ │
│  │  INFO (Blue)                                      │ │
│  │  ├─ Normal operations                             │ │
│  │  ├─ System status updates                         │ │
│  │  └─ Routine maintenance                           │ │
│  │                                                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │   Real-time Notification System                   │ │
│  │  ├─ WebSocket-based Push Notifications            │ │
│  │  ├─ Email Alerts (Critical Errors)                │ │
│  │  ├─ Log File Recording                            │ │
│  │  ├─ Dashboard Alert Panel                         │ │
│  │  └─ Sound Alerts (Optional)                       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │   Error Recovery Mechanisms                       │ │
│  │  ├─ Automatic Retry (with exponential backoff)    │ │
│  │  ├─ Fallback to Simulation Mode                   │ │
│  │  ├─ State Synchronization                         │ │
│  │  └─ User Manual Recovery Options                  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### 6. File Transfer Module
```
┌────────────────────────────────────────────────────────┐
│         FILE TRANSFER SYSTEM                           │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │   Upload Flow                                    │ │
│  │                                                   │ │
│  │  File Selection → Chunking → Upload              │ │
│  │      ↓              ↓          ↓                 │ │
│  │   Validation    Checksum   Progress              │ │
│  │                  Check      Tracking             │ │
│  │                             ↓                    │ │
│  │                      Storage Management          │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │   Download Flow                                  │ │
│  │                                                   │ │
│  │  File Request → Compression → Download           │ │
│  │      ↓             ↓            ↓                │ │
│  │   Validation   Optimization  Progress            │ │
│  │                              Tracking            │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │   Features & Optimizations                       │ │
│  │  ├─ Multi-part Upload/Download                   │ │
│  │  ├─ Resume Support (Breakpoint Resume)           │ │
│  │  ├─ Concurrent Transfers                         │ │
│  │  ├─ Bandwidth Throttling                         │ │
│  │  ├─ File Integrity Verification (MD5/SHA256)     │ │
│  │  ├─ Virus Scan Integration (Optional)            │ │
│  │  └─ Audit Logging                                │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  Storage Backend:                                       │
│  └─ Local Filesystem + Cloud (S3 compatible)          │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### 7. Drone Simulation Module
```
┌────────────────────────────────────────────────────────┐
│      DRONE FLIGHT SIMULATION (UE5 Blueprint)           │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │   Flight Physics Simulation                      │ │
│  │  ├─ Takeoff & Landing                            │ │
│  │  │  ├─ Vertical acceleration                     │ │
│  │  │  ├─ Altitude constraints                      │ │
│  │  │  └─ Safety zone detection                     │ │
│  │  ├─ Navigation                                   │ │
│  │  │  ├─ GPS-based positioning                     │ │
│  │  │  ├─ Waypoint guidance                         │ │
│  │  │  └─ Collision avoidance                       │ │
│  │  └─ Motor/Battery Simulation                     │ │
│  │     ├─ Battery drain rate                        │ │
│  │     ├─ Power consumption per action              │ │
│  │     └─ Low battery warning                       │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │   Environmental Factors                          │ │
│  │  ├─ Wind simulation                              │ │
│  │  ├─ Atmospheric effects                          │ │
│  │  ├─ Lighting conditions                          │ │
│  │  └─ Weather effects                              │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │   State Management                               │ │
│  │  ├─ Current Position (X, Y, Z)                   │ │
│  │  ├─ Velocity & Acceleration                      │ │
│  │  ├─ Battery Level                                │ │
│  │  ├─ Flight Status (Idle|Flying|Landing)          │ │
│  │  └─ Sensor Data (IMU, Barometer, GPS)            │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### 8. Ray Cluster Integration Module
```
┌────────────────────────────────────────────────────────┐
│      RAY CLUSTER INTEGRATION SYSTEM                    │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │   Cluster Monitoring                             │ │
│  │  ├─ Node Status (Online/Offline)                 │ │
│  │  ├─ Resource Utilization                         │ │
│  │  │  ├─ CPU Usage Per Node                        │ │
│  │  │  ├─ Memory Usage                              │ │
│  │  │  ├─ GPU Status (if available)                 │ │
│  │  │  └─ Disk Space                                │ │
│  │  ├─ Actor State Monitoring                       │ │
│  │  └─ Task Execution Status                        │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │   Distributed Computing                          │ │
│  │  ├─ Remote Task Execution                        │ │
│  │  ├─ Actor Pool Management                        │ │
│  │  ├─ Load Balancing                               │ │
│  │  └─ Fault Tolerance                              │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │   Data Processing                                │ │
│  │  ├─ Stream Processing                            │ │
│  │  ├─ Batch Jobs                                   │ │
│  │  ├─ ML Model Inference (Optional)                │ │
│  │  └─ Data Aggregation                             │ │
│  └──────────────────────────────────────────────────┘ │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### A. Drone Flight Activation Flow
```
┌──────────────┐
│ User Clicks  │
│ "Start Fly"  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Dashboard: startDroneFlight()         │
│ - Calls: apiManager.triggerDroneAction()
└──────┬───────────────────────────────┘
       │
       ├─────────────────────────────────────┐
       │                                     │
       ▼                                     ▼
┌──────────────────────┐        ┌──────────────────────┐
│ Update API Status    │        │ Call UE Remote API   │
│ PUT /api/drone/status│        │ /remote/object/call  │
│ {isFlying: true}     │        │ function: "Fly"      │
└──────┬───────────────┘        └──────┬───────────────┘
       │                               │
       ├───────────────────┬───────────┘
       │                   │
       ▼                   ▼
┌──────────────────────────────────────────┐
│ Electron App: Poll API Status            │
│ GET /api/drone/status (every 500ms)      │
│ Receives: {isFlying: true}               │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ drone-monitor.js: Emit flight:started    │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ main.js: Send IPC stream:status          │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ renderer.js: Create iframe + Auto-start  │
│ Load: http://10.30.2.11:80               │
│ Auto-click "Click to Start" button       │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Pixel Stream: Begin Video Transmission   │
│ Display in Electron Window               │
└──────────────────────────────────────────┘
```

### B. Error Detection & Alert Flow
```
┌────────────────────────────────────┐
│ System Operation / Component Check  │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ Error Detector (Notification Manager)      │
│ - API connection check                     │
│ - UE5 response validation                  │
│ - File transfer monitoring                 │
│ - Ray cluster health check                 │
└────────┬───────────────────────────────────┘
         │
    ┌────┴────┬─────────┬──────────┐
    │          │         │          │
    ▼          ▼         ▼          ▼
 CRITICAL   WARNING    INFO     (recovered)
    │          │         │          │
    ├──────────┼─────────┼──────────┤
    │          │         │          │
    ▼          ▼         ▼          ▼
┌─────────────────────────────────────────┐
│ Alert Routing & Notification             │
├─────────────────────────────────────────┤
│ ├─ Dashboard: Visual Alert Panel         │
│ ├─ WebSocket: Real-time Push             │
│ ├─ Log File: Persistent Record           │
│ ├─ Email: Critical Only                  │
│ └─ Sound: Optional Audible Alert         │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ User Notification & Response             │
│ - View alert details                     │
│ - Execute recovery action                │
│ - Acknowledge/Dismiss                    │
└─────────────────────────────────────────┘
```

### C. File Transfer Process
```
┌──────────────────────┐
│ User Selects File(s) │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Client-side Processing                   │
│ - File validation                        │
│ - Chunking (e.g., 5MB chunks)            │
│ - Calculate checksum                     │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Upload Request                           │
│ POST /api/files/upload                   │
│ - Headers: Content-Range, Checksum       │
│ - Body: File chunk data                  │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Server-side Processing                   │
│ - Validate chunk                         │
│ - Store in temporary location            │
│ - Update transfer progress               │
│ - Reassemble if all chunks received      │
└──────────┬───────────────────────────────┘
           │
        ┌──┴──┐
        │ All?│
        └──┬──┘
       Yes │ No
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
  Return    Continue Upload
  File ID   (next chunk)
    │
    ▼
┌──────────────────────────────────────────┐
│ Finalization                             │
│ - Verify checksum                        │
│ - Move to permanent storage              │
│ - Update database                        │
│ - Return success response                │
└──────────────────────────────────────────┘
```

---

## System Network Topology

```
                         ┌─────────────────────────┐
                         │   Workstation/Laptop    │
                         │  (Windows/Linux/macOS)  │
                         └────────────┬────────────┘
                                      │
                         ┌────────────┼────────────┐
                         │      Network (LAN)      │
                         │   IP: 10.30.2.0/24      │
                         └────────────┬────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  UE5 Simulation      │  │  Linux Server (API)  │  │  Ray Cluster Node    │
│  10.30.2.11:30010    │  │  10.30.2.11:8000     │  │  (Optional)          │
│  (Pixel Stream:80)   │  │  (File Server:8081)  │  │                      │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘

Client Connections:
├─ Dashboard (Web Browser): http://10.30.2.11:8081
├─ Electron App: 
│  ├─ API polling: http://10.30.2.11:8000/api/drone/status
│  └─ Pixel stream: http://10.30.2.11:80
└─ File Operations: http://10.30.2.11:8000/api/files/*
```

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React/Vue + HTML/CSS/JS | Dashboard UI |
| **API Server** | Node.js + Express | REST API & Business Logic |
| **Simulation** | Unreal Engine 5 | Drone & Environment Simulation |
| **Streaming** | UE5 Pixel Streaming | Real-time Video Transmission |
| **Desktop App** | Electron | Windows Client Application |
| **Cluster Computing** | Ray | Distributed Computing (Optional) |
| **File Storage** | Filesystem + Node.js | File Transfer & Storage |
| **Logging** | Winston + File System | Error Tracking & Audit |
| **Real-time Communication** | WebSocket | Live Alerts & Updates |
| **Container (Optional)** | Docker | Deployment & Containerization |

---

## Performance Targets

```
┌─────────────────────────────────────────────────────────┐
│            SYSTEM PERFORMANCE METRICS                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  API Response Time:          < 100ms (p95)              │
│  Dashboard Update Frequency: 500ms polling interval      │
│  Pixel Stream Latency:       100-200ms                   │
│  File Transfer Speed:        Dependent on network        │
│  Ray Cluster Overhead:       < 5% CPU                    │
│  Error Detection Time:       < 1s                        │
│  Alert Notification Delay:   < 500ms                     │
│  Concurrent Users:           10+ simultaneous clients    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Security Considerations

```
┌──────────────────────────────────────────────────────────┐
│         SECURITY & ACCESS CONTROL LAYER                  │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Network Layer:                                           │
│  ├─ Firewall rules (whitelist dashboard IP)              │
│  ├─ HTTPS/TLS for sensitive operations                   │
│  └─ VPN/SSH tunneling for remote access                  │
│                                                           │
│  Authentication & Authorization:                         │
│  ├─ User login (if required)                             │
│  ├─ API token validation                                 │
│  ├─ Role-based access control (RBAC)                     │
│  └─ Audit logging for all actions                        │
│                                                           │
│  Data Protection:                                         │
│  ├─ File integrity verification (MD5/SHA256)             │
│  ├─ Input validation & sanitization                      │
│  ├─ SQL injection prevention                             │
│  └─ XSS protection                                        │
│                                                           │
│  Error Handling:                                          │
│  ├─ Secure error messages (no sensitive info)            │
│  ├─ Logging without credentials                          │
│  └─ Graceful degradation on failures                     │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
Development Environment:
├─ Linux Server (Development)
├─ UE5 Instance (Debug Mode)
└─ Local Testing

Production Environment:
├─ Linux Server (Production)
│  ├─ API Server (Node.js)
│  ├─ File Storage (SSD)
│  └─ Monitoring & Logging
├─ UE5 Instance (Packaged Build)
│  ├─ Pixel Streaming Server
│  └─ Simulation Engine
├─ Ray Cluster (Optional)
│  ├─ Head Node
│  ├─ Worker Nodes
│  └─ Object Store
└─ Client Machines
   ├─ Windows (Electron App)
   ├─ Web Browsers (Dashboard)
   └─ Command Line Tools

High Availability:
├─ API Server Redundancy (Load Balancer)
├─ Database Replication
├─ Ray Cluster Auto-scaling
└─ Health Check & Auto-recovery
```

---

## Summary

This architecture provides a comprehensive system for:

1. **🎮 Simulation Control** - UE5-based drone simulation with physics and environmental modeling
2. **📊 Dashboard Management** - Centralized control and monitoring interface
3. **🎬 Real-time Streaming** - Low-latency pixel streaming for immersive experience
4. **📁 File Transfer** - Reliable multi-part file upload/download with verification
5. **⚠️ Error & Alerts** - Proactive monitoring and real-time notification system
6. **🔧 Station Control** - Hardware integration for lighting and maintenance
7. **🚀 Distributed Computing** - Ray cluster support for scalable processing
8. **💻 Desktop Application** - Windows Electron app for standalone operation

All components are integrated through REST APIs and WebSocket for real-time communication, ensuring a cohesive and responsive system experience.
