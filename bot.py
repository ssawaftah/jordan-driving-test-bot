import os
import json
import asyncio
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, db
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ConversationHandler, filters, ContextTypes

# ============ الإعدادات ============
BOT_TOKEN = "8993443266:AAFUQsnrVjRpYjox5OQoHUg_CacbuC-leek"
ADMIN_ID = 123456789  # سنغيره لاحقاً
BLOGGER_URL = "https://idriverjo.blogspot.com/p/theory-test-practice.html"

# ============ Firebase ============
FIREBASE_CRED = {
    "type": "service_account",
    "project_id": "al3arbicv",
    "private_key_id": "94fed52b41652433ad3e2fe36026979f7eddcbfe",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCvLwIXMpF94N5U\nAaB+Z4jJUsvaAscoRvY4EwfWSxPrlxxBO0/KAgGqIE1iV1533RsCRqzQFPKrNLh2\nQ7xR9neefbp23903IBksoTu2iKOzAFXqGcL+pEye4mN/8/NYOc+8aK5qWPorT/Ss\n/yItEAxvaioKgURQXwqMUKf6th111z8d6oYJXt+he3God/etdhj9R3VDTu9MOdDd\nTx9RgZTpxt6KV5l8dtmulZ5WOptzK+D7D0BoiKH3OXOk5E/gpZYgJAHK3H4Baik8\ns0/oeEFrmBVZ6H59oAXY+DY8V9J1IFfSxfut6zEySw8FFH1kWkzex1PQTGqy4HqG\nP7MksN/DAgMBAAECggEAMhkpaeTmQq9qJXAJq9yD+78X2RLuTZBtnX+jwB7cZYVj\naSxDFywXucVfG/6MX471yGLZzPAQrfF3xyp70py/fK3MA27l3nvpdx/s6biNyAUS\njM4tO5FU8CMh/VeQgeyWgfUV3AfyEyzcdhTIe0aZp8selr59ANcNNy9huosWRbp9\njGzgISzowqon7HDm7T93LqJaK4crvdBpe2k7kTO7bR/E1xaJ8DyxBl5pTXIPOAXD\nkDPY9AXSYwS/UXkXo/HdmF2JLGhiuA098B2rA9yVSVy3uhc6yffFAJ1qPgJUm8Ko\n/+I2Sc9nTOAsxb8Wv/c6ds4LhLlTubqmWIbMuarhIQKBgQDT4OdhmWKX5pZXxQo7\n3R0mDFEiEKAg5NmQqD3eMguK7yIvaZhlp1VgIGUy1HWRyUwYd8rB0syXIzwBIvzp\nSIDtRoBAUpu5pjI83cQMzMVVhbGuRLKdbcB+fl5A0J6+vUCWd6lmP0i/iUbnvEih\noDpqgtVN+cBPheJSUkTcNBwTWwKBgQDTqey012YAw0vkVhmFF9yJFNZn/SXelxJZ\nO7kqsEj7hBe/1cQ+CfutJS9p5ad4YjRry3pZtPniqJ7P4OJU57psxiVxLpTdX7n8\nalvrQkcikBDXKKzkn9VFZviM4aX5G+V7VOTTHdvFHSdRIxlTkeLuYPcLgoEsNTzg\n/tR+sfkZuQKBgAHCPClzPH5GS7kuyYb1ruhB8ep2eN3NCIFK5DiT8cSVd5MtLTaq\nzOqfWjexy8gKA7ewRt6VAV2/zR+1SqQlFeziSO4/wUspNgGLVbVFfd3X3kG0EEd+\nQbrLEb03/hlXONIG7EENBW2RliUWSwQMcG+x5lNfX1lJozdLt4acaB9BAoGAeIGG\nAm+f409NJfLfFKdBJ8p1Rz8ZEGFyUNtv0J4M7yWFX/KUh72nTCyfkeruLdu7fKOc\nRPaETkcyI6glM7G6sbMeHhInLuIRQWRMcOSLG2JqNBU0WfWltp2pZIwTsn/vZwgu\nPwQA23h9qfQRt0KXsKAEBsmGQWUOBAsRcBBjggECgYEArWLm8bwYvwDfnhzlCvSi\n+bcEUTJtDyRuXcPH6naZULbP8G5QPintQrasSnZHtfP/1PTx4oyM2AY0toQrLwS4\nFZOAkJmjh31IpITrchdZ3+SaiTagUAMP42MrI7JbE8me4A4+jXawfMkpSyWDV17V\nZDnYdcNn2vKZjJYutWu7gLc=\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-nnswm@al3arbicv.iam.gserviceaccount.com",
    "client_id": "101502612516719102132",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-nnswm%40al3arbicv.iam.gserviceaccount.com"
}

# تهيئة Firebase
cred = credentials.Certificate(FIREBASE_CRED)
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://al3arbicv-default-rtdb.asia-southeast1.firebasedatabase.app'
})

# حالات المحادثة
SELECTING_CATEGORY, ENTERING_QUESTION, ENTERING_OPTIONS, ENTERING_ANSWER, ENTERING_EXPLANATION = range(5)

# الأقسام
CATEGORIES = [
    "قواعد السير والمرور",
    "الميكانيك",
    "السلامة على الطريق",
    "أسعافات أولية",
    "الشواخص والخطوط والعلامات",
    "المخالفات واحتساب النقاط"
]

# ============ دوال البوت ============
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """رسالة الترحيب"""
    keyboard = [
        [InlineKeyboardButton("📱 افتح تطبيق الدراسة", web_app=WebAppInfo(url=BLOGGER_URL))],
        [InlineKeyboardButton("📊 إحصائيات", callback_data="stats")]
    ]
    
    # إذا كان المستخدم هو الأدمن
    if update.effective_user.id == ADMIN_ID or True:  # مؤقتاً الكل أدمن
        keyboard.append([InlineKeyboardButton("➕ إضافة سؤال", callback_data="add_question")])
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🚗 **مرحباً بك في بوت الفحص النظري للقيادة 2026**\n\n"
        "اختر من القائمة أدناه:",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """عرض الإحصائيات"""
    query = update.callback_query
    await query.answer()
    
    ref = db.reference('questions')
    questions = ref.get() or {}
    
    total = len(questions)
    cats_count = {}
    for q in questions.values():
        cat = q.get('category', 'غير محدد')
        cats_count[cat] = cats_count.get(cat, 0) + 1
    
    msg = f"📊 **إحصائيات الأسئلة**\n\n"
    msg += f"📝 المجموع: {total} سؤال\n\n"
    msg += "📂 **حسب الأقسام:**\n"
    for cat, count in cats_count.items():
        msg += f"• {cat}: {count}\n"
    
    await query.edit_message_text(msg, parse_mode='Markdown')

async def add_question_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """بدء إضافة سؤال"""
    query = update.callback_query
    await query.answer()
    
    keyboard = [[InlineKeyboardButton(cat, callback_data=f"cat_{i}")] for i, cat in enumerate(CATEGORIES)]
    keyboard.append([InlineKeyboardButton("إلغاء", callback_data="cancel")])
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        "📝 **إضافة سؤال جديد**\n\nاختر القسم:",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return SELECTING_CATEGORY

async def select_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """تحديد القسم"""
    query = update.callback_query
    await query.answer()
    
    if query.data == "cancel":
        await query.edit_message_text("تم الإلغاء.")
        return ConversationHandler.END
    
    cat_index = int(query.data.split("_")[1])
    context.user_data['category'] = CATEGORIES[cat_index]
    
    await query.edit_message_text(
        f"✅ القسم: **{CATEGORIES[cat_index]}**\n\n"
        "أرسل نص السؤال الآن:\n"
        "(يمكنك إرسال صورة أو فيديو مع تعليق)",
        parse_mode='Markdown'
    )
    return ENTERING_QUESTION

async def receive_question(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """استقبال السؤال"""
    message = update.message
    
    # التحقق من وجود وسائط
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
        "✅ تم استلام السؤال\n\n"
        "الآن أرسل **4 خيارات** للإجابة.\n"
        "اكتب كل خيار في سطر منفصل:\n\n"
        "*مثال:*\n"
        "توقف تام\n"
        "استعد للتحرك\n"
        "أبطئ السرعة\n"
        "الطريق مفتوح",
        parse_mode='Markdown'
    )
    return ENTERING_OPTIONS

async def receive_options(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """استقبال الخيارات"""
    options = update.message.text.strip().split('\n')
    
    if len(options) != 4:
        await update.message.reply_text("❌ يجب إدخال 4 خيارات بالضبط!")
        return ENTERING_OPTIONS
    
    context.user_data['options'] = options
    
    # عرض الخيارات لاختيار الصحيحة
    keyboard = [[InlineKeyboardButton(f"{i+1}. {opt[:30]}", callback_data=f"ans_{i}")] for i, opt in enumerate(options)]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "✅ تم استلام الخيارات\n\n"
        "اختر **الإجابة الصحيحة**:",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
    return ENTERING_ANSWER

async def receive_answer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """استقبال الإجابة الصحيحة"""
    query = update.callback_query
    await query.answer()
    
    correct_index = int(query.data.split("_")[1])
    context.user_data['correct_answer'] = correct_index
    
    await query.edit_message_text(
        f"✅ الإجابة الصحيحة: **{context.user_data['options'][correct_index]}**\n\n"
        "أرسل شرح الإجابة (أو أرسل /skip للتخطي):",
        parse_mode='Markdown'
    )
    return ENTERING_EXPLANATION

async def receive_explanation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """استقبال الشرح وحفظ السؤال"""
    explanation = update.message.text
    if explanation == '/skip':
        explanation = ''
    
    # حفظ في Firebase
    ref = db.reference('questions')
    new_ref = ref.push()
    
    question_data = {
        'category': context.user_data['category'],
        'question': context.user_data['question'],
        'options': context.user_data['options'],
        'correctAnswer': context.user_data['correct_answer'],
        'explanation': explanation,
        'mediaUrl': context.user_data.get('media_file_id'),
        'mediaType': context.user_data.get('media_type', 'text'),
        'createdAt': datetime.now().isoformat()
    }
    
    new_ref.set(question_data)
    
    await update.message.reply_text(
        "🎉 **تم حفظ السؤال بنجاح!**\n\n"
        f"📂 القسم: {context.user_data['category']}\n"
        f"📝 السؤال: {context.user_data['question'][:50]}...\n"
        f"🆔 المعرف: {new_ref.key}\n\n"
        "استخدم /start للعودة للقائمة",
        parse_mode='Markdown'
    )
    
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """إلغاء العملية"""
    await update.message.reply_text("تم الإلغاء.")
    return ConversationHandler.END

# ============ التشغيل ============
def main():
    app = Application.builder().token(BOT_TOKEN).build()
    
    # محادثة إضافة سؤال
    conv_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(add_question_start, pattern="^add_question$")],
        states={
            SELECTING_CATEGORY: [CallbackQueryHandler(select_category, pattern="^cat_")],
            ENTERING_QUESTION: [MessageHandler(filters.TEXT | filters.PHOTO | filters.VIDEO, receive_question)],
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
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
