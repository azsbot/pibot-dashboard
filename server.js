const http = require('http');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const PORT = 3000;
const HTML_PATH = '/var/www/html/index.html';
const MEMORY_PATH = '/home/soikat/clawd/MEMORY.md';
const ACTIVITIES_PATH = '/home/soikat/clawd/memory/activities.json';

// Get model from environment variable or fallback
function getModel() {
    const model = process.env.MODEL || 'unknown';
    // Try to get from session status file if it exists
    const statusPath = path.join(__dirname, 'session-status.json');
    if (fs.existsSync(statusPath)) {
        try {
            const statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
            if (statusData.model) return statusData.model;
        } catch {}
    }
    return model;
}

// System info
function getSystemInfo() {
    return new Promise((resolve) => {
        const info = {};
        
        exec('cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null', (err, stdout) => {
            const temp = parseInt(stdout) / 1000;
            info.cpuTemp = isNaN(temp) ? null : temp.toFixed(1);
            
            exec("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//'", (err, stdout) => {
                info.cpuUsage = stdout.trim() || '0';
                
                exec("free -m | awk 'NR==2{printf \"%.1f\", $3*100/$2}'", (err, stdout) => {
                    info.memoryUsage = stdout.trim() || '0';
                    
                    exec("uptime -p", (err, stdout) => {
                        info.uptime = stdout.trim() || 'Unknown';
                        
                        exec("cat /proc/loadavg | awk '{print $1, $2, $3}'", (err, stdout) => {
                            const parts = stdout.trim().split(' ');
                            info.loadAvg = parts.join(', ');
                            
                            resolve(info);
                        });
                    });
                });
            });
        });
    });
}

// Get memory content
function getMemory() {
    return new Promise((resolve) => {
        fs.readFile(MEMORY_PATH, 'utf8', (err, data) => {
            if (err) {
                resolve({ error: 'Could not read memory' });
            } else {
                resolve({ content: data });
            }
        });
    });
}

// Get recent activities
function getActivities() {
    return new Promise((resolve) => {
        // Try to read activities file, or return demo data
        if (fs.existsSync(ACTIVITIES_PATH)) {
            fs.readFile(ACTIVITIES_PATH, 'utf8', (err, data) => {
                if (err) {
                    resolve({ activities: getDemoActivities() });
                } else {
                    try {
                        resolve({ activities: JSON.parse(data) });
                    } catch (e) {
                        resolve({ activities: getDemoActivities() });
                    }
                }
            });
        } else {
            resolve({ activities: getDemoActivities() });
        }
    });
}

function getDemoActivities() {
    return [
        { time: new Date().toISOString(), action: 'Dashboard accessed', details: 'User viewed dashboard' },
        { time: new Date(Date.now() - 300000).toISOString(), action: 'Memory updated', details: 'Pre-compaction flush' },
        { time: new Date(Date.now() - 600000).toISOString(), action: 'Website updated', details: 'Added model badge and skills' },
        { time: new Date(Date.now() - 900000).toISOString(), action: 'Model switched', details: 'Now using MiniMax-M2.5' },
        { time: new Date(Date.now() - 120000).toISOString(), action: 'Website restored', details: 'Fixed empty file issue' },
    ];
}

const server = http.createServer(async (req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // API endpoints
    if (req.url === '/api/systeminfo') {
        const info = await getSystemInfo();
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify(info));
    }

    if (req.url === '/api/memory') {
        const memory = await getMemory();
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify(memory));
    }

    if (req.url === '/api/activities') {
        const activities = await getActivities();
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify(activities));
    }

    if (req.url === '/api/model') {
        const model = getModel();
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify({ model }));
    }

    if (req.url === '/api/status') {
        const model = getModel();
        const info = { model };
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify(info));
    }

    // Serve HTML
    if (req.url === '/' || req.url === '/index.html' || req.url === '/dashboard') {
        fs.readFile(HTML_PATH, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                return res.end('Error loading page');
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
