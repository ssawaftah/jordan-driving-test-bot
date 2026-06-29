// ============ Cloudflare Worker - تيليجرام بوت ============

const BOT_TOKEN = "8993443266:AAFUQsnrVjRpYjox5OQoHUg_CacbuC-leek";
const FIREBASE_URL = "https://al3arbicv-default-rtdb.asia-southeast1.firebasedatabase.app";
const BLOGGER_URL = "https://idriverjo.blogspot.com/p/theory-test-practice.html";
const ADMIN_ID = 1376513623;

const CATEGORIES = [
  "قواعد السير والمرور",
  "الميكانيك", 
  "السلامة على الطريق",
  "أسعافات أولية",
  "الشواخص والخطوط والعلامات",
  "المخالفات واحتساب النقاط"
];

// ============ تخزين حالة المستخدم في KV ============
// سنستخدم متغير عام بسيط (للتجربة) ثم نطور لـ KV

// ============ دوال Firebase ============
async function getQuestions() {
  const res = await fetch(`${FIREBASE_URL}/questions.json`);
  return res.json() || {};
}

async function saveQuestion(data) {
  const res = await fetch(`${FIREBASE_URL}/questions.json`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return res.json();
}

// ============ دوال تيليجرام ============
async function sendMessage(chatId, text, keyboard = null) {
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  };
  
  if (keyboard) {
    body.reply_markup = JSON.stringify(keyboard);
  }
  
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function editMessage(chatId, messageId, text, keyboard = null) {
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  };
  
  if (keyboard) {
    body.reply_markup = JSON.stringify(keyboard);
  }
  
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function answerCallback(callbackId, text = null, showAlert = false) {
  const body = { callback_query_id: callbackId };
  if (text) {
    body.text = text;
    body.show_alert = showAlert;
  }
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// ============ كيبوردات ============
function mainKeyboard(isAdmin) {
  const keyboard = {
    inline_keyboard: [
      [{ text: "📚 اسئلة الترخيص للفحص النظري الشامل 2026", callback_data: "menu_categories" }],
      [{ text: "🎯 اختبار الفحص النظري", url: BLOGGER_URL }]
    ]
  };
  
  if (isAdmin) {
    keyboard.inline_keyboard.push([{ text: "➕ إضافة سؤال", callback_data: "admin_add" }]);
    keyboard.inline_keyboard.push([{ text: "📊 إحصائيات", callback_data: "admin_stats" }]);
  }
  
  return keyboard;
}

// ============ معالج الرسائل ============
async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const userId = message.from.id;
  const isAdmin = userId === ADMIN_ID;
  
  if (text === '/start') {
    const msg = `🚗 **اختبار الفحص النظري**\n\nدراسة مصنفة حسب أقسام المادة النظرية، اختبار محاكي قريب من التجربة الفعلية.\n\n✅ موثوق من دائرة الترخيص\n✅ محاكاة فعلية\n✅ مطابق لأسئلة الاختبار\n✅ تجربة امتحان كاملة`;
    await sendMessage(chatId, msg, mainKeyboard(isAdmin));
  }
}

// ============ معالج الأزرار ============
async function handleCallback(callback) {
  const chatId = callback.message.chat.id;
  const messageId = callback.message.message_id;
  const data = callback.data;
  const userId = callback.from.id;
  const isAdmin = userId === ADMIN_ID;
  
  // الرجوع للرئيسية
  if (data === 'start') {
    const msg = `🚗 **اختبار الفحص النظري**\n\nدراسة مصنفة حسب أقسام المادة النظرية، اختبار محاكي قريب من التجربة الفعلية.\n\n✅ موثوق من دائرة الترخيص\n✅ محاكاة فعلية\n✅ مطابق لأسئلة الاختبار\n✅ تجربة امتحان كاملة`;
    await editMessage(chatId, messageId, msg, mainKeyboard(isAdmin));
    await answerCallback(callback.id);
    return;
  }
  
  // قائمة الأقسام
  if (data === 'menu_categories') {
    const keyboard = { inline_keyboard: [] };
    CATEGORIES.forEach((cat, i) => {
      keyboard.inline_keyboard.push([{ text: `${i+1}. ${cat}`, callback_data: `study_${i}` }]);
    });
    keyboard.inline_keyboard.push([{ text: "⬅️ الرجوع للرئيسية", callback_data: "start" }]);
    
    await editMessage(chatId, messageId, "📂 **اختر القسم:**", keyboard);
    await answerCallback(callback.id);
    return;
  }
  
  // بدء الدراسة
  if (data.startsWith('study_')) {
    const catIndex = parseInt(data.split('_')[1]);
    const category = CATEGORIES[catIndex];
    const questions = await getQuestions();
    
    const studyQs = [];
    for (const [id, q] of Object.entries(questions)) {
      if (q.category === category) {
        studyQs.push({ id, ...q });
      }
    }
    
    if (studyQs.length === 0) {
      const keyboard = { inline_keyboard: [[{ text: "⬅️ الرجوع", callback_data: "menu_categories" }]] };
      await editMessage(chatId, messageId, `❌ لا توجد أسئلة في *${category}*`, keyboard);
      await answerCallback(callback.id);
      return;
    }
    
    // حفظ حالة المستخدم (بسيط - في الذاكرة)
    // سنطور هذا لاحقاً باستخدام KV
    
    const q = studyQs[0];
    const msg = `📝 **السؤال 1 من ${studyQs.length}**\n\n*${q.question}*`;
    
    const keyboard = { inline_keyboard: [] };
    q.options.forEach((opt, i) => {
      const prefix = i === q.correctAnswer ? "✅ " : "";
      keyboard.inline_keyboard.push([{ text: `${prefix}${i+1}. ${opt}`, callback_data: `ans_${i}` }]);
    });
    keyboard.inline_keyboard.push([{ text: "التالي ▶", callback_data: "next_q" }]);
    keyboard.inline_keyboard.push([{ text: "🚪 إنهاء المراجعة", callback_data: "start" }]);
    
    await editMessage(chatId, messageId, msg, keyboard);
    await answerCallback(callback.id);
    return;
  }
  
  // الضغط على إجابة
  if (data.startsWith('ans_')) {
    await answerCallback(callback.id, "تم استلام إجابتك", true);
    return;
  }
  
  // إحصائيات الأدمن
  if (data === 'admin_stats' && isAdmin) {
    const questions = await getQuestions();
    const total = Object.keys(questions).length;
    
    let msg = `📊 **الإحصائيات**\n\n📝 المجموع: ${total} سؤال`;
    const keyboard = { inline_keyboard: [[{ text: "⬅️ الرجوع", callback_data: "start" }]] };
    
    await editMessage(chatId, messageId, msg, keyboard);
    await answerCallback(callback.id);
    return;
  }
  
  // الافتراضي
  await answerCallback(callback.id);
}

// ============ المدخل الرئيسي ============
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        
        if (body.message) {
          await handleMessage(body.message);
        } else if (body.callback_query) {
          await handleCallback(body.callback_query);
        }
        
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error(error);
        return new Response('Error', { status: 500 });
      }
    }
    
    return new Response('Bot is running!', { status: 200 });
  }
};
