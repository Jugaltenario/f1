const csvtojson = require('csvtojson');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const { logger, importLogger, dbLogger } = require('../utils/logger');

const Driver = require('../models/Driver');
const Constructor = require('../models/Constructor');
const Circuit = require('../models/Circuit');
const Race = require('../models/Race');
const Result = require('../models/Result');
const DriverStanding = require('../models/DriverStanding');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/f1db';
const CSV_DIR = process.env.CSV_DIR || path.join(__dirname, '../../archive');

const stats = {
  startTime: null,
  drivers: { imported: 0, errors: 0, duration: 0 },
  constructors: { imported: 0, errors: 0, duration: 0 },
  circuits: { imported: 0, errors: 0, duration: 0 },
  races: { imported: 0, errors: 0, duration: 0 },
  results: { imported: 0, errors: 0, duration: 0 },
  driverStandings: { imported: 0, errors: 0, duration: 0 }
};

function convertNull(value) {
  return value === '\\N' ? null : value;
}

function convertNumber(value) {
  if (value === '\\N' || value === null || value === '') return null;
  const num = parseInt(value);
  return isNaN(num) ? null : num;
}

function convertFloat(value) {
  if (value === '\\N' || value === null || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function convertDate(value) {
  if (value === '\\N' || !value) return null;
  try {
    return new Date(value);
  } catch (err) {
    importLogger.warn(`Date conversion error: ${value}`, { error: err.message });
    return null;
  }
}

function printProgressBar(iteration, total, prefix = '', suffix = '', decimals = 1, length = 50, fill = '█') {
  const percent = (`${(iteration / total * 100).toFixed(decimals)}`).padStart(5);
  const filledLength = Math.round(length * iteration / total);
  const bar = fill.repeat(filledLength) + '-'.repeat(length - filledLength);
  
  process.stdout.write(`\r${prefix} |${bar}| ${percent}% ${suffix}`);
  
  if (iteration === total) {
    process.stdout.write('\n');
  }
}

function printBanner(text) {
  const line = '═'.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${text}`);
  console.log(`${line}\n`);
}

async function importDrivers() {
  const startTime = Date.now();
  const filePath = path.join(CSV_DIR, 'drivers.csv');
  
  importLogger.info('Starting drivers import...', { file: filePath });
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const json = await csvtojson().fromFile(filePath);
    const total = json.length;
    
    importLogger.info(`Processing ${total} drivers from CSV...`);
    
    const drivers = [];
    let errors = 0;
    
    for (let i = 0; i < json.length; i++) {
      const row = json[i];
      try {
        drivers.push({
          driverId: convertNumber(row.driverId),
          driverRef: convertNull(row.driverRef),
          number: convertNumber(row.number),
          code: convertNull(row.code),
          forename: convertNull(row.forename),
          surname: convertNull(row.surname),
          dob: convertDate(row.dob),
          nationality: convertNull(row.nationality),
          url: convertNull(row.url)
        });
        
        if ((i + 1) % 100 === 0 || i === json.length - 1) {
          printProgressBar(i + 1, total, '  Progress', `(${i + 1}/${total})`);
        }
      } catch (err) {
        errors++;
        importLogger.warn(`Error processing driver row ${i + 1}:`, { error: err.message, row: row.driverId });
      }
    }
    
    importLogger.info(`Inserting ${drivers.length} drivers into database...`);
    
    await Driver.deleteMany({});
    
    const insertStart = Date.now();
    if (drivers.length > 0) {
      await Driver.insertMany(drivers);
    }
    const insertDuration = Date.now() - insertStart;
    
    const duration = Date.now() - startTime;
    stats.drivers = { imported: drivers.length, errors, duration };
    
    importLogger.info(`✅ Drivers import complete!`, {
      imported: drivers.length,
      errors,
      parseTime: duration - insertDuration,
      insertTime: insertDuration,
      totalTime: duration
    });
    
    console.log(`\n  📊 Drivers Import Summary:`);
    console.log(`     - Imported: ${drivers.length}`);
    console.log(`     - Errors: ${errors}`);
    console.log(`     - Time: ${duration}ms\n`);
    
  } catch (err) {
    importLogger.error(`❌ Drivers import failed:`, { error: err.message, stack: err.stack });
    throw err;
  }
}

async function importConstructors() {
  const startTime = Date.now();
  const filePath = path.join(CSV_DIR, 'constructors.csv');
  
  importLogger.info('Starting constructors import...', { file: filePath });
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const json = await csvtojson().fromFile(filePath);
    const total = json.length;
    
    importLogger.info(`Processing ${total} constructors from CSV...`);
    
    const constructors = [];
    let errors = 0;
    
    for (let i = 0; i < json.length; i++) {
      const row = json[i];
      try {
        constructors.push({
          constructorId: convertNumber(row.constructorId),
          constructorRef: convertNull(row.constructorRef),
          name: convertNull(row.name),
          nationality: convertNull(row.nationality),
          url: convertNull(row.url)
        });
        
        if ((i + 1) % 50 === 0 || i === json.length - 1) {
          printProgressBar(i + 1, total, '  Progress', `(${i + 1}/${total})`);
        }
      } catch (err) {
        errors++;
        importLogger.warn(`Error processing constructor row ${i + 1}:`, { error: err.message });
      }
    }
    
    importLogger.info(`Inserting ${constructors.length} constructors into database...`);
    
    await Constructor.deleteMany({});
    
    const insertStart = Date.now();
    if (constructors.length > 0) {
      await Constructor.insertMany(constructors);
    }
    const insertDuration = Date.now() - insertStart;
    
    const duration = Date.now() - startTime;
    stats.constructors = { imported: constructors.length, errors, duration };
    
    importLogger.info(`✅ Constructors import complete!`, {
      imported: constructors.length,
      errors,
      totalTime: duration
    });
    
    console.log(`\n  📊 Constructors Import Summary:`);
    console.log(`     - Imported: ${constructors.length}`);
    console.log(`     - Errors: ${errors}`);
    console.log(`     - Time: ${duration}ms\n`);
    
  } catch (err) {
    importLogger.error(`❌ Constructors import failed:`, { error: err.message, stack: err.stack });
    throw err;
  }
}

async function importCircuits() {
  const startTime = Date.now();
  const filePath = path.join(CSV_DIR, 'circuits.csv');
  
  importLogger.info('Starting circuits import...', { file: filePath });
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const json = await csvtojson().fromFile(filePath);
    const total = json.length;
    
    importLogger.info(`Processing ${total} circuits from CSV...`);
    
    const circuits = [];
    let errors = 0;
    
    for (let i = 0; i < json.length; i++) {
      const row = json[i];
      try {
        circuits.push({
          circuitId: convertNumber(row.circuitId),
          circuitRef: convertNull(row.circuitRef),
          name: convertNull(row.name),
          location: convertNull(row.location),
          country: convertNull(row.country),
          lat: convertFloat(row.lat),
          lng: convertFloat(row.lng),
          alt: convertNumber(row.alt),
          url: convertNull(row.url)
        });
        
        if ((i + 1) % 20 === 0 || i === json.length - 1) {
          printProgressBar(i + 1, total, '  Progress', `(${i + 1}/${total})`);
        }
      } catch (err) {
        errors++;
      }
    }
    
    importLogger.info(`Inserting ${circuits.length} circuits into database...`);
    
    await Circuit.deleteMany({});
    
    const insertStart = Date.now();
    if (circuits.length > 0) {
      await Circuit.insertMany(circuits);
    }
    const insertDuration = Date.now() - insertStart;
    
    const duration = Date.now() - startTime;
    stats.circuits = { imported: circuits.length, errors, duration };
    
    importLogger.info(`✅ Circuits import complete!`, {
      imported: circuits.length,
      errors,
      totalTime: duration
    });
    
    console.log(`\n  📊 Circuits Import Summary:`);
    console.log(`     - Imported: ${circuits.length}`);
    console.log(`     - Errors: ${errors}`);
    console.log(`     - Time: ${duration}ms\n`);
    
  } catch (err) {
    importLogger.error(`❌ Circuits import failed:`, { error: err.message, stack: err.stack });
    throw err;
  }
}

async function importRaces() {
  const startTime = Date.now();
  const filePath = path.join(CSV_DIR, 'races.csv');
  
  importLogger.info('Starting races import...', { file: filePath });
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const json = await csvtojson().fromFile(filePath);
    const total = json.length;
    
    importLogger.info(`Processing ${total} races from CSV...`);
    
    const races = [];
    let errors = 0;
    
    for (let i = 0; i < json.length; i++) {
      const row = json[i];
      try {
        races.push({
          raceId: convertNumber(row.raceId),
          year: convertNumber(row.year),
          round: convertNumber(row.round),
          circuitId: convertNumber(row.circuitId),
          name: convertNull(row.name),
          date: convertDate(row.date),
          time: convertNull(row.time),
          url: convertNull(row.url),
          fp1_date: convertDate(row.fp1_date),
          fp1_time: convertNull(row.fp1_time),
          fp2_date: convertDate(row.fp2_date),
          fp2_time: convertNull(row.fp2_time),
          fp3_date: convertDate(row.fp3_date),
          fp3_time: convertNull(row.fp3_time),
          quali_date: convertDate(row.quali_date),
          quali_time: convertNull(row.quali_time),
          sprint_date: convertDate(row.sprint_date),
          sprint_time: convertNull(row.sprint_time)
        });
        
        if ((i + 1) % 100 === 0 || i === json.length - 1) {
          printProgressBar(i + 1, total, '  Progress', `(${i + 1}/${total})`);
        }
      } catch (err) {
        errors++;
      }
    }
    
    const years = [...new Set(races.map(r => r.year).filter(Boolean))].sort((a, b) => a - b);
    
    importLogger.info(`Inserting ${races.length} races into database...`, { yearRange: `${years[0]} - ${years[years.length - 1]}` });
    
    await Race.deleteMany({});
    
    const insertStart = Date.now();
    if (races.length > 0) {
      await Race.insertMany(races);
    }
    const insertDuration = Date.now() - insertStart;
    
    const duration = Date.now() - startTime;
    stats.races = { imported: races.length, errors, duration };
    
    importLogger.info(`✅ Races import complete!`, {
      imported: races.length,
      errors,
      yearRange: `${years[0]} - ${years[years.length - 1]}`,
      totalTime: duration
    });
    
    console.log(`\n  📊 Races Import Summary:`);
    console.log(`     - Imported: ${races.length}`);
    console.log(`     - Years: ${years[0]} - ${years[years.length - 1]}`);
    console.log(`     - Errors: ${errors}`);
    console.log(`     - Time: ${duration}ms\n`);
    
  } catch (err) {
    importLogger.error(`❌ Races import failed:`, { error: err.message, stack: err.stack });
    throw err;
  }
}

async function importResults() {
  const startTime = Date.now();
  const filePath = path.join(CSV_DIR, 'results.csv');
  
  importLogger.info('Starting results import...', { file: filePath });
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const json = await csvtojson().fromFile(filePath);
    const total = json.length;
    
    importLogger.info(`Processing ${total} results from CSV...`);
    
    const results = [];
    let errors = 0;
    const batchSize = 5000;
    
    for (let i = 0; i < json.length; i++) {
      const row = json[i];
      try {
        results.push({
          resultId: convertNumber(row.resultId),
          raceId: convertNumber(row.raceId),
          driverId: convertNumber(row.driverId),
          constructorId: convertNumber(row.constructorId),
          number: convertNumber(row.number),
          grid: convertNumber(row.grid),
          position: convertNumber(row.position),
          positionText: convertNull(row.positionText),
          positionOrder: convertNumber(row.positionOrder),
          points: convertFloat(row.points),
          laps: convertNumber(row.laps),
          time: convertNull(row.time),
          milliseconds: convertNumber(row.milliseconds),
          fastestLap: convertNumber(row.fastestLap),
          rank: convertFloat(row.rank),
          fastestLapTime: convertNull(row.fastestLapTime),
          fastestLapSpeed: convertFloat(row.fastestLapSpeed),
          statusId: convertNumber(row.statusId)
        });
        
        if ((i + 1) % 1000 === 0 || i === json.length - 1) {
          printProgressBar(i + 1, total, '  Progress', `(${i + 1}/${total})`);
        }
      } catch (err) {
        errors++;
      }
    }
    
    importLogger.info(`Inserting ${results.length} results into database (batch inserts)...`);
    
    await Result.deleteMany({});
    
    const insertStart = Date.now();
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      await Result.insertMany(batch);
      importLogger.info(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(results.length / batchSize)}`);
    }
    
    const insertDuration = Date.now() - insertStart;
    
    const duration = Date.now() - startTime;
    stats.results = { imported: results.length, errors, duration };
    
    importLogger.info(`✅ Results import complete!`, {
      imported: results.length,
      errors,
      totalTime: duration,
      insertTime: insertDuration
    });
    
    console.log(`\n  📊 Results Import Summary:`);
    console.log(`     - Imported: ${results.length}`);
    console.log(`     - Errors: ${errors}`);
    console.log(`     - Time: ${duration}ms\n`);
    
  } catch (err) {
    importLogger.error(`❌ Results import failed:`, { error: err.message, stack: err.stack });
    throw err;
  }
}

async function importDriverStandings() {
  const startTime = Date.now();
  const filePath = path.join(CSV_DIR, 'driver_standings.csv');
  
  importLogger.info('Starting driver standings import...', { file: filePath });
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const json = await csvtojson().fromFile(filePath);
    const total = json.length;
    
    importLogger.info(`Processing ${total} driver standings from CSV...`);
    
    const standings = [];
    let errors = 0;
    const batchSize = 5000;
    
    for (let i = 0; i < json.length; i++) {
      const row = json[i];
      try {
        standings.push({
          driverStandingId: convertNumber(row.driverStandingsId),
          raceId: convertNumber(row.raceId),
          driverId: convertNumber(row.driverId),
          points: convertFloat(row.points),
          position: convertNumber(row.position),
          positionText: convertNull(row.positionText),
          wins: convertNumber(row.wins)
        });
        
        if ((i + 1) % 5000 === 0 || i === json.length - 1) {
          printProgressBar(i + 1, total, '  Progress', `(${i + 1}/${total})`);
        }
      } catch (err) {
        errors++;
      }
    }
    
    importLogger.info(`Inserting ${standings.length} driver standings into database (batch inserts)...`);
    
    await DriverStanding.deleteMany({});
    
    const insertStart = Date.now();
    
    for (let i = 0; i < standings.length; i += batchSize) {
      const batch = standings.slice(i, i + batchSize);
      await DriverStanding.insertMany(batch);
      importLogger.info(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(standings.length / batchSize)}`);
    }
    
    const insertDuration = Date.now() - insertStart;
    
    const duration = Date.now() - startTime;
    stats.driverStandings = { imported: standings.length, errors, duration };
    
    importLogger.info(`✅ Driver standings import complete!`, {
      imported: standings.length,
      errors,
      totalTime: duration
    });
    
    console.log(`\n  📊 Driver Standings Import Summary:`);
    console.log(`     - Imported: ${standings.length}`);
    console.log(`     - Errors: ${errors}`);
    console.log(`     - Time: ${duration}ms\n`);
    
  } catch (err) {
    importLogger.error(`❌ Driver standings import failed:`, { error: err.message, stack: err.stack });
    throw err;
  }
}

function printFinalSummary() {
  const totalTime = Date.now() - stats.startTime;
  
  printBanner('📋 FINAL IMPORT SUMMARY');
  
  console.log(`  ${'Collection'.padEnd(20)} | ${'Imported'.padEnd(12)} | ${'Errors'.padEnd(10)} | ${'Time'.padEnd(12)} | Status`);
  console.log(`  ${'-'.repeat(20)}-+-${'-'.repeat(12)}-+-${'-'.repeat(10)}-+-${'-'.repeat(12)}-+-${'-'.repeat(8)}`);
  
  const collections = [
    { name: 'Drivers', ...stats.drivers },
    { name: 'Constructors', ...stats.constructors },
    { name: 'Circuits', ...stats.circuits },
    { name: 'Races', ...stats.races },
    { name: 'Results', ...stats.results },
    { name: 'Standings', ...stats.driverStandings }
  ];
  
  const totalImported = collections.reduce((sum, c) => sum + c.imported, 0);
  const totalErrors = collections.reduce((sum, c) => sum + c.errors, 0);
  
  collections.forEach(c => {
    const status = c.errors === 0 ? '✅' : c.errors < c.imported * 0.1 ? '⚠️' : '❌';
    console.log(`  ${c.name.padEnd(20)} | ${c.imported.toString().padEnd(12)} | ${c.errors.toString().padEnd(10)} | ${`${c.duration}ms`.padEnd(12)} | ${status}`);
  });
  
  console.log(`  ${'-'.repeat(20)}-+-${'-'.repeat(12)}-+-${'-'.repeat(10)}-+-${'-'.repeat(12)}-+-${'-'.repeat(8)}`);
  console.log(`  ${'TOTAL'.padEnd(20)} | ${totalImported.toString().padEnd(12)} | ${totalErrors.toString().padEnd(10)} | ${`${totalTime}ms`.padEnd(12)} |`);
  
  const statusEmoji = totalErrors === 0 ? '✅' : totalErrors < totalImported * 0.01 ? '⚠️' : '❌';
  console.log(`\n  Overall Status: ${statusEmoji} ${totalErrors === 0 ? 'All imports successful!' : totalErrors + ' errors occurred'}\n`);
  
  importLogger.info('════════════════════════════════════════════════════════════', { totalImported, totalErrors, totalTime });
}

async function run() {
  stats.startTime = Date.now();
  
  printBanner('🏁 F1 CSV Data Import Starting');
  
  console.log(`  MongoDB: ${MONGO_URI}`);
  console.log(`  CSV Dir: ${CSV_DIR}`);
  console.log(`  Time: ${new Date().toISOString()}\n`);
  
  try {
    importLogger.info('Connecting to MongoDB...', { uri: MONGO_URI });
    
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    
    dbLogger.info('MongoDB connection established');
    console.log(`  ✅ Connected to MongoDB\n`);
    
    printBanner('📥 Importing Data');
    
    await importDrivers();
    await importConstructors();
    await importCircuits();
    await importRaces();
    await importResults();
    await importDriverStandings();
    
    await mongoose.connection.close();
    
    printFinalSummary();
    
    importLogger.info('════════════════════════════════════════════════════════════');
    importLogger.info('✅ All data imported successfully!');
    
    process.exit(0);
  } catch (err) {
    importLogger.error('════════════════════════════════════════════════════════════');
    importLogger.error('❌ Import failed with error:', { error: err.message, stack: err.stack });
    
    console.log(`\n  ❌ IMPORT FAILED\n`);
    console.log(`  Error: ${err.message}\n`);
    
    try {
      await mongoose.connection.close();
    } catch (closeErr) {
      importLogger.error('Error closing MongoDB connection:', { error: closeErr.message });
    }
    
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  importLogger.warn('Import interrupted by user (SIGINT)');
  console.log('\n\n  ⛔ Import interrupted by user\n');
  
  try {
    await mongoose.connection.close();
  } catch (err) {
    console.log('  Error closing connection:', err.message);
  }
  
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  importLogger.error('Unhandled Promise Rejection:', { reason: String(reason) });
  console.log('\n  ❌ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  importLogger.error('Uncaught Exception:', { error: err.message, stack: err.stack });
  console.log('\n  ❌ Uncaught Exception:', err.message);
  process.exit(1);
});

run();