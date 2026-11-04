const fs = require('fs');
const f = 'src/App.tsx';
let s = fs.readFileSync(f, 'utf8');
const a = '"যেমন: রায়হান" : "e.g. Rayhan"';
if (s.split(a).length !== 2) { console.log('মিলেনি, কিছু বদলায়নি'); process.exit(1); }
s = s.replace(a, () => '"আপনার নাম" : "Your name"');
fs.writeFileSync(f, s);
console.log('ঠিক আছে');
