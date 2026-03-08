const http = require('http');

// Configurable mock networks
const MOCK_NETWORKS = [
    { base: '192.168.1', count: 5, start: 100 },
    { base: '192.168.2', count: 3, start: 50 },
    { base: '10.0.0', count: 8, start: 10 },
    { base: '172.16.5', count: 4, start: 200 }
];

const port = 3005; // Port to start HTTP server if needed
const ips = [];

// Generate IP addresses for all configured networks
MOCK_NETWORKS.forEach(net => {
    for (let i = 0; i < net.count; i++) {
        ips.push(`${net.base}.${net.start + i}`);
    }
});

console.log('--- Multi-Subnet Network Simulator ---');
console.log(`Starting simulator for ${ips.length} devices across ${MOCK_NETWORKS.length} subnets.`);

// In a real network simulation we would create virtual interfaces or use a tool like Mininet,
// but since we are running natively on Windows, ping commands check the OS routing table.
// To truly simulate ping responses, we need OS-level mock interfaces or an ARP spoofing tool.

// For our Node.js app's network scanner (networkController.js), we either:
// 1. Need virtual adapters
// 2. OR modify the `exec('ping ...')` in networkController.js to intercept requests during 'test mode'.

console.log('\n[INFO] Note: To simulate network ping responses without OS-level virtual interfaces (like Loopback adapters),');
console.log('it is recommended to create a mock for the `exec` function inside `networkController.js` when testing.');
console.log('You can do this by setting an environment variable like MOCK_NETWORK=true and overriding the `pingHost` function.');

// Starting a small HTTP server just to keep the process alive if we want to add more mocked services later (like a mock SSH server)
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Mock Network Node');
});

server.listen(port, () => {
    console.log(`\nMock network node running on port ${port}.`);
    console.log('Mocked IP List:');

    let currentBase = '';
    ips.forEach(ip => {
        const base = ip.substring(0, ip.lastIndexOf('.'));
        if (base !== currentBase) {
            console.log(`\n  Subnet: ${base}.x`);
            currentBase = base;
        }
        console.log(`  - ${ip}`);
    });

    console.log('\nPress Ctrl+C to stop the simulator.');
});
