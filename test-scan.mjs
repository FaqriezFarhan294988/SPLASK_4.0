import http from 'http';

async function scan(url) {
  const data = JSON.stringify({ url });
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3000, path: '/api/scan',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = http.request(opts, (r) => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

async function poll(scanId, attempts = 0) {
  if (attempts > 40) { console.log('Timeout polling'); return; }
  await new Promise(r => setTimeout(r, 5000));
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000/api/results`, (r) => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => {
        const resp = JSON.parse(d);
        const scan = (resp.data || []).find(s => s.scanId === scanId);
        if (!scan) { poll(scanId, attempts + 1).then(resolve); return; }
        if (scan.status === 'PROCESSING') { poll(scanId, attempts + 1).then(resolve); return; }
        console.log('=== SCAN RESULT ===');
        console.log('URL:', scan.url);
        console.log('Status:', scan.status);
        console.log('Score:', scan.score + '%');
        console.log('Categories:');
        for (const cat of (scan.categories || [])) {
          console.log(`  [${cat.status}] ${cat.name}: ${cat.score}%`);
          for (const sub of (cat.subCategories || [])) {
            console.log(`      [${sub.status}] ${sub.name}`);
            if (sub.explanation) console.log(`         → ${sub.explanation}`);
          }
        }
        resolve();
      });
    }).on('error', reject);
  });
}

const url = process.argv[2] || 'https://ikma.edu.my/';
console.log('Scanning:', url);
const resp = await scan(url);
console.log('Scan ID:', resp.data?.scan_id, '| Initiated:', resp.success);
await poll(resp.data?.scan_id);
