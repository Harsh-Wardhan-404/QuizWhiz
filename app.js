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
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto')
const app = express();
const bodyParser = require('body-parser')
const User = require('./Models/user')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const { isLoggedIn } = require('./middleware')
const { storeReturnTo } = require('./middleware');

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(flash());


const dbUrl = 'mongodb://localhost:27017/quizDB';
const genAI = new GoogleGenerativeAI(process.env.API_KEY);


// const dbUrl = 'mongodb://localhost:27017/yelp-camp';
mongoose.connect(dbUrl);

const store = MongoStore.create({
  mongoUrl: dbUrl,
  touchAfter: 24 * 60 * 60,
  crypto: {
    secret: process.env.SECRET
  }
});

const sessionConfig = {
  store,
  name: 'session',
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    // secure: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}
app.use(session(sessionConfig));



app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy({ usernameField: 'email' }, User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  console.log("Current User: ", req.user);
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success")
  res.locals.error = req.flash("error")
  next();
})

app.get('/', (req, res) => {
  console.log(crypto.randomBytes(16).toString('hex'));
  res.render('home')
})

app.post('/', (req, res) => {
  res.send("APP POST ")
})

app.get('/register', (req, res) => {
  res.render('users/register')
})
app.post('/register', async (req, res) => {
  // res.send(req.body);
  const { email, password } = req.body;
  const user = new User({ email });
  try {
    const newUser = await User.register(user, password);
    req.login(newUser, err => {
      if (err) return next(err);
      req.flash('success', "Welcome to QuizWhiz")
      res.redirect('/');
    })
  } catch (e) {
    console.error(e);
    res.status(400).send(e.message);
  }
})

app.get('/login', (req, res) => {
  res.render('users/login')
})
app.post('/login', storeReturnTo, passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), (req, res) => {
  req.flash('success', 'Logged in Succesfully')
  const redirectUrl = res.locals.returnTo || '/';
  res.redirect(redirectUrl);
})

app.get('/logout', (req, res) => {
  req.logout(function (err) {
    if (err) return next(err);
    req.flash('success', 'Logged out');
    res.redirect('/');
  })
})

app.get('/createQuiz', isLoggedIn, (req, res) => {
  res.render('createQuiz')
})

app.post('/createQuiz', isLoggedIn, async (req, res) => {

  const { title, secretCode } = req.body;
  try {
    const newQuiz = new Quiz({ title, secretCode });
    // res.send(newQuiz)
    await newQuiz.save();
    req.flash('success', ('Successfully created quiz!'))
    // res.redirect(`/createQuestion/${newQuiz._id}`);
    res.redirect(`/${newQuiz._id}/createQuestion`)
  } catch (e) {
    console.log("Error saving quiz", e.message);
    res.status(500).send('Error saving Quiz')
  }
})



app.get('/showQuiz', isLoggedIn, async (req, res) => {
  const secretCode = req.query.secretCode;
  try {
    const quiz = await Quiz.findOne({ secretCode }).populate('questions');
    if (!quiz) {
      return res.status(404).send('Quiz not found')
    }
    res.render('showQuiz', { quiz, submitted: false, userAnswers: {} });
  } catch (e) {
    console.log('Error fetching quiz', e.message);
    res.status(500).send('Error fetching quiz')
  }

  // console.log(questions.options);
  // res.render('showQuiz', { questions })
  // res.send("SHOW QUIZ")
})

app.post('/submitQuiz/:quizId', isLoggedIn, async (req, res) => {
  try {
    const { quizId } = req.params;
    const userAnswers = req.body.answers;

    let marks = 0;
    let total = 0;
    const quiz = await Quiz.findById(quizId).populate('questions');

    quiz.questions.forEach((question) => {
      total += question.marks;
      if (userAnswers[question._id] === question.correctAnswer) marks += question.marks;
    });

    res.render('showQuiz', { quiz, submitted: true, userAnswers, marks, total });
  } catch (e) {
    console.log('Error submitting quiz', e.message);
    res.status(500).send('Error submitting quiz')
  }

})

app.post('/uploadDoc', isLoggedIn, async (req, res) => {
  res.send(req.file)
})

app.post('/createCustomQuiz', isLoggedIn, upload.single("baseDoc"), async (req, res) => {
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
    const prompt = `Create 10 MCQs on ${extractedText} for testing me and return these in JSON format. The JSON should have the following structure:
  [
    {
      "question": "What is ...?",
      "options": [
        {"label": "a", "text": "Option 1"},
        {"label": "b", "text": "Option 2"},
        {"label": "c", "text": "Option 3"},
        {"label": "d", "text": "Option 4"}
      ],
      "correctAnswer": "a",
      "marks": "1",
    },
    ...
  ]`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const rawText = response.text();
    const cleanText = rawText.replace(/```json|```/g, '').trim();
    const questionsData = JSON.parse(cleanText);

    const questions = await Promise.all(questionsData.map(async (questionData) => {
      const question = new Question(questionData);
      await question.save();
      return {
        ...questionData,
        _id: question._id
      };
    }));

    const quiz = new Quiz({
      title: "Custom Quiz",
      secretCode: crypto.randomBytes(16).toString('hex'),
      questions: questions.map(q => q._id),
    })
    await quiz.save();
    console.log(quiz);
    res.render('showGeneratedQuiz', { questions, quiz, submitted: false, userAnswers: {} })

    // res.render('showGeneratedQuiz', { questions })
  }
  catch (e) {
    console.error("Error processing the pdf", e.message);
    res.status(500).send("Error processing the pdf");
  } finally {
    fs.unlinkSync(filePath);
  }
  //https://gemini.google.com/app/a0ac5df3ebfbc6fa?hl=en-IN

})



app.get('/:quizId/createQuestion', isLoggedIn, async (req, res) => {
  // res.send('quizId/createQuestion')
  const { quizId } = req.params;
  const quiz = await Quiz.findById(quizId)
  // res.send(quiz)
  res.render('createQuestion', { quiz });
})

app.get('/:quizId/show', isLoggedIn, async (req, res) => {
  const { quizId } = req.params;
  const quiz = await Quiz.findById(quizId).populate('questions');
  // console.log(quiz);
  res.render('showQuiz', { quiz });
})

app.post('/:quizId/createQuestion', isLoggedIn, async (req, res) => {
  const { quizId } = req.params;
  const { question, opt1, opt2, opt3, opt4, correctAnswer, marks } = req.body;

  try {
    const newQuestion = new Question({
      question,
      options: [
        { label: 'a', text: opt1 },
        { label: 'b', text: opt2 },
        { label: 'c', text: opt3 },
        { label: 'd', text: opt4 },
      ],
      correctAnswer,
      marks,
    });
    console.log("Before saving");
    const quiz = await Quiz.findById(quizId);
    console.log("Quiz found");
    quiz.questions.push(newQuestion);
    console.log("Questions pushed");
    await newQuestion.save();
    await quiz.save();
    req.flash('success', ('Successfully created question !'))
    // res.send("Question saved succesfully")
    // console.log("Question saved succesfully");
    res.redirect(`/${quizId}/createQuestion`)
  } catch (e) {
    console.log('Error saving question', e.message);
    res.status(500).send('Error saving question');
  }

})

app.get('/takeQuiz', isLoggedIn, async (req, res) => {
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
      "correctAnswer": "a",
      "marks": "1",
    },
    ...
  ]`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const rawText = response.text();
    const cleanText = rawText.replace(/```json|```/g, '').trim();
    const questionsData = JSON.parse(cleanText);
    //res.send(questions);
    // res.json(questions)
    const questions = await Promise.all(questionsData.map(async (questionData) => {
      const question = new Question(questionData);
      await question.save();
      return {
        ...questionData,
        _id: question._id
      };
    }));

    console.log("Questions array:", questions);

    const quiz = new Quiz({
      title: topic,
      secretCode: crypto.randomBytes(16).toString('hex'),
      questions: questions.map(q => q._id),
    })
    await quiz.save();
    console.log(quiz);
    res.render('showGeneratedQuiz', { questions, quiz, submitted: false, userAnswers: {} })
  } catch (error) {
    console.error("Error generating questions:", error.message);
    res.status(500).send("Error generating questions");
  }
});



app.listen(3000, () => {
  console.log('Serving on 3000');
})
