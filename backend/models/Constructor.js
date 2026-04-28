const mongoose = require('mongoose');

const constructorSchema = new mongoose.Schema({
  constructorId: { type: Number, unique: true },
  constructorRef: String,
  name: String,
  nationality: String,
  url: String
});

module.exports = mongoose.model('Constructor', constructorSchema);