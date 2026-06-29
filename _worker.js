const BOT_TOKEN = "8993443266:AAFUQsnrVjRpYjox5OQoHUg_CacbuC-leek";
const FIREBASE_URL = "https://al3arbicv-default-rtdb.asia-southeast1.firebasedatabase.app";
const BLOGGER_URL = "https://idriverjo.blogspot.com/p/theory-test-practice.html";
const ADMIN_ID = 1376513623;

const CATEGORIES = [
  "قواعد السير والمرور", "الميكانيك", "السلامة على الطريق",
  "أسعافات أولية", "الشواخص والخطوط والعلامات", "المخالفات واحتساب النقاط"
];

const sessions = {};

// ============ Firebase ============
async function getQuestions() {
  const res = await fetch(`${FIREBASE_URL}/questions.json`);
  return (await res.json()) || {};
}

async function saveQuestion(data) {
  const res = await fetch(`${FIREBASE_URL}/questions.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  });
  return res.json();
}

async function updateQuestion(id, data) {
  const res = await fetch(`${FIREBASE_URL}/questions/${id}.json`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  });
  return res.json();
}

async function deleteQuestion(id) {
  await fetch(`${FIREBASE_URL}/questions/${id}.json`, { method: 'DELETE' });
}

// ============ تيليجرام API ============
async function tg(method, body) {
  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

async function sendMsg(chatId, text, kb = null) {
  const body = { chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true };
  if (kb) body.reply_markup = JSON.stringify(kb);
  return tg('sendMessage', body);
}

async function editMsg(chatId, msgId, text, kb = null) {
  const body = { chat_id: chatId, message_id: msgId, text, parse_mode: 'Markdown', disable_web_page_preview: true };
  if (kb) body.reply_markup = JSON.stringify(kb);
  return tg('editMessageText', body);
}

async function answerCb(cbId, text = null, alert = false) {
  return tg('answerCallbackQuery', { callback_query_id: cbId, text, show_alert: alert });
}

async function deleteMsg(chatId, msgId) {
  try { await tg('deleteMessage', { chat_id: chatId, message_id: msgId }); } catch(e) {}
}

// ============ لوحة المفاتيح الرئيسية ============
function mainKb(isAdmin) {
  const kb = { inline_keyboard: [
    [{ text: "📚 اسئلة الترخيص للفحص النظري الشامل 2026", callback_data: "categories" }],
    [{ text: "🎯 اختبار الفحص النظري", url: BLOGGER_URL }]
  ]};
  if (isAdmin) {
    kb.inline_keyboard.push([{ text: "⚙️ إدارة الأسئلة", callback_data: "admin_menu" }]);
  }
  return kb;
}

function mainText() {
  return "🚗 **اختبار الفحص النظري**\n\nدراسة مصنفة حسب أقسام المادة النظرية، اختبار محاكي قريب من التجربة الفعلية.\n\n✅ موثوق من دائرة الترخيص\n✅ محاكاة فعلية\n✅ مطابق لأسئلة الاختبار\n✅ تجربة امتحان كاملة";
}

// ============ عرض الأسئلة ============
async function showQuestion(chatId, msgId, userId, edit = true) {
  const s = sessions[userId];
  if (!s || !s.qs || s.qs.length === 0) {
    const kb = { inline_keyboard: [[{ text: "⬅️ الرجوع", callback_data: "categories" }]] };
    if (edit) await editMsg(chatId, msgId, "❌ لا توجد أسئلة في هذا القسم.", kb);
    else await sendMsg(chatId, "❌ لا توجد أسئلة في هذا القسم.", kb);
    return;
  }
  
  if (s.idx >= s.qs.length) {
    const kb = { inline_keyboard: [
      [{ text: "🧪 اختبار هذا القسم", url: BLOGGER_URL }],
      [{ text: "📂 الأقسام", callback_data: "categories" }],
      [{ text: "🏠 الرئيسية", callback_data: "start" }]
    ]};
    if (edit) await editMsg(chatId, msgId, "✅ **انتهت الأسئلة!**", kb);
    else await sendMsg(chatId, "✅ **انتهت الأسئلة!**", kb);
    return;
  }
  
  const q = s.qs[s.idx];
  const total = s.qs.length;
  let txt = `📝 **السؤال ${s.idx + 1} من ${total}**\n\n*${q.question}*`;
  
  // إظهار الصورة إذا وجدت
  if (q.mediaUrl && q.mediaType === 'image') {
    txt += `\n\n🖼 [اضغط لمشاهدة الصورة](${q.mediaUrl})`;
  }
  
  const kb = { inline_keyboard: [] };
  q.options.forEach((opt, i) => {
    const pre = i === q.correctAnswer ? "✅ " : "";
    kb.inline_keyboard.push([{ text: `${pre}${i+1}. ${opt}`, callback_data: `ans_${i}` }]);
  });
  
  const nav = [];
  if (s.idx > 0) nav.push({ text: "◀ السابق", callback_data: "prev" });
  if (s.idx < total - 1) nav.push({ text: "التالي ▶", callback_data: "next" });
  if (nav.length) kb.inline_keyboard.push(nav);
  
  kb.inline_keyboard.push([{ text: "🚪 إنهاء المراجعة", callback_data: "start" }]);
  
  if (edit) await editMsg(chatId, msgId, txt, kb);
  else await sendMsg(chatId, txt, kb);
}

// ============ handleMessage ============
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';
  const isAdmin = userId === ADMIN_ID;
  
  if (text === '/start') {
    sessions[userId] = null;
    await sendMsg(chatId, mainText(), mainKb(isAdmin));
    return;
  }
  
  const s = sessions[userId];
  if (!s || !s.step) return;
  
  // === خطوات إضافة سؤال ===
  if (s.step === 'add_q') {
    s.question = text;
    // سؤال عن الوسائط
    const kb = { inline_keyboard: [
      [{ text: "✅ نعم", callback_data: "addmedia_yes" }, { text: "❌ لا", callback_data: "addmedia_no" }]
    ]};
    await sendMsg(chatId, "🖼 هل يحتوي السؤال على وسائط (صورة/فيديو/GIF)؟", kb);
    s.step = 'add_media_q';
    return;
  }
  
  if (s.step === 'add_media') {
    // استلام رابط الوسائط
    let mediaUrl = text.trim();
    let mediaType = 'image';
    if (mediaUrl.endsWith('.mp4') || mediaUrl.includes('video')) mediaType = 'video';
    else if (mediaUrl.endsWith('.gif')) mediaType = 'gif';
    
    s.mediaUrl = mediaUrl;
    s.mediaType = mediaType;
    s.step = 'add_opt';
    await sendMsg(chatId, "✅ تم استلام الوسائط.\n\nالآن أرسل الخيارات (كل خيار في سطر):\n\n*لا يوجد عدد محدد من الخيارات*");
    return;
  }
  
  if (s.step === 'add_opt') {
    const opts = text.split('\n').filter(o => o.trim());
    if (opts.length < 2) {
      await sendMsg(chatId, "❌ يجب أن يكون هناك خياران على الأقل!");
      return;
    }
    s.options = opts;
    s.step = 'add_ans';
    const kb = { inline_keyboard: opts.map((o, i) => [{ text: `${i+1}. ${o.substring(0,35)}`, callback_data: `addans_${i}` }]) };
    kb.inline_keyboard.push([{ text: "❌ إلغاء", callback_data: "start" }]);
    await sendMsg(chatId, "اختر الإجابة الصحيحة:", kb);
    return;
  }
  
  if (s.step === 'add_exp') {
    const exp = text === '/skip' ? '' : text;
    const data = {
      category: s.category, question: s.question, options: s.options,
      correctAnswer: s.correctAnswer, explanation: exp,
      mediaUrl: s.mediaUrl || null, mediaType: s.mediaType || 'text',
      createdAt: new Date().toISOString()
    };
    const result = await saveQuestion(data);
    sessions[userId] = null;
    await sendMsg(chatId, `🎉 **تم حفظ السؤال!**\n📂 ${s.category}\n📝 ${s.question.substring(0,50)}...\n🆔 ${result.name || ''}`);
    await sendMsg(chatId, mainText(), mainKb(isAdmin));
    return;
  }
  
  // === خطوات تعديل سؤال ===
  if (s.step === 'edit_q') {
    const id = s.editId;
    await updateQuestion(id, { question: text });
    await sendMsg(chatId, "✅ تم تعديل السؤال!");
    sessions[userId] = null;
    await sendMsg(chatId, mainText(), mainKb(isAdmin));
    return;
  }
  
  if (s.step === 'edit_media') {
    let mediaUrl = text.trim();
    let mediaType = 'image';
    if (mediaUrl.endsWith('.mp4') || mediaUrl.includes('video')) mediaType = 'video';
    else if (mediaUrl.endsWith('.gif')) mediaType = 'gif';
    
    await updateQuestion(s.editId, { mediaUrl, mediaType });
    await sendMsg(chatId, "✅ تم تحديث الوسائط!");
    sessions[userId] = null;
    await sendMsg(chatId, mainText(), mainKb(isAdmin));
    return;
  }
  
  if (s.step === 'edit_exp') {
    const exp = text === '/skip' ? '' : text;
    await updateQuestion(s.editId, { explanation: exp });
    await sendMsg(chatId, "✅ تم تحديث الشرح!");
    sessions[userId] = null;
    await sendMsg(chatId, mainText(), mainKb(isAdmin));
    return;
  }
  
  if (s.step === 'edit_opt') {
    const opts = text.split('\n').filter(o => o.trim());
    if (opts.length < 2) {
      await sendMsg(chatId, "❌ خياران على الأقل!");
      return;
    }
    s.editOpts = opts;
    s.step = 'edit_ans';
    const kb = { inline_keyboard: opts.map((o, i) => [{ text: `${i+1}. ${o.substring(0,35)}`, callback_data: `editans_${i}` }]) };
    await sendMsg(chatId, "اختر الإجابة الصحيحة الجديدة:", kb);
    return;
  }
  
  // === تعيين صورة افتراضية ===
  if (s.step === 'default_img') {
    let mediaUrl = text.trim();
    let mediaType = 'image';
    if (mediaUrl.endsWith('.mp4') || mediaUrl.includes('video')) mediaType = 'video';
    else if (mediaUrl.endsWith('.gif')) mediaType = 'gif';
    
    await updateQuestion(s.editId, { mediaUrl, mediaType });
    await sendMsg(chatId, "✅ تم تعيين الصورة الافتراضية!");
    sessions[userId] = null;
    await sendMsg(chatId, mainText(), mainKb(isAdmin));
    return;
  }
}

// ============ handleCallback ============
async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const data = cb.data;
  const userId = cb.from.id;
  const isAdmin = userId === ADMIN_ID;
  
  await answerCb(cb.id);
  
  // ========== الرئيسية ==========
  if (data === 'start') {
    sessions[userId] = null;
    await editMsg(chatId, msgId, mainText(), mainKb(isAdmin));
    return;
  }
  
  // ========== قائمة الأقسام ==========
  if (data === 'categories') {
    const kb = { inline_keyboard: [] };
    CATEGORIES.forEach((c, i) => kb.inline_keyboard.push([{ text: `${i+1}. ${c}`, callback_data: `study_${i}` }]));
    kb.inline_keyboard.push([{ text: "⬅️ الرجوع", callback_data: "start" }]);
    await editMsg(chatId, msgId, "📂 **اختر القسم:**", kb);
    return;
  }
  
  // ========== دراسة ==========
  if (data.startsWith('study_')) {
    const ci = parseInt(data.split('_')[1]);
    const cat = CATEGORIES[ci];
    const all = await getQuestions();
    const qs = Object.entries(all).filter(([_, q]) => q.category === cat).map(([id, q]) => ({ id, ...q }));
    
    if (qs.length === 0) {
      const kb = { inline_keyboard: [[{ text: "⬅️ الرجوع", callback_data: "categories" }]] };
      await editMsg(chatId, msgId, `❌ لا توجد أسئلة في *${cat}*`, kb);
      return;
    }
    
    sessions[userId] = { qs, idx: 0, category: cat };
    await showQuestion(chatId, msgId, userId);
    return;
  }
  
  // ========== التنقل ==========
  if (data === 'prev' || data === 'next') {
    const s = sessions[userId];
    if (s && s.qs) {
      if (data === 'prev' && s.idx > 0) s.idx--;
      if (data === 'next' && s.idx < s.qs.length - 1) s.idx++;
      await showQuestion(chatId, msgId, userId);
    }
    return;
  }
  
  // ========== الضغط على إجابة ==========
  if (data.startsWith('ans_')) {
    const s = sessions[userId];
    if (s && s.qs && s.idx < s.qs.length) {
      const q = s.qs[s.idx];
      const ai = parseInt(data.split('_')[1]);
      const correct = ai === q.correctAnswer;
      await answerCb(cb.id, correct ? "✅ صحيح!" : "❌ خطأ", true);
      if (q.explanation) {
        await sendMsg(chatId, `💡 *شرح:* ${q.explanation}`);
      }
    }
    return;
  }
  
  // ========== قائمة الإدارة ==========
  if (data === 'admin_menu' && isAdmin) {
    const kb = { inline_keyboard: [
      [{ text: "➕ إضافة سؤال", callback_data: "add_start" }],
      [{ text: "📋 عرض الأسئلة", callback_data: "admin_list_cats" }],
      [{ text: "🖼 تعيين صورة افتراضية", callback_data: "admin_default_img" }],
      [{ text: "📊 إحصائيات", callback_data: "stats" }],
      [{ text: "⬅️ الرجوع", callback_data: "start" }]
    ]};
    await editMsg(chatId, msgId, "⚙️ **إدارة الأسئلة**\n\nاختر العملية:", kb);
    return;
  }
  
  // ========== بدء إضافة سؤال ==========
  if (data === 'add_start' && isAdmin) {
    const kb = { inline_keyboard: CATEGORIES.map((c, i) => [{ text: c, callback_data: `addcat_${i}` }]) };
    kb.inline_keyboard.push([{ text: "❌ إلغاء", callback_data: "admin_menu" }]);
    await editMsg(chatId, msgId, "📝 **إضافة سؤال جديد**\n\nاختر القسم:", kb);
    return;
  }
  
  // ========== اختيار القسم ==========
  if (data.startsWith('addcat_') && isAdmin) {
    const ci = parseInt(data.split('_')[1]);
    sessions[userId] = { step: 'add_q', category: CATEGORIES[ci] };
    await editMsg(chatId, msgId, `✅ القسم: *${CATEGORIES[ci]}*\n\nأرسل نص السؤال:`);
    return;
  }
  
  // ========== هل يحتوي على وسائط ==========
  if (data === 'addmedia_yes' && isAdmin) {
    const s = sessions[userId];
    if (s) {
      s.step = 'add_media';
      await editMsg(chatId, msgId, "🖼 أرسل رابط الوسائط (صورة/فيديو/GIF):\n\n*مثال:* `https://example.com/image.jpg`");
    }
    return;
  }
  
  if (data === 'addmedia_no' && isAdmin) {
    const s = sessions[userId];
    if (s) {
      s.mediaUrl = null;
      s.mediaType = 'text';
      s.step = 'add_opt';
      await editMsg(chatId, msgId, "✅ أرسل الخيارات (كل خيار في سطر):\n\n*لا يوجد عدد محدد من الخيارات*");
    }
    return;
  }
  
  // ========== اختيار الإجابة الصحيحة ==========
  if (data.startsWith('addans_') && isAdmin) {
    const s = sessions[userId];
    if (s && s.step === 'add_ans') {
      s.correctAnswer = parseInt(data.split('_')[1]);
      s.step = 'add_exp';
      await editMsg(chatId, msgId, "✅ أرسل شرح الإجابة (أو /skip للتخطي):");
    }
    return;
  }
  
  // ========== عرض الأسئلة للإدارة ==========
  if (data === 'admin_list_cats' && isAdmin) {
    const kb = { inline_keyboard: CATEGORIES.map((c, i) => [{ text: c, callback_data: `listcat_${i}` }]) };
    kb.inline_keyboard.push([{ text: "⬅️ الرجوع", callback_data: "admin_menu" }]);
    await editMsg(chatId, msgId, "📋 اختر القسم لعرض الأسئلة:", kb);
    return;
  }
  
  if (data.startsWith('listcat_') && isAdmin) {
    const ci = parseInt(data.split('_')[1]);
    const cat = CATEGORIES[ci];
    const all = await getQuestions();
    const qs = Object.entries(all).filter(([_, q]) => q.category === cat).map(([id, q]) => ({ id, ...q }));
    
    if (qs.length === 0) {
      const kb = { inline_keyboard: [[{ text: "⬅️ الرجوع", callback_data: "admin_list_cats" }]] };
      await editMsg(chatId, msgId, `❌ لا توجد أسئلة في *${cat}*`, kb);
      return;
    }
    
    // عرض أول 10 أسئلة
    const kb = { inline_keyboard: [] };
    qs.slice(0, 10).forEach(q => {
      kb.inline_keyboard.push([{ text: `${q.question.substring(0,40)}...`, callback_data: `editq_${q.id}` }]);
    });
    kb.inline_keyboard.push([{ text: "⬅️ الرجوع", callback_data: "admin_list_cats" }]);
    
    sessions[userId] = { adminQs: qs, adminCat: cat };
    await editMsg(chatId, msgId, `📋 *${cat}* (${qs.length} سؤال)\n\nاختر سؤالاً لتعديله:`, kb);
    return;
  }
  
  // ========== تعديل سؤال ==========
  if (data.startsWith('editq_') && isAdmin) {
    const id = data.split('_')[1];
    const all = await getQuestions();
    const q = all[id];
    if (!q) {
      await answerCb(cb.id, "السؤال غير موجود", true);
      return;
    }
    
    const kb = { inline_keyboard: [
      [{ text: "✏️ تعديل السؤال", callback_data: `editf_q_${id}` }],
      [{ text: "🖼 تعديل الوسائط", callback_data: `editf_media_${id}` }],
      [{ text: "📝 تعديل الخيارات", callback_data: `editf_opt_${id}` }],
      [{ text: "💡 تعديل الشرح", callback_data: `editf_exp_${id}` }],
      [{ text: "🗑 حذف السؤال", callback_data: `delete_${id}` }],
      [{ text: "⬅️ الرجوع", callback_data: `listcat_${CATEGORIES.indexOf(q.category)}` }]
    ]};
    
    let txt = `📝 *السؤال:* ${q.question}\n`;
    txt += `📂 القسم: ${q.category}\n`;
    txt += `🖼 وسائط: ${q.mediaUrl ? q.mediaType : 'لا يوجد'}\n`;
    txt += `📋 خيارات: ${q.options?.length || 0}\n`;
    txt += `✅ الإجابة: ${q.options?.[q.correctAnswer] || '?'}\n`;
    txt += `💡 شرح: ${q.explanation ? 'موجود' : 'لا يوجد'}`;
    
    await editMsg(chatId, msgId, txt, kb);
    return;
  }
  
  // ========== تعديل حقل ==========
  if (data.startsWith('editf_q_') && isAdmin) {
    const id = data.split('_')[2];
    sessions[userId] = { step: 'edit_q', editId: id };
    await editMsg(chatId, msgId, "✏️ أرسل نص السؤال الجديد:");
    return;
  }
  
  if (data.startsWith('editf_media_') && isAdmin) {
    const id = data.split('_')[2];
    sessions[userId] = { step: 'edit_media', editId: id };
    await editMsg(chatId, msgId, "🖼 أرسل رابط الوسائط الجديد:");
    return;
  }
  
  if (data.startsWith('editf_opt_') && isAdmin) {
    const id = data.split('_')[2];
    sessions[userId] = { step: 'edit_opt', editId: id };
    await editMsg(chatId, msgId, "📝 أرسل الخيارات الجديدة (كل خيار في سطر):");
    return;
  }
  
  if (data.startsWith('editf_exp_') && isAdmin) {
    const id = data.split('_')[2];
    sessions[userId] = { step: 'edit_exp', editId: id };
    await editMsg(chatId, msgId, "💡 أرسل الشرح الجديد:");
    return;
  }
  
  // ========== اختيار الإجابة الصحيحة للتعديل ==========
  if (data.startsWith('editans_') && isAdmin) {
    const s = sessions[userId];
    if (s && s.step === 'edit_ans') {
      const ansIdx = parseInt(data.split('_')[1]);
      await updateQuestion(s.editId, { options: s.editOpts, correctAnswer: ansIdx });
      await editMsg(chatId, msgId, "✅ تم تحديث الخيارات والإجابة!");
      sessions[userId] = null;
      await sendMsg(chatId, mainText(), mainKb(isAdmin));
    }
    return;
  }
  
  // ========== حذف سؤال ==========
  if (data.startsWith('delete_') && isAdmin) {
    const id = data.split('_')[1];
    const kb = { inline_keyboard: [
      [{ text: "✅ نعم، احذف", callback_data: `confirm_delete_${id}` }],
      [{ text: "❌ إلغاء", callback_data: `editq_${id}` }]
    ]};
    await editMsg(chatId, msgId, "⚠️ هل أنت متأكد من حذف هذا السؤال؟", kb);
    return;
  }
  
  if (data.startsWith('confirm_delete_') && isAdmin) {
    const id = data.split('_')[2];
    await deleteQuestion(id);
    await editMsg(chatId, msgId, "🗑 تم حذف السؤال!");
    sessions[userId] = null;
    await sendMsg(chatId, mainText(), mainKb(isAdmin));
    return;
  }
  
  // ========== تعيين صورة افتراضية ==========
  if (data === 'admin_default_img' && isAdmin) {
    const all = await getQuestions();
    const noMedia = Object.entries(all).filter(([_, q]) => !q.mediaUrl);
    
    if (noMedia.length === 0) {
      await answerCb(cb.id, "جميع الأسئلة لديها وسائط!", true);
      return;
    }
    
    const kb = { inline_keyboard: noMedia.slice(0, 10).map(([id, q]) => [{ text: q.question.substring(0,40), callback_data: `setimg_${id}` }]) };
    kb.inline_keyboard.push([{ text: "⬅️ الرجوع", callback_data: "admin_menu" }]);
    await editMsg(chatId, msgId, `🖼 اختر سؤالاً لتعيين صورة له (${noMedia.length} بدون وسائط):`, kb);
    return;
  }
  
  if (data.startsWith('setimg_') && isAdmin) {
    const id = data.split('_')[1];
    sessions[userId] = { step: 'default_img', editId: id };
    await editMsg(chatId, msgId, "🖼 أرسل رابط الصورة الافتراضية:");
    return;
  }
  
  // ========== إحصائيات ==========
  if (data === 'stats' && isAdmin) {
    const all = await getQuestions();
    const total = Object.keys(all).length;
    const cats = {};
    Object.values(all).forEach(q => { const c = q.category || 'غير محدد'; cats[c] = (cats[c] || 0) + 1; });
    let txt = `📊 **إحصائيات**\n\n📝 المجموع: ${total}\n`;
    Object.entries(cats).forEach(([c, n]) => txt += `• ${c}: ${n}\n`);
    const kb = { inline_keyboard: [[{ text: "⬅️ الرجوع", callback_data: "admin_menu" }]] };
    await editMsg(chatId, msgId, txt, kb);
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
    return new Response('🚗 Driving Test Bot is Running!', { status: 200 });
  }
};
