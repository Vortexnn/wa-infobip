const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const BASE_URL = 'https://eekeer.api.infobip.com';
const API_KEY = process.env.INFOBIP_API_KEY || '8cb38986fd891f66cedf5dab6748aaf4-1c26c521-bdd1-4c2f-afe3-8fbcfa1eca4d';
const SENDER_NUMBER = process.env.INFOBIP_SENDER || '447860088970';

const chats = {};

app.post('/webhook', (req, res) => {
  const results = req.body && req.body.results ? req.body.results : [];
  for (const item of results) {
    const from = item.from;
    const text = (item.message && item.message.text) || item.cleanText || '[Медиа или шаблон]';
    if (!from) continue;

    if (!chats[from]) chats[from] = [];
    chats[from].push({
      direction: 'in',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }
  res.sendStatus(200);
});

app.get('/api/chats', (req, res) => {
  res.json(chats);
});

app.post('/api/send', async (req, res) => {
  const { to, text, mode, placeholder } = req.body;
  const cleanPhone = String(to || '').replace(/\D/g, '');
  if (!cleanPhone) {
    return res.status(400).json({ error: 'Укажите номер телефона' });
  }

  const isTemplate = mode === 'template' || String(text || '').trim().startsWith('/template');
  if (!isTemplate && !String(text || '').trim()) {
    return res.status(400).json({ error: 'Введите текст сообщения' });
  }

  try {
    let endpoint = `${BASE_URL}/whatsapp/1/message/text`;
    let payload = {
      from: SENDER_NUMBER,
      to: cleanPhone,
      content: { text: String(text).trim() }
    };
    let displayText = String(text).trim();

    if (isTemplate) {
      const argText = String(text || '').replace(/^\/template\s*/i, '').trim();
      const nameValue = (placeholder || argText || 'Lucia').trim();
      endpoint = `${BASE_URL}/whatsapp/1/message/template`;
      payload = {
        messages: [
          {
            from: SENDER_NUMBER,
            to: cleanPhone,
            messageId: crypto.randomUUID(),
            content: {
              templateName: 'test_whatsapp_template_en',
              templateData: {
                body: {
                  placeholders: [nameValue]
                }
              },
              language: 'en'
            }
          }
        ]
      };
      displayText = `[Шаблон test_whatsapp_template_en: ${nameValue}]`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `App ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    if (!chats[cleanPhone]) chats[cleanPhone] = [];
    const msg = {
      direction: 'out',
      text: displayText,
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
