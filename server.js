const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Your OpenRouter API key
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
    '.mjs': 'text/javascript',
    '.txt': 'text/plain',
};

const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    
    // AI Chat API proxy
    if (urlPath === '/api/chat') {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Method not allowed' }));
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            let messages;
            let model;
            try {
                const data = JSON.parse(body);
                messages = data.messages;
                model = data.model || 'qwen/qwen-2.5-72b-instruct';
            } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }

            const payload = JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: 'You are Aura, a helpful AI assistant.' },
                    ...messages
                ],
                max_tokens: 1000,
                temperature: 0.7
            });

            const options = {
                hostname: 'openrouter.ai',
                path: '/api/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'http://localhost:' + PORT,
                    'X-Title': 'Aura AI Chat',
                    'Content-Length': Buffer.byteLength(payload)
                }
            };

            const proxyReq = http.request(options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
            });

            proxyReq.write(payload);
            proxyReq.end();
        });
        return;
    }
    
    if (urlPath === '/') urlPath = '/index.html';
    let filePath = path.join(__dirname, urlPath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (!ext) {
                const htmlPath = filePath + '.html';
                fs.readFile(htmlPath, (err2, data2) => {
                    if (!err2) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(data2);
                        return;
                    }
                    if (urlPath !== '/index.html') {
                        fs.readFile(path.join(__dirname, 'index.html'), (err3, data3) => {
                            if (err3) { res.writeHead(404); res.end('Not Found'); }
                            else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(data3); }
                        });
                        return;
                    }
                    res.writeHead(404); res.end('Not Found');
                });
                return;
            }
            if (urlPath !== '/index.html') {
                fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
                    if (err2) { res.writeHead(404); res.end('Not Found'); }
                    else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(data2); }
                });
                return;
            }
            res.writeHead(404); res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Aura server running on http://localhost:${PORT}`);
});