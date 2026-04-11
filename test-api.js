const token = 'fake-token';
fetch('https://prova-max.vercel.app/api/generate-flashcard', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ question_id: 'test' })
}).then(async r => {
  console.log('Status:', r.status);
  console.log('Body:', await r.text());
});
