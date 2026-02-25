module.exports = {
    apps: [
        {
            name: "nas-server",
            script: "./server/index.js",
            cwd: ".",
            env: {
                NODE_ENV: "production",
                PORT: 3001
            },
            watch: false,
            max_memory_restart: "1G",
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            error_file: "./logs/server-error.log",
            out_file: "./logs/server-out.log",
        },
        {
            name: "nas-agent",
            script: "./client_connect/agent.js",
            cwd: ".",
            watch: false,
            max_memory_restart: "500M",
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            error_file: "./logs/agent-error.log",
            out_file: "./logs/agent-out.log",
        }
    ]
};
