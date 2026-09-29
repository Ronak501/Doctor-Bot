const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const key = env.split('\n').find(l => l.startsWith('GROQ_API_KEY=')).split('=')[1].trim();

fetch('https://api.groq.com/openai/v1/models', {
  headers: { 'Authorization': `Bearer ${key}` }
})
.then(res => res.json())
.then(data => {
  console.log("AVAILABLE MODELS:");
  if (data.data) {
    data.data.forEach(m => console.log(m.id));
  } else {
    console.log(data);
  }
})
.catch(console.error);
