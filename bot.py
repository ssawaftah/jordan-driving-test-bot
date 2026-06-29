import os
import json
import requests
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ConversationHandler, filters, ContextTypes

BOT_TOKEN = "8993443266:AAFUQsnrVjRpYjox5OQoHUg_CacbuC-leek"
FIREBASE_DB_URL = "https://al3arbicv-default-rtdb.asia-southeast1.firebasedatabase.app"
ADMIN_ID = 1376513623  # غيّره لمعرفك

CATEGORIES = [
    "قواعد السير والمرور", "الميكانيك", "السلامة على الطريق",
    "أسعافات أولية", "الشواخص والخطوط والعلامات", "المخالفات واحتساب النقاط"
]

# حالات المحادثة
(MAIN, CATEGORIES_MENU, STUDY_QUESTION, TEST_INFO, TEST_QUESTION,
 ADD_CAT, ADD_Q, ADD_OPT, ADD_ANS, ADD_EXP) = range(10)

# ============ تخزين مؤقت للمستخدم ============
user_data = {}

def get_questions_from_firebase():
    r = requests.get(f"{FIREBASE_DB_URL}/questions.json")
    return r.json() or {}

def save_question(data):
    r = requests.post(f"{FIREBASE_DB_URL}/questions.json", json=data)
    return r.json()

# ============ الصفحة الرئيسية ============
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    
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
        [InlineKeyboardButton("🎯 اختبار الفحص النظري", callback_data="test_info")]
    ]
    
    if user_id == ADMIN_ID:
        keyboard.append([InlineKeyboardButton("➕ إضافة سؤال (أدمن)", callback_data="admin_add")])
        keyboard.append([InlineKeyboardButton("📊 إحصائيات (أدمن)", callback_data="admin_stats")])
    
    await update.message.reply_text(msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    return MAIN

# ============ قائمة الأقسام ============
async def show_categories(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    keyboard = []
    for i, cat in enumerate(CATEGORIES):
        keyboard.append([InlineKeyboardButton(f"{i+1}. {cat}", callback_data=f"study_{i}")])
    keyboard.append([InlineKeyboardButton("⬅️ الرجوع", callback_data="back_main")])
    
    await query.edit_message_text("📂 **اختر القسم الذي تريد دراسته:**", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    return CATEGORIES_MENU

# ============ بدء الدراسة ============
async def start_study(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    cat_index = int(query.data.split("_")[1])
    category = CATEGORIES[cat_index]
    questions = get_questions_from_firebase()
    
    # فلترة أسئلة القسم
    study_qs = []
    for qid, q in questions.items():
        if q.get('category') == category:
            study_qs.append({'id': qid, **q})
    
    if not study_qs:
        await query.edit_message_text(f"❌ لا توجد أسئلة في قسم {category} بعد.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ الرجوع", callback_data="menu_categories")]]))
        return CATEGORIES_MENU
    
    user_id = query.from_user.id
    user_data[user_id] = {
        'study_qs': study_qs,
        'study_index': 0,
        'category': category
    }
    
    await show_study_question(query, user_id)
    return STUDY_QUESTION

async def show_study_question(query_or_msg, user_id):
    data = user_data.get(user_id, {})
    qs = data.get('study_qs', [])
    idx = data.get('study_index', 0)
    
    if idx >= len(qs):
        # انتهت الأسئلة
        keyboard = [
            [InlineKeyboardButton("🧪 بدء اختبار هذا القسم", callback_data="test_category")],
            [InlineKeyboardButton("📂 الرجوع للأقسام", callback_data="menu_categories")],
            [InlineKeyboardButton("🏠 الرجوع للرئيسية", callback_data="back_main")]
        ]
        await query_or_msg.edit_message_text(
            "✅ **لقد أنهيت جميع أسئلة هذا القسم!**\n\nماذا تريد أن تفعل؟",
            reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown'
        )
        return STUDY_QUESTION
    
    q = qs[idx]
    total = len(qs)
    
    # نص السؤال مع الوسائط
    msg = f"📝 **السؤال {idx + 1} من {total}**\n\n"
    msg += f"*{q.get('question', '')}*\n"
    
    if q.get('mediaUrl') and q.get('mediaType') == 'image':
        msg += f"\n🖼 [اضغط لمشاهدة الصورة]({q['mediaUrl']})\n"
    
    # خيارات على شكل أزرار
    keyboard = []
    for i, opt in enumerate(q.get('options', [])):
        prefix = "✅ " if i == q.get('correctAnswer') else ""
        keyboard.append([InlineKeyboardButton(f"{prefix}{i+1}. {opt}", callback_data=f"ans_{i}")])
    
    # أزرار التنقل
    nav = []
    if idx > 0:
        nav.append(InlineKeyboardButton("◀ السابق", callback_data="prev_q"))
    if idx < total - 1:
        nav.append(InlineKeyboardButton("التالي ▶", callback_data="next_q"))
    if nav:
        keyboard.append(nav)
    
    keyboard.append([InlineKeyboardButton("🚪 إنهاء المراجعة", callback_data="back_main")])
    
    if isinstance(query_or_msg, Update):
        await query_or_msg.message.reply_text(msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown', disable_web_page_preview=True)
    else:
        await query_or_msg.edit_message_text(msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown', disable_web_page_preview=True)

async def handle_answer_click(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """عند الضغط على خيار - يظهر شرح الإجابة"""
    query = update.callback_query
    await query.answer()
    
    user_id = query.from_user.id
    data = user_data.get(user_id, {})
    qs = data.get('study_qs', [])
    idx = data.get('study_index', 0)
    q = qs[idx]
    
    ans_index = int(query.data.split("_")[1])
    
    if ans_index == q.get('correctAnswer'):
        await query.answer("✅ إجابة صحيحة!", show_alert=True)
    else:
        await query.answer("❌ إجابة خاطئة", show_alert=True)
    
    if q.get('explanation'):
        await query.message.reply_text(f"💡 *شرح الإجابة:*\n{q['explanation']}", parse_mode='Markdown')

async def study_nav(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    action = query.data
    
    if action == "prev_q":
        user_data[user_id]['study_index'] -= 1
    elif action == "next_q":
        user_data[user_id]['study_index'] += 1
    
    await show_study_question(query, user_id)
    return STUDY_QUESTION

# ============ الاختبار ============
async def show_test_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    msg = (
        "🎯 **اختبار الفحص النظري**\n\n"
        "يقدم اختبار الفحص النظري تجربة واقعية تحاكي الفحص النظري لرخصة القيادة المعتمد في دائرة الترخيص.\n\n"
        "📋 60 سؤالاً عشوائياً\n"
        "✅ النجاح من 51 إجابة صحيحة\n"
        "⏱ المدة: 60 دقيقة"
    )
    keyboard = [
        [InlineKeyboardButton("🚀 ابدأ الاختبار", callback_data="start_test")],
        [InlineKeyboardButton("⬅️ الرجوع", callback_data="back_main")]
    ]
    await query.edit_message_text(msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    return TEST_INFO

# ============ العودة للرئيسية ============
async def back_to_main(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    # نعيد start كرسالة جديدة
    await start(update, context)
    return MAIN

# ============ أدمن ============
async def admin_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    questions = get_questions_from_firebase()
    total = len(questions)
    cats = {}
    for q in questions.values():
        c = q.get('category', 'غير محدد')
        cats[c] = cats.get(c, 0) + 1
    msg = f"📊 **الإحصائيات**\n\n📝 المجموع: {total}\n"
    for c, n in cats.items():
        msg += f"• {c}: {n}\n"
    await query.edit_message_text(msg, parse_mode='Markdown')

# ============ Handlers ============
def main():
    app = Application.builder().token(BOT_TOKEN).build()
    
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(show_categories, pattern="^menu_categories$"))
    app.add_handler(CallbackQueryHandler(back_to_main, pattern="^back_main$"))
    app.add_handler(CallbackQueryHandler(start_study, pattern="^study_"))
    app.add_handler(CallbackQueryHandler(handle_answer_click, pattern="^ans_"))
    app.add_handler(CallbackQueryHandler(study_nav, pattern="^(prev_q|next_q)$"))
    app.add_handler(CallbackQueryHandler(show_test_info, pattern="^test_info$"))
    app.add_handler(CallbackQueryHandler(admin_stats, pattern="^admin_stats$"))
    
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
