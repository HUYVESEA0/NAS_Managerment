module.exports = {
    apps: [
        {
            name: "nas-client-connect",
            script: "client_connect.js",
            cwd: ".",
            watch: false,
            max_memory_restart: "500M",
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            error_file: "./logs/client-connect-error.log",
            out_file: "./logs/client-connect-out.log",
            env: {
                NODE_ENV: "production"
            }
        }
    ]
};
