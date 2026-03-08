const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'secret_dev_key';

/**
 * NotificationHub — WebSocket broadcast cho dashboard clients
 * 
 * Khi có thay đổi (file CRUD, agent online/offline, hierarchy update),
 * server broadcast event qua WS để client tự động cập nhật UI.
 * 
 * Endpoint: /ws/notify
 * Auth: JWT token qua query param ?token=xxx
 * 
 * Events:
 *   - agent:online      { machineId, machineName }
 *   - agent:offline     { machineId, machineName }
 *   - file:created      { machineId, path }
 *   - file:deleted      { machineId, path }
 *   - file:renamed      { machineId, oldPath, newPath }
 *   - file:uploaded     { machineId, path }
 *   - hierarchy:changed { action, entityType, entityId }
 *   - paths:updated     { machineId, paths }
 */
class NotificationHub {
    constructor() {
        this.wss = null;
        this.clients = new Set();
    }

    init(wssInstance) {
        this.wss = wssInstance;

        this.wss.on('connection', (ws, req) => {
            // Verify JWT from query string
            const url = new URL(req.url, `http://${req.headers.host}`);
            const token = url.searchParams.get('token');

            if (!token) {
                ws.close(4001, 'Missing token');
                return;
            }

            try {
                const decoded = jwt.verify(token, SECRET_KEY);
                ws._userId = decoded.userId;
                ws._isAlive = true;
            } catch (err) {
                ws.close(4003, 'Invalid token');
                return;
            }

            this.clients.add(ws);

            ws.on('pong', () => { ws._isAlive = true; });
            ws.on('close', () => { this.clients.delete(ws); });
            ws.on('error', () => { this.clients.delete(ws); });

            // Send confirmation
            ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
        });

        // Heartbeat — clean dead connections
        this._heartbeat = setInterval(() => {
            for (const ws of this.clients) {
                if (!ws._isAlive) {
                    this.clients.delete(ws);
                    ws.terminate();
                    continue;
                }
                ws._isAlive = false;
                ws.ping();
            }
        }, 30000);

        console.log('🔔 Notification WebSocket initialized at /ws/notify');
    }

    /**
     * Broadcast event đến tất cả dashboard clients
     * @param {string} event - Event name (e.g. 'file:created')
     * @param {object} data  - Payload
     */
    broadcast(event, data = {}) {
        const message = JSON.stringify({ type: 'event', event, data, timestamp: Date.now() });
        for (const ws of this.clients) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        }
    }

    destroy() {
        if (this._heartbeat) clearInterval(this._heartbeat);
        for (const ws of this.clients) ws.terminate();
        this.clients.clear();
    }
}

const notificationHub = new NotificationHub();
module.exports = notificationHub;
