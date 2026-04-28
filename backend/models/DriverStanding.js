const mongoose = require('mongoose');

const driverStandingSchema = new mongoose.Schema({
  driverStandingId: { type: Number, unique: true },
  raceId: Number,
  driverId: Number,
  points: Number,
  position: Number,
  positionText: String,
  wins: Number
});

module.exports = mongoose.model('DriverStanding', driverStandingSchema);