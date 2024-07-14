const mongoose = require('mongoose')
const Schema = mongoose.Schema;

const questionSchema = new Schema({
  question: {
    type: String,
    required: true,
  },

  options: {
    type: [
      {
        label: { type: String, enum: ['a', 'b', 'c', 'd'], required: true },
        text: { type: String, required: true }
      }
    ],
    required: true
  },

  correctAnswer: {
    type: String,
    enum: ['a', 'b', 'c', 'd'],
    required: true
  },

  // quiz: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'Quiz',
  //   required: true
  // }
});

const Question = mongoose.model("Question", questionSchema);

module.exports = Question;