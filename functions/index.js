const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({origin: true});

admin.initializeApp();
const db = admin.database();

// ✅ إضافة سؤال جديد
exports.addQuestion = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { category, question, options, correctAnswer, explanation, mediaUrl, mediaType } = req.body;
      
      if (!category || !question || !options || correctAnswer === undefined) {
        return res.status(400).json({ error: 'بيانات ناقصة' });
      }
      
      const questionsRef = db.ref('questions');
      const newQuestionRef = questionsRef.push();
      
      await newQuestionRef.set({
        category,
        question,
        options,
        correctAnswer,
        explanation: explanation || '',
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || 'text',
        createdAt: admin.database.ServerValue.TIMESTAMP
      });
      
      res.json({ success: true, id: newQuestionRef.key });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// 📋 الحصول على جميع الأسئلة
exports.getQuestions = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const snapshot = await db.ref('questions').once('value');
      const questions = snapshot.val() || {};
      
      // تنظيم الأسئلة حسب القسم
      const categorized = {};
      Object.entries(questions).forEach(([id, q]) => {
        if (!categorized[q.category]) {
          categorized[q.category] = [];
        }
        categorized[q.category].push({ id, ...q });
      });
      
      res.json(categorized);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// ❌ حذف سؤال
exports.deleteQuestion = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { id } = req.body;
      await db.ref(`questions/${id}`).remove();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});
