const mongoose = require('mongoose')


const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },

  secretCode: {
    type: String,
    required: true,

  },
  questions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    }
  ],

  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  attempts: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    attemptDate: {
      type: Date,
      default: Date.now
    },
  }
  ]
}, { timestamps: true });

const Quiz = mongoose.model('Quiz', quizSchema);
module.exports = Quiz;