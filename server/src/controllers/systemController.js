const si = require('systeminformation');
const os = require('os');
const child_process = require('child_process');

exports.getSystemInfo = async (req, res) => {
    try {
        const [osInfo, cpu, mem, diskLayout, networkInterfaces] = await Promise.all([
            si.osInfo(),
            si.cpu(),
            si.mem(),
            si.diskLayout(),
            si.networkInterfaces()
        ]);

        res.json({
            os: {
                platform: osInfo.platform,
                distro: osInfo.distro,
                release: osInfo.release,
                hostname: osInfo.hostname,
                uptime: os.uptime(),
            },
            cpu: {
                manufacturer: cpu.manufacturer,
                brand: cpu.brand,
                speed: cpu.speed,
                cores: cpu.physicalCores,
                processors: cpu.cores
            },
            memory: {
                total: mem.total,
                free: mem.free,
                used: mem.used,
            },
            disks: diskLayout.map(d => ({
                device: d.device,
                type: d.type,
                name: d.name,
                size: d.size
            })),
            network: networkInterfaces.filter(n => !n.internal).map(n => ({
                iface: n.iface,
                ip4: n.ip4,
                mac: n.mac,
                speed: n.speed
            }))
        });
    } catch (err) {
        console.error('Lỗi lấy System Info:', err);
        res.status(500).json({ error: 'Failed to retrieve system info' });
    }
};

exports.getSystemStats = async (req, res) => {
    try {
        const [cpuCurrentLoad, mem, fsSize, networkStats] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.fsSize(),
            si.networkStats()
        ]);

        res.json({
            cpu: {
                load: cpuCurrentLoad.currentLoad.toFixed(2),
                cores: cpuCurrentLoad.cpus.map(c => c.load.toFixed(2))
            },
            memory: {
                total: mem.total,
                used: mem.active,
                free: mem.available,
                percent: ((mem.active / mem.total) * 100).toFixed(2)
            },
            disks: fsSize.map(fs => ({
                fs: fs.fs,
                mount: fs.mount,
                size: fs.size,
                used: fs.used,
                percent: fs.use.toFixed(2)
            })),
            network: networkStats.map(n => ({
                iface: n.iface,
                rx_sec: n.rx_sec,
                tx_sec: n.tx_sec
            }))
        });
    } catch (err) {
        console.error('Lỗi lấy System Stats:', err);
        res.status(500).json({ error: 'Failed to retrieve system stats' });
    }
};

exports.getProcesses = async (req, res) => {
    try {
        const processes = await si.processes();
        // Lấy top 50 tiến trình tốn CPU nhất, sort giảm dần
        const list = processes.list
            .sort((a, b) => b.cpu - a.cpu)
            .slice(0, 50)
            .map(p => ({
                pid: p.pid,
                name: p.name,
                cpu: p.cpu.toFixed(2),
                mem: p.mem.toFixed(2), // % of memory
                memRss: p.memRss, // Vùng nhớ RAM thật (kb)
                user: p.user,
                state: p.state,
                started: p.started
            }));

        res.json({
            all: processes.all,
            running: processes.running,
            blocked: processes.blocked,
            sleeping: processes.sleeping,
            list
        });
    } catch (err) {
        console.error('Lỗi lấy Processes:', err);
        res.status(500).json({ error: 'Failed to retrieve processes' });
    }
};
