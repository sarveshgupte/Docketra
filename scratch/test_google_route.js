const http = require('http');

http.get('http://localhost:5000/api/auth/google/start?intent=login&firmSlug=gupte-opc', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers Location:', res.headers.location);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response Body:', data);
  });
}).on('error', (err) => {
  console.error('Error Object:', err);
});
