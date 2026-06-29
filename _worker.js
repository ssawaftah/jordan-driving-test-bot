const BOT_TOKEN = "8993443266:AAFUQsnrVjRpYjox5OQoHUg_CacbuC-leek";
const FIREBASE_URL = "https://al3arbicv-default-rtdb.asia-southeast1.firebasedatabase.app";
const ADMIN_ID = 1376513623;
const APP_URL = "https://ssawaftah.github.io/jordan-driving-test-bot/";

// ============ Firebase ============
async function getWelcomeData() {
  const res = await fetch(`${FIREBASE_URL}/welcome.json`);
  return (await res.json()) || {};
}

async function saveWelcomeData(data) {
  await fetch(`${FIREBASE_URL}/welcome.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

// ============ Telegram API ============
async function tg(method, body) {
  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function sendMsg(chatId, text, kb = null) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (kb) body.reply_markup = JSON.stringify(kb);
  return tg('sendMessage', body);
}

async function sendPhoto(chatId, photo, caption, kb = null) {
  const body = { chat_id: chatId, photo, caption, parse_mode: 'HTML' };
  if (kb) body.reply_markup = JSON.stringify(kb);
  return tg('sendPhoto', body);
}

async function editMsg(chatId, msgId, text, kb = null) {
  const body = { chat_id: chatId, message_id: msgId, text, parse_mode: 'HTML' };
  if (kb) body.reply_markup = JSON.stringify(kb);
  return tg('editMessageText', body);
}

async function answerCb(cbId, text = null, alert = false) {
  return tg('answerCallbackQuery', { callback_query_id: cbId, text, show_alert: alert });
}

// ============ النص الافتراضي ============
const DEFAULT_TEXT = `أهلاً بك في بوت الفحص النظري الشامل 2026 👋

إذا كنت تستعد لتقديم اختبار القيادة النظري في الأردن، فإن دراسة المادة النظرية بشكل جيد تُعد الخطوة الأهم للنجاح في الفحص من المرة الأولى.

📘 <b>قواعد السير والمرور</b>
🔧 <b>الميكانيك</b>
🛡️ <b>السلامة على الطريق</b>
🚑 <b>الإسعافات الأولية</b>
🚸 <b>الشواخص المرورية والخطوط الأرضية</b>
⚖️ <b>المخالفات المرورية واحتساب النقاط</b>

ننصحك بدراسة جميع الأقسام جيدًا قبل الدخول إلى اختبار القيادة النظري.`;

// ============ إرسال رسالة الترحيب ============
async function sendWelcome(chatId, isAdmin) {
  const data = await getWelcomeData();
  const text = data.text || DEFAULT_TEXT;
  const photo = data.photo || null;
  
  const kb = { inline_keyboard: [] };
  
  if (!isAdmin) {
    kb.inline_keyboard.push([{ text: "📱 افتح تطبيق الدراسة", web_app: { url: APP_URL } }]);
  }
  
  if (isAdmin) {
    kb.inline_keyboard.push([{ text: "⚙️ إدارة رسالة الترحيب", callback_data: "admin_welcome" }]);
    kb.inline_keyboard.push([{ text: "🏢 إدارة مراكز التدريب", callback_data: "admin_centers" }]);
  }
  
  if (photo) {
    await sendPhoto(chatId, photo, text, kb);
  } else {
    await sendMsg(chatId, text, kb);
  }
}

// ============ handleMessage ============
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';
  const isAdmin = userId === ADMIN_ID;

  if (text === '/start' || text.startsWith('/start')) {
    if (isAdmin) {
      const kb = {
        inline_keyboard: [
          [{ text: "📱 افتح تطبيق الدراسة", web_app: { url: APP_URL } }],
          [{ text: "⚙️ إدارة رسالة الترحيب", callback_data: "admin_welcome" }],
          [{ text: "🏢 إدارة مراكز التدريب", callback_data: "admin_centers" }]
        ]
      };
      await sendMsg(chatId, "🔧 <b>لوحة تحكم المشرف</b>", kb);
      return;
    }
    await sendWelcome(chatId, false);
    return;
  }

  const s = sessions[userId];
  if (!s || !s.step) return;

  if (s.step === 'edit_text') {
    const data = await getWelcomeData();
    data.text = text;
    await saveWelcomeData(data);
    sessions[userId] = null;
    await sendMsg(chatId, "✅ <b>تم تحديث نص الترحيب بنجاح!</b>");
    return;
  }
  
  if (s.step === 'edit_photo') {
    const data = await getWelcomeData();
    data.photo = text.trim();
    await saveWelcomeData(data);
    sessions[userId] = null;
    await sendMsg(chatId, "✅ <b>تم تحديث صورة الترحيب بنجاح!</b>");
    return;
  }
}

// ============ handleCallback ============
async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const data = cb.data;
  const userId = cb.from.id;
  
  if (userId !== ADMIN_ID) {
    await answerCb(cb.id, "❌ غير مصرح", true);
    return;
  }
  
  await answerCb(cb.id);
  
  if (data === 'admin_welcome') {
    const kb = { inline_keyboard: [
      [{ text: "📝 تعديل نص الترحيب", callback_data: "edit_text" }],
      [{ text: "🖼 تعيين صورة", callback_data: "edit_photo" }],
      [{ text: "🗑 حذف الصورة", callback_data: "delete_photo" }],
      [{ text: "🔄 إعادة للنص الافتراضي", callback_data: "reset_default" }]
    ]};
    
    const wData = await getWelcomeData();
    let info = "⚙️ <b>إدارة رسالة الترحيب</b>\n\n";
    info += `📝 النص: ${wData.text ? 'مخصص' : 'افتراضي'}\n`;
    info += `🖼 الصورة: ${wData.photo ? 'موجودة' : 'لا يوجد'}\n`;
    
    await editMsg(chatId, msgId, info, kb);
    return;
  }
  
  if (data === 'admin_centers') {
    const kb = {
      inline_keyboard: [[{ text: "🚀 فتح لوحة إدارة المراكز", web_app: { url: APP_URL + "?admin=centers" } }]]
    };
    await editMsg(chatId, msgId, "ستتمكن من إضافة وتعديل وحذف المحافظات والمناطق والمراكز من خلال التطبيق.", kb);
    return;
  }
  
  if (data === 'edit_text') {
    sessions[userId] = { step: 'edit_text' };
    await editMsg(chatId, msgId, "📝 أرسل نص الترحيب الجديد:\n\n<i>يدعم تنسيق HTML</i>");
    return;
  }
  
  if (data === 'edit_photo') {
    sessions[userId] = { step: 'edit_photo' };
    await editMsg(chatId, msgId, "🖼 أرسل رابط الصورة:\n\n<i>يجب أن يكون رابط مباشر</i>");
    return;
  }
  
  if (data === 'delete_photo') {
    const wData = await getWelcomeData();
    wData.photo = null;
    await saveWelcomeData(wData);
    await editMsg(chatId, msgId, "✅ <b>تم حذف الصورة بنجاح!</b>");
    return;
  }
  
  if (data === 'reset_default') {
    await saveWelcomeData({ text: DEFAULT_TEXT, photo: null });
    await editMsg(chatId, msgId, "✅ <b>تمت إعادة النص الافتراضي بنجاح!</b>");
    return;
  }
}

const sessions = {};

// ============ نقاط نهاية REST API ============
async function handleApiRequest(path, request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = request.method !== 'GET' ? await request.json() : {};
    let result;

    // ========== المحافظات ==========
    if (path === '/api/governorates' && request.method === 'GET') {
      const res = await fetch(`${FIREBASE_URL}/governorates.json`);
      result = await res.json() || {};
    } else if (path === '/api/governorates' && request.method === 'POST') {
      const ref = await fetch(`${FIREBASE_URL}/governorates.json`, { method: 'POST', body: JSON.stringify({ name: body.name }) });
      result = await ref.json();
    } else if (path.startsWith('/api/governorates/') && request.method === 'PUT') {
      const id = path.split('/')[3];
      await fetch(`${FIREBASE_URL}/governorates/${id}.json`, { method: 'PUT', body: JSON.stringify({ name: body.name }) });
      result = { success: true };
    } else if (path.startsWith('/api/governorates/') && request.method === 'DELETE') {
      const id = path.split('/')[3];
      await fetch(`${FIREBASE_URL}/governorates/${id}.json`, { method: 'DELETE' });
      // حذف المناطق والمراكز المرتبطة
      const areasRes = await fetch(`${FIREBASE_URL}/areas.json`);
      const areas = await areasRes.json() || {};
      for (const [areaId, area] of Object.entries(areas)) {
        if (area.governorateId === id) {
          await fetch(`${FIREBASE_URL}/areas/${areaId}.json`, { method: 'DELETE' });
          const centersRes = await fetch(`${FIREBASE_URL}/centers.json`);
          const centers = await centersRes.json() || {};
          for (const [cId, c] of Object.entries(centers)) {
            if (c.areaId === areaId) await fetch(`${FIREBASE_URL}/centers/${cId}.json`, { method: 'DELETE' });
          }
        }
      }
      result = { success: true };
    }

    // ========== المناطق ==========
    else if (path === '/api/areas' && request.method === 'GET') {
      const res = await fetch(`${FIREBASE_URL}/areas.json`);
      result = await res.json() || {};
    } else if (path === '/api/areas' && request.method === 'POST') {
      const ref = await fetch(`${FIREBASE_URL}/areas.json`, { method: 'POST', body: JSON.stringify(body) });
      result = await ref.json();
    } else if (path.startsWith('/api/areas/') && request.method === 'PUT') {
      const id = path.split('/')[3];
      await fetch(`${FIREBASE_URL}/areas/${id}.json`, { method: 'PUT', body: JSON.stringify({ name: body.name, governorateId: body.governorateId }) });
      result = { success: true };
    } else if (path.startsWith('/api/areas/') && request.method === 'DELETE') {
      const id = path.split('/')[3];
      await fetch(`${FIREBASE_URL}/areas/${id}.json`, { method: 'DELETE' });
      const centersRes = await fetch(`${FIREBASE_URL}/centers.json`);
      const centers = await centersRes.json() || {};
      for (const [cId, c] of Object.entries(centers)) {
        if (c.areaId === id) await fetch(`${FIREBASE_URL}/centers/${cId}.json`, { method: 'DELETE' });
      }
      result = { success: true };
    }

    // ========== المراكز ==========
    else if (path === '/api/centers' && request.method === 'GET') {
      const res = await fetch(`${FIREBASE_URL}/centers.json`);
      result = await res.json() || {};
    } else if (path === '/api/centers' && request.method === 'POST') {
      const ref = await fetch(`${FIREBASE_URL}/centers.json`, { method: 'POST', body: JSON.stringify(body) });
      result = await ref.json();
    } else if (path.startsWith('/api/centers/') && request.method === 'PUT') {
      const id = path.split('/')[3];
      await fetch(`${FIREBASE_URL}/centers/${id}.json`, { method: 'PUT', body: JSON.stringify(body) });
      result = { success: true };
    } else if (path.startsWith('/api/centers/') && request.method === 'DELETE') {
      const id = path.split('/')[3];
      await fetch(`${FIREBASE_URL}/centers/${id}.json`, { method: 'DELETE' });
      result = { success: true };
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

// ============ التصدير ============
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/')) {
      return handleApiRequest(path, request);
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        if (body.message) await handleMessage(body.message);
        else if (body.callback_query) await handleCallback(body.callback_query);
      } catch (e) { console.error(e); }
      return new Response('OK');
    }
    
    return new Response('OK', { status: 200 });
  }
};
