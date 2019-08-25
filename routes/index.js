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

// Handler for request of route descriptions data
router.get('/routes', asyncHandler(async (req, res, next) => {
  if (req.app.locals.routes) {
    res.json(req.app.locals.routes);
  }
}));

// Handler for request of dynamic data (processed view)
router.get('/runs', asyncHandler(async (req, res, next) => {
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

// Handler for checking the connection to the API
router.get('/check', asyncHandler(async (req, res, next) => {
  const response = await API.healthCheck();
  res.json(response.data);
}));

module.exports = router;