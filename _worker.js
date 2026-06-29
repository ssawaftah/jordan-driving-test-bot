const BOT_TOKEN = "8993443266:AAFUQsnrVjRpYjox5OQoHUg_CacbuC-leek";
const FIREBASE_URL = "https://al3arbicv-default-rtdb.asia-southeast1.firebasedatabase.app";
const BLOGGER_URL = "https://idriverjo.blogspot.com/p/theory-test-practice.html";
const ADMIN_ID = 1376513623;

const CATEGORIES = [
  "قواعد السير والمرور", "الميكانيك", "السلامة على الطريق",
  "أسعافات أولية", "الشواخص والخطوط والعلامات", "المخالفات واحتساب النقاط"
];

// تخزين حالة المستخدم
const sessions = {};

async function getQuestions() {
  const res = await fetch(`${FIREBASE_URL}/questions.json`);
  return (await res.json()) || {};
}

async function saveQuestion(data) {
  const res = await fetch(`${FIREBASE_URL}/questions.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function tg(method, body) {
  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function mainMsg(isAdmin) {
  return {
    text: "🚗 **اختبار الفحص النظري**\n\nدراسة مصنفة حسب أقسام المادة النظرية، اختبار محاكي قريب من التجربة الفعلية.\n\n✅ موثوق من دائرة الترخيص\n✅ محاكاة فعلية\n✅ مطابق لأسئلة الاختبار\n✅ تجربة امتحان كاملة",
    keyboard: {
      inline_keyboard: [
        [{ text: "📚 اسئلة الترخيص للفحص النظري الشامل 2026", callback_data: "categories" }],
        [{ text: "🎯 اختبار الفحص النظري", url: BLOGGER_URL }],
        ...(isAdmin ? [
          [{ text: "➕ إضافة سؤال", callback_data: "add_start" }],
          [{ text: "📊 إحصائيات", callback_data: "stats" }]
        ] : [])
      ]
    }
  };
}

async function showCategories(chatId, msgId) {
  const kb = { inline_keyboard: [] };
  CATEGORIES.forEach((c, i) => kb.inline_keyboard.push([{ text: `${i+1}. ${c}`, callback_data: `study_${i}` }]));
  kb.inline_keyboard.push([{ text: "⬅️ الرجوع", callback_data: "start" }]);
  
  await tg('editMessageText', {
    chat_id: chatId, message_id: msgId,
    text: "📂 **اختر القسم:**", parse_mode: 'Markdown',
    reply_markup: JSON.stringify(kb)
  });
}

async function showQuestion(chatId, msgId, userId) {
  const s = sessions[userId];
  if (!s || !s.questions || s.questions.length === 0) {
    const kb = { inline_keyboard: [[{ text: "⬅️ الرجوع", callback_data: "categories" }]] };
    await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: "❌ لا توجد أسئلة.", reply_markup: JSON.stringify(kb), parse_mode: 'Markdown' });
    return;
  }
  
  if (s.index >= s.questions.length) {
    const kb = {
      inline_keyboard: [
        [{ text: "🧪 اختبار هذا القسم", url: BLOGGER_URL }],
        [{ text: "📂 الأقسام", callback_data: "categories" }],
        [{ text: "🏠 الرئيسية", callback_data: "start" }]
      ]
    };
    await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: "✅ **انتهت الأسئلة!**", reply_markup: JSON.stringify(kb), parse_mode: 'Markdown' });
    return;
  }
  
  const q = s.questions[s.index];
  const total = s.questions.length;
  let txt = `📝 **السؤال ${s.index + 1} من ${total}**\n\n*${q.question}*`;
  if (q.mediaUrl && q.mediaType === 'image') txt += `\n\n🖼 [الصورة](${q.mediaUrl})`;
  
  const kb = { inline_keyboard: [] };
  q.options.forEach((opt, i) => {
    const pre = i === q.correctAnswer ? "✅ " : "";
    kb.inline_keyboard.push([{ text: `${pre}${i+1}. ${opt}`, callback_data: `ans_${i}` }]);
  });
  
  const nav = [];
  if (s.index > 0) nav.push({ text: "◀ السابق", callback_data: "prev" });
  if (s.index < total - 1) nav.push({ text: "التالي ▶", callback_data: "next" });
  if (nav.length) kb.inline_keyboard.push(nav);
  
  kb.inline_keyboard.push([{ text: "🚪 إنهاء المراجعة", callback_data: "start" }]);
  
  await tg('editMessageText', {
    chat_id: chatId, message_id: msgId,
    text: txt, parse_mode: 'Markdown',
    reply_markup: JSON.stringify(kb), disable_web_page_preview: true
  });
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';
  const isAdmin = userId === ADMIN_ID;
  
  if (text === '/start') {
    const m = mainMsg(isAdmin);
    await tg('sendMessage', {
      chat_id: chatId, text: m.text, parse_mode: 'Markdown',
      reply_markup: JSON.stringify(m.keyboard)
    });
    sessions[userId] = null;
    return;
  }
  
  // خطوات إضافة سؤال
  const s = sessions[userId];
  if (s && s.step) {
    if (s.step === 'add_q') {
      s.question = text;
      s.step = 'add_opt';
      await tg('sendMessage', { chat_id: chatId, text: "✅ أرسل 4 خيارات (كل خيار في سطر):" });
      return;
    }
    if (s.step === 'add_opt') {
      const opts = text.split('\n').filter(o => o.trim());
      if (opts.length !== 4) {
        await tg('sendMessage', { chat_id: chatId, text: "❌ 4 خيارات فقط!" });
        return;
      }
      s.options = opts;
      s.step = 'add_ans';
      const kb = { inline_keyboard: opts.map((o, i) => [{ text: `${i+1}. ${o.substring(0,30)}`, callback_data: `addans_${i}` }]) };
      await tg('sendMessage', { chat_id: chatId, text: "اختر الإجابة الصحيحة:", reply_markup: JSON.stringify(kb) });
      return;
    }
    if (s.step === 'add_exp') {
      const exp = text === '/skip' ? '' : text;
      const data = {
        category: s.category, question: s.question,
        options: s.options, correctAnswer: s.correctAnswer,
        explanation: exp, mediaUrl: null, mediaType: 'text',
        createdAt: new Date().toISOString()
      };
      await saveQuestion(data);
      sessions[userId] = null;
      const m = mainMsg(isAdmin);
      await tg('sendMessage', { chat_id: chatId, text: `🎉 **تم الحفظ!**\n📂 ${s.category}\n📝 ${s.question.substring(0,50)}...`, parse_mode: 'Markdown' });
      await tg('sendMessage', { chat_id: chatId, text: m.text, parse_mode: 'Markdown', reply_markup: JSON.stringify(m.keyboard) });
      return;
    }
  }
}

async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const data = cb.data;
  const userId = cb.from.id;
  const isAdmin = userId === ADMIN_ID;
  
  await tg('answerCallbackQuery', { callback_query_id: cb.id });
  
  // الرجوع للرئيسية
  if (data === 'start') {
    const m = mainMsg(isAdmin);
    await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: m.text, parse_mode: 'Markdown', reply_markup: JSON.stringify(m.keyboard) });
    sessions[userId] = null;
    return;
  }
  
  // قائمة الأقسام
  if (data === 'categories') {
    await showCategories(chatId, msgId);
    return;
  }
  
  // بدء دراسة قسم
  if (data.startsWith('study_')) {
    const ci = parseInt(data.split('_')[1]);
    const cat = CATEGORIES[ci];
    const all = await getQuestions();
    const qs = Object.entries(all).filter(([_, q]) => q.category === cat).map(([id, q]) => ({ id, ...q }));
    
    if (qs.length === 0) {
      const kb = { inline_keyboard: [[{ text: "⬅️ الرجوع", callback_data: "categories" }]] };
      await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: `❌ لا توجد أسئلة في *${cat}*`, reply_markup: JSON.stringify(kb), parse_mode: 'Markdown' });
      return;
    }
    
    sessions[userId] = { questions: qs, index: 0, category: cat };
    await showQuestion(chatId, msgId, userId);
    return;
  }
  
  // التنقل
  if (data === 'prev' || data === 'next') {
    const s = sessions[userId];
    if (s) {
      if (data === 'prev' && s.index > 0) s.index--;
      if (data === 'next' && s.index < s.questions.length - 1) s.index++;
      await showQuestion(chatId, msgId, userId);
    }
    return;
  }
  
  // الضغط على إجابة
  if (data.startsWith('ans_')) {
    const s = sessions[userId];
    if (s && s.questions && s.index < s.questions.length) {
      const q = s.questions[s.index];
      const ai = parseInt(data.split('_')[1]);
      const correct = ai === q.correctAnswer;
      await tg('answerCallbackQuery', { callback_query_id: cb.id, text: correct ? "✅ صحيح!" : "❌ خطأ", show_alert: true });
      if (q.explanation) {
        await tg('sendMessage', { chat_id: chatId, text: `💡 *شرح:* ${q.explanation}`, parse_mode: 'Markdown' });
      }
    }
    return;
  }
  
  // إحصائيات
  if (data === 'stats' && isAdmin) {
    const all = await getQuestions();
    const total = Object.keys(all).length;
    const cats = {};
    Object.values(all).forEach(q => { const c = q.category || 'غير محدد'; cats[c] = (cats[c] || 0) + 1; });
    let txt = `📊 **الإحصائيات**\n\n📝 المجموع: ${total}\n`;
    Object.entries(cats).forEach(([c, n]) => txt += `• ${c}: ${n}\n`);
    const kb = { inline_keyboard: [[{ text: "⬅️ الرجوع", callback_data: "start" }]] };
    await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: txt, reply_markup: JSON.stringify(kb), parse_mode: 'Markdown' });
    return;
  }
  
  // بدء إضافة سؤال
  if (data === 'add_start' && isAdmin) {
    const kb = { inline_keyboard: CATEGORIES.map((c, i) => [{ text: c, callback_data: `addcat_${i}` }]) };
    kb.inline_keyboard.push([{ text: "❌ إلغاء", callback_data: "start" }]);
    await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: "📝 اختر القسم:", reply_markup: JSON.stringify(kb), parse_mode: 'Markdown' });
    return;
  }
  
  // اختيار القسم للإضافة
  if (data.startsWith('addcat_') && isAdmin) {
    const ci = parseInt(data.split('_')[1]);
    sessions[userId] = { step: 'add_q', category: CATEGORIES[ci] };
    await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: `✅ *${CATEGORIES[ci]}*\n\nأرسل نص السؤال:`, parse_mode: 'Markdown' });
    return;
  }
  
  // اختيار الإجابة الصحيحة
  if (data.startsWith('addans_') && isAdmin) {
    const s = sessions[userId];
    if (s && s.step === 'add_ans') {
      s.correctAnswer = parseInt(data.split('_')[1]);
      s.step = 'add_exp';
      await tg('editMessageText', { chat_id: chatId, message_id: msgId, text: "✅ أرسل شرح الإجابة (أو /skip):", parse_mode: 'Markdown' });
    }
    return;
  }
}

export default {
  async fetch(request) {
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        if (body.message) await handleMessage(body.message);
        else if (body.callback_query) await handleCallback(body.callback_query);
      } catch (e) {
        console.error(e);
      }
      return new Response('OK');
    }
    return new Response('Bot Running 🚗', { status: 200 });
  }
};
