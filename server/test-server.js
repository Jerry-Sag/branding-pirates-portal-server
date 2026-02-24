// Quick test to verify server is responding
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/verify',
    method: 'GET'
};

const req = http.request(options, (res) => {
    console.log(`✅ Server is responding!`);
    console.log(`Status Code: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Response:', data);
    });
});

req.on('error', (error) => {
    console.error('❌ Server connection failed:', error.message);
});

req.end();
