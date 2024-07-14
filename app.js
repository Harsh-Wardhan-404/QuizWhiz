const express = require("express");
const ejsMate = require('ejs-mate');
const mongoose = require('mongoose');
const path = require('path');
const Question = require('./Models/question')

const Quiz = require("./Models/quiz");

const app = express();

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))
app.use(express.urlencoded({ extended: true }))

const dbUrl = 'mongodb://localhost:27017/quizDB';

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
  // res.render('showQuiz')
  const questions = await Question.findById();
  // console.log(questions.options);
  res.render('showQuiz', { questions })
  // res.send("SHOW QUIZ")
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

// app.post('/createQuestion/:quizId', async (req, res) => {
//   // const { quizId } = req.params;
//   // const { question, opt1, opt2, opt3, opt4, correctAnswer } = req.body;
//   // try {
//   //   const newQuestion = new Question({
//   //     question,
//   //     options: [
//   //       { label: 'a', text: opt1 },
//   //       { label: 'b', text: opt2 },
//   //       { label: 'c', text: opt3 },
//   //       { label: 'd', text: opt4 },
//   //     ],
//   //     correctAnswer,
//   //     quiz: quizId
//   //   });

//   //   await newQuestion.save();

//   //   const quiz = await Quiz.findById(quizId);
//   //   quiz.questions.addToSet(newQuestion._id);
//   //   await quiz.save();

//   //   res.redirect(`/createQuestion/${quizId}?success=true`);
//   //   // alert("Question created")
//   // } catch (e) {
//   //   console.log('Error saving question', e.message);
//   //   res.status(500).send('Error saving question');
//   // }
// })

app.listen(3000, () => {
  console.log('Serving on 3000');
})