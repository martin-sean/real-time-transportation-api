var express = require('express');
var asyncHandler = require('express-async-handler');
var router = express.Router();

var API = require('../modules/PTVapi');


/* GET home page. */
router.get('/', asyncHandler(async (req, res, next) => {
  if (req.app.locals.data) {
    res.json(req.app.locals.data);
  }
}));

// Handler for request of dynamic data (processed view)
router.get('/train', asyncHandler(async (req, res, next) => {
  if (req.app.locals.data) {
    res.json(req.app.locals.data);
  }
}));

// Handler for request of station departures data
router.get('/stationDepartures', asyncHandler(async (req, res, next) => {
  if (req.app.locals.stationDepartures) {
    res.json(req.app.locals.stationDepartures);
  }
}));

// Handler for request of station data
router.get('/uniqueStops', asyncHandler(async (req, res, next) => {
  if (req.app.locals.uniqueStops) {
    res.json(req.app.locals.uniqueStops);
  }
}));

// Handler for checking the connection to the API
router.get('/check', asyncHandler(async (req, res, next) => {
  const response = await API.healthCheck();
  res.json(response.data);
}));

module.exports = router;