require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const agentManager = require('./src/utils/agentManager');

const prisma = new PrismaClient();
const app = express();

const isProd = process.env.NODE_ENV === 'production';

// Security & Middleware
app.use(helmet({
    contentSecurityPolicy: isProd ? undefined : false, // Relax CSP in dev for Vite HMR
}));
app.use(cors({
    origin: isProd ? false : '*', // In prod, same-origin only (served by same Express)
}));
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '50mb' })); // Support larger payloads for file upload

// === PRODUCTION: Serve React build ===
const CLIENT_DIST = path.join(__dirname, '../client/dist');
if (isProd) {
    app.use(express.static(CLIENT_DIST));
}

// API Routes
const apiRoutes = require('./src/routes');
app.use('/api', apiRoutes);

// Health Check (Deep)
app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', database: 'connected', uptime: process.uptime() });
    } catch (err) {
        res.status(503).json({ status: 'error', database: 'disconnected', error: err.message, uptime: process.uptime() });
    }
});

// === PRODUCTION: SPA Fallback (React Router) ===
// Must be AFTER /api routes so API calls are not intercepted
if (isProd) {
    app.get('/{*splat}', (req, res) => {
        res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
} else {
    // Dev: basic root response
    app.get('/', (req, res) => res.json({ message: 'NAS Management API — Development Mode' }));
}

const PORT = process.env.PORT || 3001;


async function main() {
    // Tạo HTTP server thay vì dùng app.listen trực tiếp
    const server = http.createServer(app);

    // Khởi tạo WebSocket Agent Manager
    agentManager.init(server);

    server.listen(PORT, '0.0.0.0', () => {
        const { networkInterfaces } = require('os');
        const nets = networkInterfaces();
        let localIp = 'localhost';

        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIp = net.address;
                }
            }
        }

        console.log(`\n🚀 Server running!`);
        console.log(`➜  Local:   http://localhost:${PORT}`);
        console.log(`➜  Network: http://${localIp}:${PORT}`);
        console.log(`➜  Agent WS: ws://${localIp}:${PORT}/ws/agent\n`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
