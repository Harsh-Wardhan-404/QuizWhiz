require('dotenv').config();

const express = require("express");
const ejsMate = require('ejs-mate');
const mongoose = require('mongoose');
const path = require('path');
const Question = require('./Models/question')
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Quiz = require("./Models/quiz");
const multer = require('multer')
const upload = multer({ dest: 'uploads/' })
const fs = require('fs');
const pdfParse = require('pdf-parse');

const app = express();

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))
app.use(express.urlencoded({ extended: true }))

const dbUrl = 'mongodb://localhost:27017/quizDB';
const genAI = new GoogleGenerativeAI(process.env.API_KEY);


// const dbUrl = 'mongodb://localhost:27017/yelp-camp';
mongoose.connect(dbUrl);

app.get('/', (req, res) => {
  res.render('home')
})

app.post('/', (req, res) => {
  res.send("APP POST ")
})

app.get('/createQuiz', (req, res) => {
  res.render('createQuiz')
})

app.post('/createQuiz', async (req, res) => {

  const { title, secretCode } = req.body;
  try {
    const newQuiz = new Quiz({ title, secretCode });
    // res.send(newQuiz)
    await newQuiz.save();
    // res.redirect(`/createQuestion/${newQuiz._id}`);
    res.redirect(`/${newQuiz._id}/createQuestion`)
  } catch (e) {
    console.log("Error saving quiz", e.message);
    res.status(500).send('Error saving Quiz')
  }
})



app.get('/showQuiz', async (req, res) => {
  // res.send(req.body)
  // res.send('SHOWQUIZ')
  // res.render('showQuiz')
  const secretCode = req.query.secretCode;
  try {
    const quiz = await Quiz.findOne({ secretCode }).populate('questions');
    if (!quiz) {
      return res.status(404).send('Quiz not found')
    }
    res.render('showQuiz', { quiz })
  } catch (e) {
    console.log('Error fetching quiz', e.message);
    res.status(500).send('Error fetching quiz')
  }

  // console.log(questions.options);
  // res.render('showQuiz', { questions })
  // res.send("SHOW QUIZ")
})

app.post('/uploadDoc', async (req, res) => {
  res.send(req.file)
})

app.post('/createCustomQuiz', upload.single("baseDoc"), async (req, res) => {
  // if (!req.file) {
  // res.redirect('/uploadDoc')
  const { mimetype, path: filePath } = req.file;
  if (mimetype != 'application/pdf') {
    return res.status(400).send('Only PDF files accepted');
  }
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Create 10 MCQs based on the following text: "${extractedText}" and return these in JSON format. The JSON should have the following structure:
    [
      {
        "question": "What is ...?",
        "options": [
          {"label": "a", "text": "Option 1"},
          {"label": "b", "text": "Option 2"},
          {"label": "c", "text": "Option 3"},
          {"label": "d", "text": "Option 4"}
        ],
        "correctAnswer": "a"
      },
      ...
    ]`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const rawText = response.text();
    const cleanText = rawText.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(cleanText);
    res.render('showGeneratedQuiz', { questions })
  }
  catch (e) {
    console.console.error("Error processing the pdf", e.message);
    res.status(500).send("Error processing the pdf");
  } finally {
    fs.unlinkSync(filePath);
  }
  //https://gemini.google.com/app/a0ac5df3ebfbc6fa?hl=en-IN

})



app.get('/:quizId/createQuestion', async (req, res) => {
  // res.send('quizId/createQuestion')
  const { quizId } = req.params;
  const quiz = await Quiz.findById(quizId)
  // res.send(quiz)
  res.render('createQuestion', { quiz });
})

app.get('/:quizId/show', async (req, res) => {
  const { quizId } = req.params;
  const quiz = await Quiz.findById(quizId).populate('questions');
  // console.log(quiz);
  res.render('showQuiz', { quiz });
})

app.post('/:quizId/createQuestion', async (req, res) => {
  const { quizId } = req.params;
  const { question, opt1, opt2, opt3, opt4, correctAnswer } = req.body;

  try {
    const newQuestion = new Question({
      question,
      options: [
        { label: 'a', text: opt1 },
        { label: 'b', text: opt2 },
        { label: 'c', text: opt3 },
        { label: 'd', text: opt4 },
      ],
      correctAnswer
    });
    console.log("Before saving");
    const quiz = await Quiz.findById(quizId);
    console.log("Quiz found");
    quiz.questions.push(newQuestion);
    console.log("Questions pushed");
    await newQuestion.save();
    await quiz.save();
    // res.send("Question saved succesfully")
    // console.log("Question saved succesfully");
    res.redirect(`/${quizId}/createQuestion`)
  } catch (e) {
    console.log('Error saving question', e.message);
    res.status(500).send('Error saving question');
  }

})

app.get('/takeQuiz', async (req, res) => {
  const { topic } = req.query;
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Create 10 MCQs on ${topic} for testing me and return these in JSON format. The JSON should have the following structure:
  [
    {
      "question": "What is ...?",
      "options": [
        {"label": "a", "text": "Option 1"},
        {"label": "b", "text": "Option 2"},
        {"label": "c", "text": "Option 3"},
        {"label": "d", "text": "Option 4"}
      ],
      "correctAnswer": "a"
    },
    ...
  ]`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const rawText = response.text();
    const cleanText = rawText.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(cleanText);
    // res.json(questions)
    res.render('showGeneratedQuiz', { questions })
    // res.render('showGeneratedQuiz', { questions });
  } catch (error) {
    console.error("Error generating questions:", error.message);
    res.status(500).send("Error generating questions");
  }
});


app.post('/uploadDoc', async (req, res) => {
  //To do
  //   1) Add multer to Project
  // 2) Implement PDF to Chat with gemini
  // 3) parse it into questions
  // 4) Finishing the job

})



app.listen(3000, () => {
  console.log('Serving on 3000');
})
