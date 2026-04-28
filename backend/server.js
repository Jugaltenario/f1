const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { logger, apiLogger, dbLogger } = require('./utils/logger');

const Driver = require('./models/Driver');
const Constructor = require('./models/Constructor');
const Circuit = require('./models/Circuit');
const Race = require('./models/Race');
const Result = require('./models/Result');
const DriverStanding = require('./models/DriverStanding');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://f1-sigma-jade.vercel.app';

const app = express();

app.use(cors());
app.use(express.json());

app.use(morgan('combined', {
  stream: {
    write: (message) => apiLogger.http(message.trim())
  }
}));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  logger.warn('MONGO_URI not set - running without database connection');
}

mongoose.connection.on('connecting', () => {
  dbLogger.info('Attempting to connect to MongoDB...');
});

mongoose.connection.on('connected', () => {
  dbLogger.info(`MongoDB connected to ${MONGO_URI}`);
});

mongoose.connection.on('error', (err) => {
  dbLogger.error('MongoDB connection error:', { error: err.message, stack: err.stack });
});

mongoose.connection.on('disconnected', () => {
  dbLogger.warn('MongoDB disconnected');
});

if (MONGO_URI) {
  mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
    .then(() => logger.info('MongoDB connection established'))
    .catch(err => logger.error('MongoDB connection failed:', { error: err.message, stack: err.stack }));
}

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };
    
    if (res.statusCode >= 500) {
      apiLogger.error(`Request failed`, logData);
    } else if (res.statusCode >= 400) {
      apiLogger.warn(`Request error`, logData);
    } else {
      apiLogger.info(`Request completed`, logData);
    }
  });
  
  next();
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { 
    error: err.message, 
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
    timestamp: new Date().toISOString(),
    path: req.url
  });
});

app.get('/api/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  };
  
  apiLogger.info('Health check requested', { ip: req.ip });
  
  try {
    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.message = error.message;
    res.status(503).json(healthcheck);
  }
});

app.get('/api/info', (req, res) => {
  apiLogger.info('API info requested', { ip: req.ip });
  
  res.status(200).json({
    name: 'F1 API Server',
    version: '1.0.0',
    description: 'Formula 1 REST API',
    endpoints: [
      'GET /api/health',
      'GET /api/info',
      'GET /api/drivers',
      'GET /api/drivers/:id',
      'GET /api/constructors',
      'GET /api/constructors/:id',
      'GET /api/circuits',
      'GET /api/circuits/:id',
      'GET /api/races',
      'GET /api/races/:id',
      'GET /api/results/:raceId',
      'GET /api/latest-results',
      'GET /api/standings/:year',
      'GET /api/champions'
    ],
    timestamp: new Date().toISOString()
  });
});

app.get('/api/logs', (req, res) => {
  apiLogger.warn('Logs endpoint accessed', { ip: req.ip, method: req.method });
  
  res.status(403).json({
    error: 'Access forbidden',
    message: 'Log files are not accessible via API'
  });
});

app.get('/api/drivers', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/drivers`, { query: req.query });
  
  try {
    const startTime = Date.now();
    const drivers = await Driver.find();
    const duration = Date.now() - startTime;
    
    apiLogger.info(`[${requestId}] Retrieved ${drivers.length} drivers`, { duration: `${duration}ms` });
    
    res.status(200).json({
      success: true,
      count: drivers.length,
      data: drivers,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error fetching drivers`, { 
      error: err.message, 
      stack: err.stack 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch drivers',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/api/drivers/:id', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/drivers/${req.params.id}`);
  
  try {
    const startTime = Date.now();
    const driver = await Driver.findOne({ driverId: req.params.id });
    const duration = Date.now() - startTime;
    
    if (!driver) {
      apiLogger.warn(`[${requestId}] Driver not found`, { id: req.params.id });
      
      return res.status(404).json({
        success: false,
        error: 'Driver not found',
        message: `No driver found with ID ${req.params.id}`,
        timestamp: new Date().toISOString(),
        requestId
      });
    }
    
    apiLogger.info(`[${requestId}] Driver found`, { 
      name: `${driver.forename} ${driver.surname}`,
      duration: `${duration}ms`
    });
    
    res.status(200).json({
      success: true,
      data: driver,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error fetching driver`, { 
      error: err.message, 
      stack: err.stack,
      id: req.params.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch driver',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/api/constructors', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/constructors`, { query: req.query });
  
  try {
    const startTime = Date.now();
    const constructors = await Constructor.find();
    const duration = Date.now() - startTime;
    
    apiLogger.info(`[${requestId}] Retrieved ${constructors.length} constructors`, { duration: `${duration}ms` });
    
    res.status(200).json({
      success: true,
      count: constructors.length,
      data: constructors,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error fetching constructors`, { 
      error: err.message, 
      stack: err.stack 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch constructors',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/api/constructors/:id', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/constructors/${req.params.id}`);
  
  try {
    const startTime = Date.now();
    const constructor = await Constructor.findOne({ constructorId: req.params.id });
    const duration = Date.now() - startTime;
    
    if (!constructor) {
      apiLogger.warn(`[${requestId}] Constructor not found`, { id: req.params.id });
      
      return res.status(404).json({
        success: false,
        error: 'Constructor not found',
        message: `No constructor found with ID ${req.params.id}`,
        timestamp: new Date().toISOString(),
        requestId
      });
    }
    
    apiLogger.info(`[${requestId}] Constructor found`, { 
      name: constructor.name,
      duration: `${duration}ms`
    });
    
    res.status(200).json({
      success: true,
      data: constructor,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error fetching constructor`, { 
      error: err.message, 
      stack: err.stack,
      id: req.params.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch constructor',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/api/circuits', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/circuits`, { query: req.query });
  
  try {
    const startTime = Date.now();
    const circuits = await Circuit.find();
    const duration = Date.now() - startTime;
    
    apiLogger.info(`[${requestId}] Retrieved ${circuits.length} circuits`, { duration: `${duration}ms` });
    
    res.status(200).json({
      success: true,
      count: circuits.length,
      data: circuits,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error fetching circuits`, { 
      error: err.message, 
      stack: err.stack 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch circuits',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/api/circuits/:id', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/circuits/${req.params.id}`);
  
  try {
    const startTime = Date.now();
    const circuit = await Circuit.findOne({ circuitId: req.params.id });
    const duration = Date.now() - startTime;
    
    if (!circuit) {
      apiLogger.warn(`[${requestId}] Circuit not found`, { id: req.params.id });
      
      return res.status(404).json({
        success: false,
        error: 'Circuit not found',
        message: `No circuit found with ID ${req.params.id}`,
        timestamp: new Date().toISOString(),
        requestId
      });
    }
    
    apiLogger.info(`[${requestId}] Circuit found`, { 
      name: circuit.name,
      duration: `${duration}ms`
    });
    
    res.status(200).json({
      success: true,
      data: circuit,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error fetching circuit`, { 
      error: err.message, 
      stack: err.stack,
      id: req.params.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch circuit',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/api/races', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/races`, { query: req.query });
  
  try {
    const startTime = Date.now();
    const { year, limit } = req.query;
    const filter = year ? { year: parseInt(year) } : {};
    const races = await Race.find(filter)
      .sort({ date: -1 })
      .limit(limit ? parseInt(limit) : 0);
    const duration = Date.now() - startTime;
    
    apiLogger.info(`[${requestId}] Retrieved ${races.length} races`, { 
      year,
      duration: `${duration}ms`
    });
    
    res.status(200).json({
      success: true,
      count: races.length,
      data: races,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error fetching races`, { 
      error: err.message, 
      stack: err.stack 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch races',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/api/races/:id', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/races/${req.params.id}`);
  
  try {
    const startTime = Date.now();
    const race = await Race.findOne({ raceId: req.params.id });
    const duration = Date.now() - startTime;
    
    if (!race) {
      apiLogger.warn(`[${requestId}] Race not found`, { id: req.params.id });
      
      return res.status(404).json({
        success: false,
        error: 'Race not found',
        message: `No race found with ID ${req.params.id}`,
        timestamp: new Date().toISOString(),
        requestId
      });
    }
    
    apiLogger.info(`[${requestId}] Race found`, { 
      name: race.name,
      duration: `${duration}ms`
    });
    
    res.status(200).json({
      success: true,
      data: race,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error fetching race`, { 
      error: err.message, 
      stack: err.stack,
      id: req.params.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch race',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/api/results/:raceId', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/results/${req.params.raceId}`);
  
  try {
    const startTime = Date.now();
    const results = await Result.find({ raceId: req.params.raceId })
      .sort({ positionOrder: 1 })
      .populate('driverId')
      .populate('constructorId');
    const duration = Date.now() - startTime;
    
    apiLogger.info(`[${requestId}] Retrieved ${results.length} results`, { 
      raceId: req.params.raceId,
      duration: `${duration}ms`
    });
    
    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error fetching results`, { 
      error: err.message, 
      stack: err.stack,
      raceId: req.params.raceId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch results',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/api/latest-results', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/latest-results`);
  
  try {
    const startTime = Date.now();
    const latestRace = await Race.findOne().sort({ date: -1 });
    
    if (!latestRace) {
      apiLogger.warn(`[${requestId}] No races found in database`);
      
      return res.status(404).json({
        success: false,
        error: 'No races found',
        message: 'No race data available in the database',
        timestamp: new Date().toISOString(),
        requestId
      });
    }
    
    const results = await Result.find({ raceId: latestRace.raceId })
      .sort({ positionOrder: 1 })
      .populate('driverId')
      .populate('constructorId');
    
    const duration = Date.now() - startTime;
    
    apiLogger.info(`[${requestId}] Latest results retrieved`, { 
      race: latestRace.name,
      year: latestRace.year,
      resultCount: results.length,
      duration: `${duration}ms`
    });
    
    res.status(200).json({
      success: true,
      race: latestRace,
      results,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error fetching latest results`, { 
      error: err.message, 
      stack: err.stack 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch latest results',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/api/standings/:year', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/standings/${req.params.year}`);
  
  try {
    const startTime = Date.now();
    const year = parseInt(req.params.year);
    const latestRace = await Race.findOne({ year }).sort({ date: -1 });
    
    if (!latestRace) {
      apiLogger.warn(`[${requestId}] No races found for year`, { year });
      
      return res.status(404).json({
        success: false,
        error: 'No races found',
        message: `No races found for year ${year}`,
        timestamp: new Date().toISOString(),
        requestId
      });
    }
    
    const standings = await DriverStanding.find({ raceId: latestRace.raceId })
      .sort({ position: 1 })
      .populate('driverId');
    
    const duration = Date.now() - startTime;
    
    apiLogger.info(`[${requestId}] Standings retrieved for ${year}`, { 
      raceId: latestRace.raceId,
      standingCount: standings.length,
      duration: `${duration}ms`
    });
    
    res.status(200).json({
      success: true,
      year,
      race: latestRace.name,
      standings,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error fetching standings`, { 
      error: err.message, 
      stack: err.stack,
      year: req.params.year
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch standings',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/api/drivers/stats', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/drivers/stats`);
  
  try {
    const startTime = Date.now();
    
    const [drivers, results, races, standings] = await Promise.all([
      Driver.find(),
      Result.find(),
      Race.find(),
      DriverStanding.find()
    ]);
    
    const raceMap = new Map(races.map(r => [r.raceId, r]));
    
    const driverStats = drivers.map(driver => {
      const driverResults = results.filter(r => r.driverId === driver.driverId);
      const driverStandings = standings.filter(s => s.driverId === driver.driverId);
      
      const wins = driverResults.filter(r => r.position === 1).length;
      const podiums = driverResults.filter(r => r.position && r.position <= 3).length;
      
      const driverRaces = driverResults
        .map(r => raceMap.get(r.raceId))
        .filter(Boolean);
      
      const debutYear = driverRaces.length > 0 
        ? Math.min(...driverRaces.map(r => r.year))
        : null;
      
      const championships = driverStandings.filter(s => s.position === 1).length;
      
      return {
        ...driver.toObject(),
        wins,
        podiums,
        championships,
        debutYear,
        poles: 0
      };
    });
    
    const duration = Date.now() - startTime;
    
    apiLogger.info(`[${requestId}] Driver stats computed`, { 
      count: driverStats.length,
      duration: `${duration}ms`
    });
    
    res.status(200).json({
      success: true,
      count: driverStats.length,
      data: driverStats,
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error computing driver stats`, { 
      error: err.message, 
      stack: err.stack 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to compute driver stats',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/api/champions', async (req, res) => {
  const requestId = Date.now().toString(36);
  apiLogger.info(`[${requestId}] GET /api/champions`);
  
  try {
    const startTime = Date.now();
    const latestRace = await Race.findOne().sort({ date: -1 });
    
    if (!latestRace) {
      apiLogger.warn(`[${requestId}] No races found in database`);
      
      return res.status(404).json({
        success: false,
        error: 'No races found',
        message: 'No race data available',
        timestamp: new Date().toISOString(),
        requestId
      });
    }
    
    const standings = await DriverStanding.find({ raceId: latestRace.raceId })
      .sort({ position: 1 })
      .populate('driverId');
    
    const duration = Date.now() - startTime;
    
    apiLogger.info(`[${requestId}] Champions retrieved`, { 
      year: latestRace.year,
      standingsCount: standings.length,
      duration: `${duration}ms`
    });
    
    res.status(200).json({
      success: true,
      year: latestRace.year,
      standings: standings.slice(0, 10),
      timestamp: new Date().toISOString(),
      requestId
    });
  } catch (err) {
    apiLogger.error(`[${requestId}] Error fetching champions`, { 
      error: err.message, 
      stack: err.stack 
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch champions',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId
    });
  }
});

app.get('/', (req, res) => {
  res.redirect(301, FRONTEND_URL);
});

app.use((req, res) => {
  apiLogger.warn(`Route not found`, { 
    method: req.method, 
    url: req.url,
    ip: req.ip
  });
  
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Cannot ${req.method} ${req.url}`,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  logger.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 F1 API Server Started                                ║
║                                                            ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(36)}║
║   Port: ${PORT.toString().padEnd(46)}║
║   MongoDB: ${MONGO_URI ? MONGO_URI.substring(0, 30).padEnd(46) : 'Not configured'.padEnd(46)}║
║   Frontend: ${FRONTEND_URL.padEnd(40)}║
║                                                            ║
║   Endpoints:                                               ║
║   - GET /            - Redirect to frontend                ║
║   - GET /api/health  - Health check                        ║
║   - GET /api/info    - API information                     ║
║   - GET /api/drivers - List all drivers                   ║
║   - GET /api/constructors - List all constructors          ║
║   - GET /api/circuits - List all circuits                  ║
║   - GET /api/races    - List all races                    ║
║   - GET /api/results/:raceId - Get race results            ║
║   - GET /api/latest-results - Latest race results           ║
║   - GET /api/standings/:year - Season standings             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;