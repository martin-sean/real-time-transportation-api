var express = require('express');
var asyncHandler = require('express-async-handler');
var router = express.Router();

var API = require('../modules/PTVapi');


/* GET home page. */
router.get('/', asyncHandler(async (req, res, next) => {

  const response = API.healthCheck();
  const stops = await API.getStops(3);
  res.send(stops);

}));

module.exports = router;
