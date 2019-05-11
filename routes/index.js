var express = require('express');
var asyncHandler = require('express-async-handler');
var router = express.Router();

var API = require('../modules/PTVapi');


/* GET home page. */
router.get('/', asyncHandler(async (req, res, next) => {

  // const response = API.healthCheck();
  // const stops = await API.getStops(3);

  if(req.app.locals.data) {
    res.json(req.app.locals.data);
  }

}));

router.get('/train', asyncHandler(async (req, res, next) => {
  if(req.app.locals.data) {
    res.json(req.app.locals.data);
  }

}));

router.get('/stops', asyncHandler(async (req, res, next) => {
  if(req.app.locals.stops) {
    res.json(req.app.locals.stops);
  }

}));



module.exports = router;
