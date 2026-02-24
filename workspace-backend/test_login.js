const http = require('http');

const data = JSON.stringify({
    email: 'uzairabbas2025@gmail.com',
    password: 'password123'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let responseBody = '';

    console.log(`📡 Status Code: ${res.statusCode}`);

    res.on('data', (d) => {
        responseBody += d;
    });

    res.on('end', () => {
        console.log('✅ Response:', responseBody);

        if (res.statusCode === 200) {
            console.log('\n🎉 SUCCESS: Authentication works!');
            console.log('    If browser fails, check CORS or Frontend config.');
        } else {
            console.log('\n❌ FAILURE: Authentication rejected by server.');
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Server connection lost:', error);
});

req.write(data);
req.end();
