const BOT_TOKEN = "8993443266:AAFUQsnrVjRpYjox5OQoHUg_CacbuC-leek";

async function tg(method, body) {
  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

const WELCOME_TEXT = `اهلا بك في بوت الفحص النظري الشامل 2026 👋

إذا كنت تستعد لتقديم اختبار القيادة النظري في الأردن فإن دراسة المادة النظرية بشكل جيد تعتبر الخطوة الأهم للنجاح في الفحص من المرة الأولى. في هذه الصفحة يمكنك مراجعة أسئلة اختبار السواقة مع الإجابات الصحيحة والشرح التوضيحي لكل سؤال لمساعدتك على فهم المادة بشكل أفضل.

تم تقسيم المادة إلى عدة أقسام رئيسية مثل قواعد السير والمرور و الميكانيك و السلامة على الطريق و الإسعافات الأولية و الشواخص المرورية والخطوط الأرضية إضافة إلى المخالفات المرورية واحتساب النقاط. يمكنك اختيار القسم الذي تريد دراسته ومراجعة الأسئلة الخاصة به خطوة بخطوة.

ننصحك بدراسة جميع الأقسام جيدًا قبل الدخول إلى اختبار القيادة النظري حتى تكون مستعدًا بشكل كامل لاجتياز الفحص النظري للسواقة بثقة ونجاح.`;

export default {
  async fetch(request) {
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        
        if (body.message && body.message.text === '/start') {
          const chatId = body.message.chat.id;
          await tg('sendMessage', {
            chat_id: chatId,
            text: WELCOME_TEXT,
            parse_mode: 'Markdown'
          });
        }
      } catch (e) {
        console.error(e);
      }
      return new Response('OK');
    }
    return new Response('OK', { status: 200 });
  }
};
