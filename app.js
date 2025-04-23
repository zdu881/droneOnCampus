document.addEventListener('DOMContentLoaded', () => {
    // Initialize Pixel Streaming
    pixelStreamingManager.initialize();
    
    // Setup delivery buttons
    document.querySelectorAll('.delivery-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const from = btn.dataset.from;
            const to = btn.dataset.to;
            
            const command = {
                command: 'startDelivery',
                from: from,
                to: to,
                timestamp: new Date().toISOString()
            };
            
            if (pixelStreamingManager.sendCommand(command)) {
                console.log(`Sent delivery command: ${from} → ${to}`);
            } else {
                alert('Failed to send delivery command. Please check connection.');
            }
        });
    });
    
    // Setup camera buttons
    document.querySelectorAll('.camera-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            
            const command = {
                command: 'setCameraView',
                view: view,
                timestamp: new Date().toISOString()
            };
            
            if (pixelStreamingManager.sendCommand(command)) {
                console.log(`Sent camera command: ${view} view`);
            } else {
                alert('Failed to send camera command. Please check connection.');
            }
        });
    });
    
    // Listen for messages from UE
    window.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'statusUpdate') {
                updateStatus(data);
            } else if (data.type === 'deliveryUpdate') {
                updateDeliveryStatus(data);
            }
        } catch (e) {
            console.log('Received non-JSON message:', event.data);
        }
    });
    
    function updateStatus(data) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = data.message;
        
        if (data.status === 'inProgress') {
            statusElement.dataset.status = 'connected';
        } else if (data.status === 'error') {
            statusElement.dataset.status = 'disconnected';
        }
    }
    
    function updateDeliveryStatus(data) {
        console.log('Delivery update:', data);
        // Could update UI with more detailed delivery status here
    }
});
