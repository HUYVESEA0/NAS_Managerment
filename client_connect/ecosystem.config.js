module.exports = {
    apps: [
        {
            name: "nas-agent",
            script: "agent.js",
            cwd: ".",
            watch: false,
            max_memory_restart: "500M",
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            error_file: "./logs/agent-error.log",
            out_file: "./logs/agent-out.log",
            env: {
                NODE_ENV: "production"
            }
        }
    ]
};
