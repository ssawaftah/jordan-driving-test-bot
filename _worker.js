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

// ============ تيليجرام ============
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
const DEFAULT_TEXT = `اهلا بك في بوت الفحص النظري الشامل 2026 👋

إذا كنت تستعد لتقديم اختبار القيادة النظري في الأردن فإن دراسة المادة النظرية بشكل جيد تعتبر الخطوة الأهم للنجاح في الفحص من المرة الأولى. في هذه الصفحة يمكنك مراجعة أسئلة اختبار السواقة مع الإجابات الصحيحة والشرح التوضيحي لكل سؤال لمساعدتك على فهم المادة بشكل أفضل.

تم تقسيم المادة إلى عدة أقسام رئيسية مثل قواعد السير والمرور و الميكانيك و السلامة على الطريق و الإسعافات الأولية و الشواخص المرورية والخطوط الأرضية إضافة إلى المخالفات المرورية واحتساب النقاط. يمكنك اختيار القسم الذي تريد دراسته ومراجعة الأسئلة الخاصة به خطوة بخطوة.

ننصحك بدراسة جميع الأقسام جيدًا قبل الدخول إلى اختبار القيادة النظري حتى تكون مستعدًا بشكل كامل لاجتياز الفحص النظري للسواقة بثقة ونجاح.`;

// ============ إرسال رسالة الترحيب ============
async function sendWelcome(chatId, isAdmin) {
  const data = await getWelcomeData();
  const text = data.text || DEFAULT_TEXT;
  const photo = data.photo || null;
  
  const kb = { inline_keyboard: [
    [{ text: "📱 افتح تطبيق الدراسة", web_app: { url: APP_URL } }]
  ]};
  
  if (isAdmin) {
    kb.inline_keyboard.push([{ text: "⚙️ إدارة رسالة الترحيب", callback_data: "admin_welcome" }]);
  }
  
  if (photo) {
    await sendPhoto(chatId, photo, text, kb);
  } else {
    await sendMsg(chatId, text, kb);
  }
}

// ============ جلسات المستخدم ============
const sessions = {};

// ============ handleMessage ============
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';
  const isAdmin = userId === ADMIN_ID;
  
  if (text === '/start') {
    await sendWelcome(chatId, isAdmin);
    return;
  }
  
  const s = sessions[userId];
  if (!s || !s.step) return;
  
  if (s.step === 'edit_text') {
    const data = await getWelcomeData();
    data.text = text;
    await saveWelcomeData(data);
    sessions[userId] = null;
    await sendMsg(chatId, "✅ <b>تم تحديث نص الترحيب!</b>");
    await sendWelcome(chatId, true);
    return;
  }
  
  if (s.step === 'edit_photo') {
    const data = await getWelcomeData();
    data.photo = text.trim();
    await saveWelcomeData(data);
    sessions[userId] = null;
    await sendMsg(chatId, "✅ <b>تم تحديث صورة الترحيب!</b>");
    await sendWelcome(chatId, true);
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
    await editMsg(chatId, msgId, "✅ <b>تم حذف الصورة!</b>");
    await sendWelcome(chatId, true);
    return;
  }
  
  if (data === 'reset_default') {
    await saveWelcomeData({ text: DEFAULT_TEXT, photo: null });
    await editMsg(chatId, msgId, "✅ <b>تمت إعادة النص الافتراضي!</b>");
    await sendWelcome(chatId, true);
    return;
  }
}

// ============ Export ============
export default {
  async fetch(request) {
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
