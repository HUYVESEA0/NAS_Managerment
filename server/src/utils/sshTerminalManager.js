const WebSocket = require('ws');
const { Client } = require('ssh2');
const prisma = require('./prisma');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'secret_dev_key';

class SshTerminalManager {
    init(wssInstance) {
        if (wssInstance) {
            this.wss = wssInstance;
        }

        this.wss.on('connection', async (ws, req) => {
            console.log('🖥️ New Web Terminal connection requested');

            // Extract token and machineId from query string ?token=...&machineId=...
            const url = new URL(req.url, `http://${req.headers.host}`);
            const token = url.searchParams.get('token');
            const machineId = url.searchParams.get('machineId');

            if (!token || !machineId) {
                ws.send('\r\n\x1b[31mError: Missing token or machineId\x1b[0m\r\n');
                ws.close();
                return;
            }

            try {
                // Verify JWT
                jwt.verify(token, SECRET_KEY);

                // Check machine
                const machine = await prisma.machine.findUnique({
                    where: { id: parseInt(machineId) }
                });

                if (!machine) {
                    ws.send('\r\n\x1b[31mError: Machine not found\x1b[0m\r\n');
                    ws.close();
                    return;
                }

                if (!machine.ipAddress || !machine.username || !machine.password) {
                    ws.send('\r\n\x1b[31mError: Machine does not have SSH credentials configured. Please add them in the admin menu.\x1b[0m\r\n');
                    ws.close();
                    return;
                }

                ws.send(`\r\n\x1b[32mEstablishing secure shell connection to ${machine.username}@${machine.ipAddress}...\x1b[0m\r\n`);

                const conn = new Client();

                conn.on('ready', () => {
                    ws.send(`\r\n\x1b[32mConnection established.\x1b[0m\r\n`);
                    conn.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, stream) => {
                        if (err) {
                            ws.send(`\r\n\x1b[31mError starting shell: ${err.message}\x1b[0m\r\n`);
                            ws.close();
                            return;
                        }

                        // Pipe SSH output to WebSocket
                        stream.on('data', (data) => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(data.toString());
                            }
                        });

                        // Pipe WebSocket input to SSH
                        ws.on('message', (data) => {
                            try {
                                const msg = JSON.parse(data.toString());
                                if (msg.type === 'data') {
                                    stream.write(msg.data);
                                } else if (msg.type === 'resize') {
                                    stream.setWindow(msg.rows, msg.cols, msg.height, msg.width);
                                }
                            } catch (e) { /* ignore parse errors */ }
                        });

                        ws.on('close', () => {
                            conn.end();
                        });

                        stream.on('close', () => {
                            ws.send(`\r\n\x1b[33mConnection closed by remote host.\x1b[0m\r\n`);
                            ws.close();
                            conn.end();
                        });
                    });
                }).on('error', (err) => {
                    ws.send(`\r\n\x1b[31mSSH Connection Error: ${err.message}\x1b[0m\r\n`);
                    ws.close();
                }).connect({
                    host: machine.ipAddress,
                    port: machine.port || 22,
                    username: machine.username,
                    password: machine.password,
                    tryKeyboard: true,
                    readyTimeout: 10000
                });

            } catch (err) {
                console.error('Web Terminal Error:', err);
                ws.send(`\r\n\x1b[31mAuthentication or Initialization Error: ${err.message}\x1b[0m\r\n`);
                ws.close();
            }
        });

        console.log('🌐 Web Terminal WebSocket server initialized at /ws/ssh');
    }
}

const sshTerminalManager = new SshTerminalManager();
module.exports = sshTerminalManager;
