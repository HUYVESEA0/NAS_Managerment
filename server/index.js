require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const history = require('connect-history-api-fallback');
const { PrismaClient } = require('@prisma/client');
const agentManager = require('./src/utils/agentManager');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// 1. Middleware Cơ Bản
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 2. API Routes (Đặt TRƯỚC history fallback)
const apiRoutes = require('./src/routes');
app.use('/api', apiRoutes);

// 3. Health Check (simple + agent status)
app.get('/health', (req, res) => {
    const agents = agentManager.getConnectedAgents();
    const spawner = localAgentSpawner.getInstance();
    res.json({
        status: 'ok',
        isProd,
        uptime: process.uptime(),
        agents: {
            connected: agents.length,
            list: agents.map(a => ({ id: a.id, name: a.machineName, status: a.status }))
        },
        localAgent: spawner ? spawner.getStatus() : { available: false }
    });
});

// 4. SPA Fallback & Static Files (Dùng cho Production)
if (isProd) {
    // In offline package, built files are directly in ../client
    // In dev layout, they'd be in ../client/dist — resolve whichever exists
    const fs = require('fs');
    const distDir = path.resolve(__dirname, '../client/dist');
    const clientDir = path.resolve(__dirname, '../client');
    const CLIENT_DIST = fs.existsSync(path.join(distDir, 'index.html')) ? distDir : clientDir;
    console.log(`   Static:  ${CLIENT_DIST}`);
    // History fallback giúp React Router hoạt động khi refresh trang
    app.use(history());
    // Phục vụ file tĩnh
    app.use(express.static(CLIENT_DIST));
} else {
    app.get('/', (req, res) => res.json({ message: 'NAS API - Dev Mode' }));
}

// 5. Get Network IP
function getNetworkIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const sshTerminalManager = require('./src/utils/sshTerminalManager');
const notificationHub = require('./src/utils/notificationHub');
const localAgentSpawner = require('./src/utils/localAgentSpawner');

// 6. Start Server
async function start() {
    const server = http.createServer(app);

    // Khởi tạo các WebSocket Server với options noServer: true
    agentManager.wss = new (require('ws').Server)({ noServer: true });
    sshTerminalManager.wss = new (require('ws').Server)({ noServer: true });
    notificationHub.wss = new (require('ws').Server)({ noServer: true });

    agentManager.init(agentManager.wss);
    sshTerminalManager.init(sshTerminalManager.wss);
    notificationHub.init(notificationHub.wss);

    // Xử lý Upgrade Request chung để chia luồng cho nhiều WS Server
    server.on('upgrade', (request, socket, head) => {
        const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

        if (pathname === '/ws/agent') {
            agentManager.wss.handleUpgrade(request, socket, head, (ws) => {
                agentManager.wss.emit('connection', ws, request);
            });
        } else if (pathname === '/ws/ssh') {
            sshTerminalManager.wss.handleUpgrade(request, socket, head, (ws) => {
                sshTerminalManager.wss.emit('connection', ws, request);
            });
        } else if (pathname === '/ws/notify') {
            notificationHub.wss.handleUpgrade(request, socket, head, (ws) => {
                notificationHub.wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
        }
    });

    const networkIP = getNetworkIP();
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 NAS SERVER ONLINE [${process.env.NODE_ENV}]`);
        console.log(`   Local:   http://localhost:${PORT}`);
        console.log(`   Network: http://${networkIP}:${PORT}`);
        console.log(`   Agent:   ws://${networkIP}:${PORT}/ws/agent`);
        console.log(`   SSH tty: ws://${networkIP}:${PORT}/ws/ssh`);
        console.log(`   Notify:  ws://${networkIP}:${PORT}/ws/notify\n`);

        // Auto-spawn local agent nếu chưa có kết nối sau 8 giây
        const spawner = localAgentSpawner.init(agentManager);
        spawner.startMonitoring(8);
    });
}

start().catch(err => {
    console.error('Fatal Server Error:', err);
    process.exit(1);
});
