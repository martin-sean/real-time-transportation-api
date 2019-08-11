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

// Handler for request of static data (stops)
router.get('/stops', asyncHandler(async (req, res, next) => {
  if (req.app.locals.stops) {
    res.json(req.app.locals.stops);
  }

}));

// Handler for request of raw departures data
router.get('/departures', asyncHandler(async (req, res, next) => {
  if (req.app.locals.departures) {
    res.json(req.app.locals.departures);
  }

}));

// Handler for checking the connection to the API
router.get('/check', asyncHandler(async (req, res, next) => {
  const response = await API.healthCheck();
  res.json(response.data);
}));



module.exports = router;
