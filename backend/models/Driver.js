const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  driverId: { type: Number, unique: true },
  driverRef: String,
  number: Number,
  code: String,
  forename: String,
  surname: String,
  dob: Date,
  nationality: String,
  url: String
});

module.exports = mongoose.model('Driver', driverSchema);