const mongoose = require('mongoose');

const raceSchema = new mongoose.Schema({
  raceId: { type: Number, unique: true },
  year: Number,
  round: Number,
  circuitId: Number,
  name: String,
  date: Date,
  time: String,
  url: String,
  fp1_date: Date,
  fp1_time: String,
  fp2_date: Date,
  fp2_time: String,
  fp3_date: Date,
  fp3_time: String,
  quali_date: Date,
  quali_time: String,
  sprint_date: Date,
  sprint_time: String
});

module.exports = mongoose.model('Race', raceSchema);