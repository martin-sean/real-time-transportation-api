var express = require('express');
var asyncHandler = require('express-async-handler');
var router = express.Router();

/* GET home page. */
router.get('/stops', asyncHandler(async (req, res, next) => {
    if (req.app.locals.stops) {
        res.json(req.app.locals.stops);
    }

}));

router.get('/departures', asyncHandler(async (req, res, next) => {
    if (req.app.locals.departures) {
        res.json(req.app.locals.departures);
    }

}));

module.exports = router;
