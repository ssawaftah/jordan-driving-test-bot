import os
import json
import requests
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ConversationHandler, filters, ContextTypes

BOT_TOKEN = "8993443266:AAFUQsnrVjRpYjox5OQoHUg_CacbuC-leek"
FIREBASE_DB_URL = "https://al3arbicv-default-rtdb.asia-southeast1.firebasedatabase.app"
BLOGGER_URL = "https://idriverjo.blogspot.com/p/theory-test-practice.html"
ADMIN_ID = 1376513623

CATEGORIES = [
    "قواعد السير والمرور", "الميكانيك", "السلامة على الطريق",
    "أسعافات أولية", "الشواخص والخطوط والعلامات", "المخالفات واحتساب النقاط"
]

(ADD_CAT, ADD_Q, ADD_OPT, ADD_ANS, ADD_EXP) = range(5)

user_data = {}
admin_temp = {}

def get_questions():
    r = requests.get(f"{FIREBASE_DB_URL}/questions.json")
    return r.json() or {}

def save_question(data):
    r = requests.post(f"{FIREBASE_DB_URL}/questions.json", json=data)
    return r.json()

def is_admin(user_id):
    return user_id == ADMIN_ID

# ============ ستارت ============
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    
    # تنظيف أي محادثة سابقة
    context.user_data.clear()
    
    msg = (
        "🚗 **اختبار الفحص النظري**\n\n"
        "دراسة مصنفة حسب أقسام المادة النظرية، اختبار محاكي قريب من التجربة الفعلية.\n\n"
        "✅ موثوق من دائرة الترخيص\n"
        "✅ محاكاة فعلية\n"
        "✅ مطابق لأسئلة الاختبار\n"
        "✅ تجربة امتحان كاملة"
    )
    
    keyboard = [
        [InlineKeyboardButton("📚 اسئلة الترخيص للفحص النظري الشامل 2026", callback_data="menu_categories")],
        [InlineKeyboardButton("🎯 اختبار الفحص النظري", web_app=WebAppInfo(url=BLOGGER_URL))]
    ]
    
    if is_admin(user_id):
        keyboard.append([InlineKeyboardButton("➕ إضافة سؤال", callback_data="admin_add")])
        keyboard.append([InlineKeyboardButton("📊 إحصائيات", callback_data="admin_stats")])
    
    # إذا كانت رسالة جديدة أو تعديل
    if update.message:
        await update.message.reply_text(msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    else:
        query = update.callback_query
        await query.edit_message_text(msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')

# ============ الأقسام ============
async def menu_categories(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    keyboard = []
    for i, cat in enumerate(CATEGORIES):
        keyboard.append([InlineKeyboardButton(f"{i+1}. {cat}", callback_data=f"study_{i}")])
    keyboard.append([InlineKeyboardButton("⬅️ الرجوع للرئيسية", callback_data="start")])
    
    await query.edit_message_text("📂 **اختر القسم:**", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')

# ============ الدراسة ============
async def study_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    
    cat_index = int(query.data.split("_")[1])
    category = CATEGORIES[cat_index]
    questions = get_questions()
    
    study_qs = []
    for qid, q in questions.items():
        if q.get('category') == category:
            study_qs.append({'id': qid, **q})
    
    if not study_qs:
        keyboard = [[InlineKeyboardButton("⬅️ الرجوع للأقسام", callback_data="menu_categories")]]
        await query.edit_message_text(f"❌ لا توجد أسئلة في *{category}*", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return
    
    user_data[user_id] = {'study_qs': study_qs, 'study_index': 0, 'category': category}
    await show_study(query, user_id)

async def show_study(query, user_id):
    data = user_data.get(user_id, {})
    qs = data.get('study_qs', [])
    idx = data.get('study_index', 0)
    
    if idx >= len(qs):
        keyboard = [
            [InlineKeyboardButton("🧪 اختبار هذا القسم", web_app=WebAppInfo(url=BLOGGER_URL))],
            [InlineKeyboardButton("📂 الرجوع للأقسام", callback_data="menu_categories")],
            [InlineKeyboardButton("🏠 الرجوع للرئيسية", callback_data="start")]
        ]
        await query.edit_message_text("✅ **انتهت الأسئلة!**", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return
    
    q = qs[idx]
    total = len(qs)
    
    msg = f"📝 **السؤال {idx + 1} من {total}**\n\n*{q.get('question', '')}*"
    
    if q.get('mediaUrl') and q.get('mediaType') == 'image':
        msg += f"\n\n🖼 [الصورة]({q['mediaUrl']})"
    
    keyboard = []
    for i, opt in enumerate(q.get('options', [])):
        prefix = "✅ " if i == q.get('correctAnswer') else ""
        keyboard.append([InlineKeyboardButton(f"{prefix}{i+1}. {opt}", callback_data=f"ans_{i}")])
    
    nav = []
    if idx > 0:
        nav.append(InlineKeyboardButton("◀ السابق", callback_data="prev_q"))
    if idx < total - 1:
        nav.append(InlineKeyboardButton("التالي ▶", callback_data="next_q"))
    if nav:
        keyboard.append(nav)
    
    keyboard.append([InlineKeyboardButton("🚪 إنهاء المراجعة", callback_data="start")])
    
    await query.edit_message_text(msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown', disable_web_page_preview=True)

async def ans_click(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    data = user_data.get(user_id, {})
    qs = data.get('study_qs', [])
    idx = data.get('study_index', 0)
    
    if idx >= len(qs):
        await query.answer()
        return
    
    q = qs[idx]
    ans = int(query.data.split("_")[1])
    
    if ans == q.get('correctAnswer'):
        await query.answer("✅ صحيح!", show_alert=True)
    else:
        await query.answer("❌ خطأ", show_alert=True)
    
    if q.get('explanation'):
        await query.message.reply_text(f"💡 *شرح:* {q['explanation']}", parse_mode='Markdown')

async def study_nav(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    
    if query.data == "prev_q":
        user_data[user_id]['study_index'] -= 1
    elif query.data == "next_q":
        user_data[user_id]['study_index'] += 1
    
    await show_study(query, user_id)

# ============ الأدمن: إضافة سؤال ============
async def admin_add(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    
    if not is_admin(user_id):
        await query.answer("❌ غير مصرح", show_alert=True)
        return
    
    await query.answer()
    admin_temp[user_id] = {}
    
    keyboard = [[InlineKeyboardButton(cat, callback_data=f"addcat_{i}")] for i, cat in enumerate(CATEGORIES)]
    keyboard.append([InlineKeyboardButton("❌ إلغاء", callback_data="start")])
    
    await query.edit_message_text("📝 اختر القسم:", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    return ADD_CAT

async def add_cat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    cat_index = int(query.data.split("_")[1])
    admin_temp[user_id]['category'] = CATEGORIES[cat_index]
    await query.edit_message_text(f"✅ *{CATEGORIES[cat_index]}*\n\nأرسل نص السؤال:", parse_mode='Markdown')
    return ADD_Q

async def add_q(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    admin_temp[user_id]['question'] = update.message.text
    await update.message.reply_text("✅ أرسل 4 خيارات (كل خيار في سطر):")
    return ADD_OPT

async def add_opt(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    opts = update.message.text.strip().split('\n')
    if len(opts) != 4:
        await update.message.reply_text("❌ 4 خيارات فقط!")
        return ADD_OPT
    admin_temp[user_id]['options'] = opts
    keyboard = [[InlineKeyboardButton(f"{i+1}. {opt[:40]}", callback_data=f"addans_{i}")] for i, opt in enumerate(opts)]
    await update.message.reply_text("اختر الإجابة الصحيحة:", reply_markup=InlineKeyboardMarkup(keyboard))
    return ADD_ANS

async def add_ans(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    admin_temp[user_id]['correctAnswer'] = int(query.data.split("_")[1])
    await query.edit_message_text("✅ أرسل شرح الإجابة (أو /skip):")
    return ADD_EXP

async def add_exp(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    exp = update.message.text
    if exp == '/skip':
        exp = ''
    
    data = admin_temp.get(user_id, {})
    qdata = {
        'category': data.get('category', ''),
        'question': data.get('question', ''),
        'options': data.get('options', []),
        'correctAnswer': data.get('correctAnswer', 0),
        'explanation': exp,
        'mediaUrl': None,
        'mediaType': 'text',
        'createdAt': datetime.now().isoformat()
    }
    
    save_question(qdata)
    admin_temp.pop(user_id, None)
    
    await update.message.reply_text(f"🎉 **تم الحفظ!**\n📂 {data.get('category', '')}\n📝 {data.get('question', '')[:50]}...", parse_mode='Markdown')
    
    # إظهار القائمة الرئيسية
    await start(update, context)
    return ConversationHandler.END

async def admin_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    
    if not is_admin(user_id):
        await query.answer("❌ غير مصرح", show_alert=True)
        return
    
    await query.answer()
    questions = get_questions()
    total = len(questions)
    cats = {}
    for q in questions.values():
        c = q.get('category', 'غير محدد')
        cats[c] = cats.get(c, 0) + 1
    
    msg = f"📊 **الإحصائيات**\n\n📝 المجموع: {total}\n"
    for c, n in cats.items():
        msg += f"• {c}: {n}\n"
    
    keyboard = [[InlineKeyboardButton("⬅️ الرجوع", callback_data="start")]]
    await query.edit_message_text(msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    admin_temp.pop(user_id, None)
    await update.message.reply_text("✅ تم الإلغاء.")
    await start(update, context)
    return ConversationHandler.END

# ============ main ============
def main():
    app = Application.builder().token(BOT_TOKEN).build()
    
    # محادثة الأدمن
    conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(admin_add, pattern="^admin_add$")],
        states={
            ADD_CAT: [CallbackQueryHandler(add_cat, pattern="^addcat_")],
            ADD_Q: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_q)],
            ADD_OPT: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_opt)],
            ADD_ANS: [CallbackQueryHandler(add_ans, pattern="^addans_")],
            ADD_EXP: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_exp)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
    
    # Handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(start, pattern="^start$"))
    app.add_handler(CallbackQueryHandler(menu_categories, pattern="^menu_categories$"))
    app.add_handler(CallbackQueryHandler(study_start, pattern="^study_"))
    app.add_handler(CallbackQueryHandler(ans_click, pattern="^ans_"))
    app.add_handler(CallbackQueryHandler(study_nav, pattern="^(prev_q|next_q)$"))
    app.add_handler(CallbackQueryHandler(admin_stats, pattern="^admin_stats$"))
    app.add_handler(conv)
    
    print("🤖 البوت يعمل...")
    
    port = int(os.environ.get("PORT", 8080))
    from threading import Thread
    from http.server import HTTPServer, BaseHTTPRequestHandler
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Bot is running")
    server = HTTPServer(('0.0.0.0', port), Handler)
    Thread(target=server.serve_forever, daemon=True).start()
    
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
