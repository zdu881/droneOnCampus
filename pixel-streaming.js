// Pixel Streaming integration for Unreal Engine
class PixelStreamingManager {
    constructor() {
        this.stream = null;
        this.videoElement = document.getElementById('video');
        this.statusElement = document.getElementById('status');
        this.connectionEstablished = false;
    }

    initialize(streamerUrl = 'ws://localhost:80') {
        // Load the Pixel Streaming library
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@epicgames-ps/lib@1.0.0/lib.min.js';
        script.onload = () => this._setupStreaming(streamerUrl);
        document.head.appendChild(script);
    }

    _setupStreaming(streamerUrl) {
        try {
            this.stream = new UE.PixelStreaming(streamerUrl, {
                videoElement: this.videoElement,
                initialSettings: {
                    StartVideoMuted: true,
                    AutoConnect: true,
                    AutoPlayVideo: true
                }
            });

            this.stream.addEventListener('open', () => {
                this.connectionEstablished = true;
                this.statusElement.textContent = 'Connected';
                this.statusElement.dataset.status = 'connected';
                console.log('Pixel Streaming connection established');
            });

            this.stream.addEventListener('close', () => {
                this.connectionEstablished = false;
                this.statusElement.textContent = 'Disconnected';
                this.statusElement.dataset.status = 'disconnected';
                console.log('Pixel Streaming connection closed');
            });

            this.stream.addEventListener('error', (error) => {
                console.error('Pixel Streaming error:', error);
                this.statusElement.textContent = 'Connection Error';
            });

        } catch (error) {
            console.error('Failed to initialize Pixel Streaming:', error);
            this.statusElement.textContent = 'Initialization Error';
        }
    }

    sendCommand(command) {
        if (!this.connectionEstablished) {
            console.warn('Cannot send command - not connected to UE');
            return false;
        }

        try {
            this.stream.emitUIInteraction(JSON.stringify(command));
            return true;
        } catch (error) {
            console.error('Failed to send command:', error);
            return false;
        }
    }
}

// Create global instance
window.pixelStreamingManager = new PixelStreamingManager();
