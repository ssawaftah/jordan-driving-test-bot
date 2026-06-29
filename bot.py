import os
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, db
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ConversationHandler, filters, ContextTypes

BOT_TOKEN = "8993443266:AAFUQsnrVjRpYjox5OQoHUg_CacbuC-leek"
BLOGGER_URL = "https://idriverjo.blogspot.com/p/theory-test-practice.html"

# تهيئة Firebase باستخدام المتغيرات
cred_dict = {
    "type": "service_account",
    "project_id": "al3arbicv",
    "private_key_id": "94fed52b41652433ad3e2fe36026979f7eddcbfe",
    "private_key": os.environ.get("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n'),
    "client_email": "firebase-adminsdk-nnswm@al3arbicv.iam.gserviceaccount.com",
    "client_id": "101502612516719102132",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-nnswm%40al3arbicv.iam.gserviceaccount.com"
}

cred = credentials.Certificate(cred_dict)
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://al3arbicv-default-rtdb.asia-southeast1.firebasedatabase.app'
})

SELECTING_CATEGORY, ENTERING_QUESTION, ENTERING_OPTIONS, ENTERING_ANSWER, ENTERING_EXPLANATION = range(5)

CATEGORIES = [
    "قواعد السير والمرور",
    "الميكانيك",
    "السلامة على الطريق",
    "أسعافات أولية",
    "الشواخص والخطوط والعلامات",
    "المخالفات واحتساب النقاط"
]

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("📱 افتح تطبيق الدراسة", web_app=WebAppInfo(url=BLOGGER_URL))],
        [InlineKeyboardButton("📊 إحصائيات", callback_data="stats")],
        [InlineKeyboardButton("➕ إضافة سؤال", callback_data="add_question")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🚗 **مرحباً بك في بوت الفحص النظري للقيادة 2026**\n\nاختر من القائمة:",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    ref = db.reference('questions')
    questions = ref.get() or {}
    total = len(questions)
    
    cats_count = {}
    for q in questions.values():
        cat = q.get('category', 'غير محدد')
        cats_count[cat] = cats_count.get(cat, 0) + 1
    
    msg = f"📊 **إحصائيات الأسئلة**\n\n📝 المجموع: {total} سؤال\n\n📂 **حسب الأقسام:**\n"
    for cat, count in cats_count.items():
        msg += f"• {cat}: {count}\n"
    
    await query.edit_message_text(msg, parse_mode='Markdown')

async def add_question_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    keyboard = [[InlineKeyboardButton(cat, callback_data=f"cat_{i}")] for i, cat in enumerate(CATEGORIES)]
    keyboard.append([InlineKeyboardButton("❌ إلغاء", callback_data="cancel")])
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text("📝 **إضافة سؤال جديد**\n\nاختر القسم:", reply_markup=reply_markup, parse_mode='Markdown')
    return SELECTING_CATEGORY

async def select_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    if query.data == "cancel":
        await query.edit_message_text("✅ تم الإلغاء.")
        return ConversationHandler.END
    
    cat_index = int(query.data.split("_")[1])
    context.user_data['category'] = CATEGORIES[cat_index]
    
    await query.edit_message_text(
        f"✅ القسم: **{CATEGORIES[cat_index]}**\n\nأرسل نص السؤال الآن:",
        parse_mode='Markdown'
    )
    return ENTERING_QUESTION

async def receive_question(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = update.message
    
    if message.photo:
        context.user_data['media_file_id'] = message.photo[-1].file_id
        context.user_data['media_type'] = 'image'
        context.user_data['question'] = message.caption or "سؤال مع صورة"
    elif message.video:
        context.user_data['media_file_id'] = message.video.file_id
        context.user_data['media_type'] = 'video'
        context.user_data['question'] = message.caption or "سؤال مع فيديو"
    elif message.animation:
        context.user_data['media_file_id'] = message.animation.file_id
        context.user_data['media_type'] = 'gif'
        context.user_data['question'] = message.caption or "سؤال مع GIF"
    else:
        context.user_data['media_file_id'] = None
        context.user_data['media_type'] = 'text'
        context.user_data['question'] = message.text
    
    await message.reply_text(
        "✅ تم استلام السؤال\n\nالآن أرسل **4 خيارات**، كل خيار في سطر منفصل:\n\n*مثال:*\nتوقف تام\nاستعد للتحرك\nأبطئ السرعة\nالطريق مفتوح",
        parse_mode='Markdown'
    )
    return ENTERING_OPTIONS

async def receive_options(update: Update, context: ContextTypes.DEFAULT_TYPE):
    options = update.message.text.strip().split('\n')
    
    if len(options) != 4:
        await update.message.reply_text("❌ يجب إدخال 4 خيارات بالضبط! حاول مرة أخرى:")
        return ENTERING_OPTIONS
    
    context.user_data['options'] = options
    
    keyboard = [[InlineKeyboardButton(f"{i+1}. {opt[:50]}", callback_data=f"ans_{i}")] for i, opt in enumerate(options)]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "✅ تم استلام الخيارات\n\nاختر **الإجابة الصحيحة**:",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return ENTERING_ANSWER

async def receive_answer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    correct_index = int(query.data.split("_")[1])
    context.user_data['correct_answer'] = correct_index
    
    await query.edit_message_text(
        f"✅ الإجابة الصحيحة: **{context.user_data['options'][correct_index]}**\n\n"
        "أرسل شرح الإجابة الآن:\n(أو أرسل /skip للتخطي)",
        parse_mode='Markdown'
    )
    return ENTERING_EXPLANATION

async def receive_explanation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    explanation = update.message.text
    
    if explanation == '/skip':
        explanation = ''
    
    try:
        ref = db.reference('questions')
        new_ref = ref.push()
        
        question_data = {
            'category': context.user_data.get('category', ''),
            'question': context.user_data.get('question', ''),
            'options': context.user_data.get('options', []),
            'correctAnswer': context.user_data.get('correct_answer', 0),
            'explanation': explanation,
            'mediaUrl': context.user_data.get('media_file_id'),
            'mediaType': context.user_data.get('media_type', 'text'),
            'createdAt': datetime.now().isoformat()
        }
        
        new_ref.set(question_data)
        
        await update.message.reply_text(
            f"🎉 **تم حفظ السؤال بنجاح!**\n\n"
            f"📂 القسم: {context.user_data.get('category', '')}\n"
            f"📝 السؤال: {context.user_data.get('question', '')[:50]}...\n"
            f"🆔 المعرف: {new_ref.key}",
            parse_mode='Markdown'
        )
        return ConversationHandler.END
        
    except Exception as e:
        await update.message.reply_text(f"❌ حدث خطأ: {str(e)}\n\nحاول مرة أخرى بإرسال /start")
        return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("✅ تم الإلغاء. أرسل /start للعودة للقائمة.")
    return ConversationHandler.END

def main():
    app = Application.builder().token(BOT_TOKEN).build()
    
    conv_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(add_question_start, pattern="^add_question$")],
        states={
            SELECTING_CATEGORY: [CallbackQueryHandler(select_category, pattern="^cat_|^cancel$")],
            ENTERING_QUESTION: [MessageHandler(filters.TEXT | filters.PHOTO | filters.VIDEO | filters.ANIMATION, receive_question)],
            ENTERING_OPTIONS: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_options)],
            ENTERING_ANSWER: [CallbackQueryHandler(receive_answer, pattern="^ans_")],
            ENTERING_EXPLANATION: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_explanation)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
    
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(stats, pattern="^stats$"))
    app.add_handler(conv_handler)
    
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
