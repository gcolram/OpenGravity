module.exports = {
    apps: [{
        name: "opengravity",
        script: "npm",
        args: "run dev",
        watch: false,
        autorestart: true,
        max_memory_restart: "1G",
        env: {
            NODE_ENV: "production",
        }
    }]
}
