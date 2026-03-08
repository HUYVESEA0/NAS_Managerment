const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const LOG_LEVEL = LEVELS[process.env.LOG_LEVEL || 'info'] ?? 2;

function timestamp() {
    return new Date().toISOString();
}

function formatMessage(level, category, message, meta) {
    const base = `[${timestamp()}] [${level.toUpperCase()}] [${category}] ${message}`;
    if (meta && Object.keys(meta).length > 0) {
        return `${base} ${JSON.stringify(meta)}`;
    }
    return base;
}

function writeToFile(line) {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const file = path.join(LOG_DIR, `server-${date}.log`);
    fs.appendFile(file, line + '\n', () => {});
}

function log(level, category, message, meta = {}) {
    if (LEVELS[level] === undefined || LEVELS[level] > LOG_LEVEL) return;
    const line = formatMessage(level, category, message, meta);
    // Console output
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
    // File output
    writeToFile(line);
}

/**
 * Create a scoped logger for a specific category
 * @param {string} category - e.g. 'agent', 'file', 'auth', 'hierarchy'
 */
function createLogger(category) {
    return {
        info: (msg, meta) => log('info', category, msg, meta),
        warn: (msg, meta) => log('warn', category, msg, meta),
        error: (msg, meta) => log('error', category, msg, meta),
        debug: (msg, meta) => log('debug', category, msg, meta),
    };
}

module.exports = { createLogger };
