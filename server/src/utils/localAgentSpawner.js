const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./logger');

const log = createLogger('local-agent');

/**
 * LocalAgentSpawner — Tự động detect & spawn client_connect nếu chưa kết nối.
 * 
 * Flow:
 * 1. Sau khi server start, chờ WAIT_SECONDS giây
 * 2. Kiểm tra agentManager có agent nào kết nối chưa
 * 3. Nếu chưa có → spawn client_connect.js as child process
 * 4. Giám sát child process, restart nếu crash
 */
class LocalAgentSpawner {
    constructor(agentManager) {
        this.agentManager = agentManager;
        this.childProcess = null;
        this.isRunning = false;
        this.restartCount = 0;
        this.maxRestarts = 5;
        this.startedAt = null;

        // Tìm client_connect script
        this.agentScript = this._findAgentScript();
        this.agentConfigFile = this.agentScript
            ? path.join(path.dirname(this.agentScript), 'client_connect.config.json')
            : null;
    }

    /**
     * Tìm client_connect.js script path
     */
    _findAgentScript() {
        const candidates = [
            path.resolve(__dirname, '../../../client_connect/client_connect.js'),
            path.resolve(__dirname, '../../client_connect/client_connect.js'),
        ];
        for (const p of candidates) {
            if (fs.existsSync(p)) return p;
        }
        return null;
    }

    /**
     * Bắt đầu giám sát — gọi sau khi server listen xong
     * @param {number} waitSeconds - Chờ bao lâu trước khi kiểm tra (default: 8s)
     */
    startMonitoring(waitSeconds = 8) {
        if (!this.agentScript) {
            log.warn('client_connect.js not found, skipping local agent auto-spawn');
            return;
        }

        log.info(`Will check for local agent in ${waitSeconds}s`, { script: this.agentScript });

        setTimeout(() => {
            this._checkAndSpawn();
        }, waitSeconds * 1000);
    }

    /**
     * Kiểm tra agent đã kết nối chưa, nếu chưa thì spawn
     */
    _checkAndSpawn() {
        const connectedAgents = this.agentManager.getConnectedAgents();

        if (connectedAgents.length > 0) {
            log.info('Local agent already connected, no spawn needed', {
                agents: connectedAgents.map(a => a.machineName || a.id)
            });
            return;
        }

        // Kiểm tra config file có tồn tại không
        if (!this.agentConfigFile || !fs.existsSync(this.agentConfigFile)) {
            log.warn('No agent config file found, cannot auto-spawn');
            return;
        }

        log.info('No agents connected, spawning local client_connect...');
        this._spawn();
    }

    /**
     * Spawn child process
     */
    _spawn() {
        if (this.childProcess) {
            log.warn('Agent process already running, skipping spawn');
            return;
        }

        if (this.restartCount >= this.maxRestarts) {
            log.error(`Max restarts (${this.maxRestarts}) reached, giving up`);
            return;
        }

        try {
            const cwd = path.dirname(this.agentScript);
            this.childProcess = spawn(process.execPath, [this.agentScript], {
                cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { ...process.env },
                detached: false
            });

            this.isRunning = true;
            this.startedAt = new Date();
            log.info(`Local agent spawned (PID: ${this.childProcess.pid})`);

            // Pipe stdout/stderr to logger
            this.childProcess.stdout.on('data', (data) => {
                const line = data.toString().trim();
                if (line) log.info(`[agent] ${line}`);
            });

            this.childProcess.stderr.on('data', (data) => {
                const line = data.toString().trim();
                if (line) log.warn(`[agent] ${line}`);
            });

            this.childProcess.on('exit', (code, signal) => {
                this.isRunning = false;
                this.childProcess = null;
                log.warn(`Local agent exited`, { code, signal });

                // Auto-restart nếu exit bất thường
                if (code !== 0 && code !== null) {
                    this.restartCount++;
                    const delay = Math.min(5000 * this.restartCount, 30000);
                    log.info(`Restarting local agent in ${delay / 1000}s (attempt ${this.restartCount}/${this.maxRestarts})`);
                    setTimeout(() => this._spawn(), delay);
                }
            });

            this.childProcess.on('error', (err) => {
                this.isRunning = false;
                this.childProcess = null;
                log.error('Failed to spawn local agent', { error: err.message });
            });
        } catch (err) {
            log.error('Spawn error', { error: err.message });
        }
    }

    /**
     * Lấy trạng thái hiện tại
     */
    getStatus() {
        return {
            available: !!this.agentScript,
            running: this.isRunning,
            pid: this.childProcess?.pid || null,
            startedAt: this.startedAt,
            restartCount: this.restartCount
        };
    }

    /**
     * Dừng child process
     */
    stop() {
        if (this.childProcess) {
            log.info('Stopping local agent process');
            this.childProcess.kill('SIGTERM');
            this.childProcess = null;
            this.isRunning = false;
        }
    }
}

// Singleton
let instance = null;

module.exports = {
    init(agentManager) {
        instance = new LocalAgentSpawner(agentManager);
        return instance;
    },
    getInstance() {
        return instance;
    }
};
