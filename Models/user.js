const mongoose = require('mongoose')
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose')

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },

  role: {
    type: String,
    enum: ['admin', 'quiz-taker', 'quiz-creator'],
    default: 'quiz-taker'
  },

  createdQuizzes: [{
    type: Schema.Types.ObjectId,
    ref: 'Quiz'
  }],

  attemptedQuizzes: [{
    quizId: {
      type: Schema.Types.ObjectId,
      ref: 'Quiz'
    },

    attemptDate: {
      type: Date,
      default: Date.now
    }
  }],

  quizScores: [{
    quizId: {
      type: Schema.Types.ObjectId,
      ref: 'Quiz'
    },

    score: Number
  }],



},

  {

    timestamps: true

  });

userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });

const User = mongoose.model("User", userSchema);

module.exports = User;


