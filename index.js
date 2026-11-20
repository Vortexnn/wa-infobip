const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const BASE_URL = 'https://eekeer.api.infobip.com';
const API_KEY = process.env.INFOBIP_API_KEY || 'd5898f2820147511f34a67760a6b72ab-2344dcab-5a30-4155-a4a5-ced58dbfed16';
const SENDER_NUMBER = '447860099299';

const chats = {};

app.post('/webhook', (req, res) => {
  const results = req.body?.results || [];
  for (const item of results) {
    const from = item.from;
    const text = item.message?.text || item.cleanText || '[Медиа или шаблон]';
    if (!from) continue;

    if (!chats[from]) chats[from] = [];
    chats[from].push({
      direction: 'in',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }
  res.sendStatus(200);
});

app.get('/api/chats', (req, res) => {
  res.json(chats);
});

app.post('/api/send', async (req, res) => {
  const { to, text } = req.body;
  const cleanPhone = String(to || '').replace(/\D/g, '');
  if (!cleanPhone || !text) {
    return res.status(400).json({ error: 'Укажите номер телефона и текст' });
  }

  try {
    const response = await fetch(`${BASE_URL}/whatsapp/1/message/text`, {
      method: 'POST',
      headers: {
        'Authorization': `App ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        from: SENDER_NUMBER,
        to: cleanPhone,
        content: { text }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    if (!chats[cleanPhone]) chats[cleanPhone] = [];
    const msg = {
      direction: 'out',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    chats[cleanPhone].push(msg);

    res.json({ ok: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Чат-панель запущена на порту ${PORT}`));
