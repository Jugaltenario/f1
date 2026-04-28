const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  resultId: { type: Number, unique: true },
  raceId: Number,
  driverId: Number,
  constructorId: Number,
  number: Number,
  grid: Number,
  position: Number,
  positionText: String,
  positionOrder: Number,
  points: Number,
  laps: Number,
  time: String,
  milliseconds: Number,
  fastestLap: Number,
  rank: Number,
  fastestLapTime: String,
  fastestLapSpeed: String,
  statusId: Number
});

module.exports = mongoose.model('Result', resultSchema);