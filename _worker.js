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
  }
  
  if (photo) {
    await sendPhoto(chatId, photo, text, kb);
  } else {
    await sendMsg(chatId, text, kb);
  }
}

// ============ دوال رمز التحقق ============
async function sendVerificationCode(userId, phone) {
  try {
    await tg('sendChatAction', { chat_id: userId, action: 'typing' });
  } catch (e) {
    return { success: false, error: "عذراً، لا يمكن التواصل مع حسابك. تأكد من أنك بدأت محادثة مع البوت بالضغط على /start." };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  
  // تخزين بيانات التحقق المؤقتة
  await fetch(`${FIREBASE_URL}/pendingVerifications/${userId}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, phone, expiresAt })
  });

  // إرسال رسالة للمستخدم تحتوي على الرمز
  await sendMsg(userId, `🔐 <b>رمز التحقق:</b> <code>${code}</code>\n\nجاري التحقق تلقائياً... إذا لم يكتمل، استخدم هذا الرمز.`);

  return { success: true };
}

async function verifyCode(userId, code) {
  const ref = await fetch(`${FIREBASE_URL}/pendingVerifications/${userId}.json`);
  const data = await ref.json();
  if (!data) return { success: false, error: "لم يتم طلب رمز تحقق." };
  if (Date.now() > data.expiresAt) {
    await fetch(`${FIREBASE_URL}/pendingVerifications/${userId}.json`, { method: 'DELETE' });
    return { success: false, error: "انتهت صلاحية الرمز. اطلب رمزاً جديداً." };
  }
  if (data.code !== code) return { success: false, error: "الرمز غير صحيح." };
  
  // حفظ رقم الهاتف في بيانات المستخدم
  await fetch(`${FIREBASE_URL}/users/${userId}/phone.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data.phone)
  });

  // حذف التحقق المؤقت
  await fetch(`${FIREBASE_URL}/pendingVerifications/${userId}.json`, { method: 'DELETE' });

  // إرسال رسالة تأكيد للمستخدم في البوت
  await sendMsg(userId, "✅ <b>تم التحقق من رقم هاتفك بنجاح!</b>");

  return { success: true, phone: data.phone };
}

// ============ handleMessage ============
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';
  const isAdmin = userId === ADMIN_ID;

  if (msg.contact) {
    const phone = msg.contact.phone_number;
    await fetch(`${FIREBASE_URL}/users/${userId}/phone.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(phone)
    });
    const backKeyboard = {
      inline_keyboard: [[{ text: "✅ العودة للتطبيق", web_app: { url: APP_URL } }]]
    };
    await sendMsg(chatId, "✅ تم استلام رقم هاتفك بنجاح! يمكنك العودة للتطبيق الآن.", backKeyboard);
    return;
  }

  if (text === '/start' || text.startsWith('/start')) {
    if (text.includes('share_phone')) {
      const requestKeyboard = {
        keyboard: [[{ text: "📱 مشاركة رقم الهاتف", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      };
      await sendMsg(chatId, "للتحقق من هويتك، الرجاء مشاركة رقم هاتفك:", requestKeyboard);
      return;
    }
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

// ============ التصدير ============
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === 'POST' && url.pathname === '/send-code') {
      try {
        const { userId, phone } = await request.json();
        const result = await sendVerificationCode(userId, phone);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/verify-code') {
      try {
        const { userId, code } = await request.json();
        const result = await verifyCode(userId, code);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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
