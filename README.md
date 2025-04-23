# Campus Drone Delivery Visualization - Frontend

This is the web frontend for visualizing drone deliveries on campus using Unreal Engine Pixel Streaming technology.

## Project Structure

```
droneOnCampus/
├── index.html        # Main HTML file with UI structure
├── styles.css       # CSS styling for the interface
├── pixel-streaming.js # Pixel Streaming integration
└── app.js           # Application logic and controls
```

## Setup Instructions

1. **Prerequisites**:
   - Modern web browser (Chrome, Firefox, Edge)
   - Python 3.x (for local testing)
   - Unreal Engine with Pixel Streaming server running

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
initialize(streamerUrl = 'ws://localhost:80')
```

### Delivery Locations
Edit `index.html` to add/remove delivery locations:
```html
<button class="delivery-btn" data-from="Location1" data-to="Location2">
  Location1 → Location2
</button>
```

### Camera Views
Edit `index.html` to modify camera views:
```html
<button class="camera-btn" data-view="viewName">
  View Description
</button>
```

## Integration with Unreal Engine

The frontend communicates with UE via:

1. **Commands Sent to UE**:
   - Delivery commands:
     ```json
     {
       "command": "startDelivery",
       "from": "Warehouse",
       "to": "Library",
       "timestamp": "ISO-8601"
     }
     ```
   - Camera commands:
     ```json
     {
       "command": "setCameraView", 
       "view": "follow",
       "timestamp": "ISO-8601"
     }
     ```

2. **Messages Received from UE**:
   - Status updates:
     ```json
     {
       "type": "statusUpdate",
       "status": "inProgress",
       "message": "Drone en route"
     }
     ```
   - Delivery updates:
     ```json
     {
       "type": "deliveryUpdate",
       "deliveryId": "123",
       "status": "completed",
       "location": "Library"
     }
     ```

## Development

To modify the frontend:

1. Edit the HTML/CSS/JS files
2. Test changes locally
3. The frontend will automatically reconnect to UE when refreshed

## License

MIT License
