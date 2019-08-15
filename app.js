// Load environment variables
require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// Router to handle requests
var indexRouter = require('./routes/index');

// Self-defined modules
var API = require('./modules/PTVapi');
var Stations = require('./modules/stations');
var Departures = require('./modules/departures');

var app = express();

// Transport type to lookup
// 0 = Train, 1 = Tram
const ROUTE_TYPE = 1;

// Function defined for sorting the array of stations ascendingly according to their route_id
var sortStations = function (a, b) {
  const aRouteID = a[0].route_id;
  const bRouteID = b[0].route_id;

  const aRouteIDIndex = app.locals.routes.indexOf(aRouteID);
  const bRouteIDIndex = app.locals.routes.indexOf(bRouteID);

  let comparison = 0;
  if (aRouteIDIndex > bRouteIDIndex) {
    comparison = 1;
  } else if (aRouteIDIndex < bRouteIDIndex) {
    comparison = -1;
  }

  return comparison;
}

// Function defined for sorting the array of departures ascendingly according to their route_id
var sortDepartures = function (a, b) {
  const aRouteID = a[0][0].route_id;
  const bRouteID = b[0][0].route_id;
  const aRouteIDIndex = app.locals.routes.indexOf(aRouteID);
  const bRouteIDIndex = app.locals.routes.indexOf(bRouteID);

  let comparison = 0;
  if (aRouteIDIndex > bRouteIDIndex) {
    comparison = 1;
  } else if (aRouteIDIndex < bRouteIDIndex) {
    comparison = -1;
  }

  return comparison;
}

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');


// Function that initiates at the start of the app (process both static and dynamic data)
var initiate = async function () {
  console.time("initiate");
  let routes = [];
  let departures = [];
  let stops = [];
  let index;

  API.getRoutes(ROUTE_TYPE)
  .then(result => {
    routes = result.map(function(x) {return x.route_id;});

    // Limit number of routes (all routes will lag the map!)
    app.locals.routes = routes.slice(0, 5);
    console.log("Using the following routes: " + app.locals.routes);

    for (let i in app.locals.routes) {
      const route_id = app.locals.routes[i];
      API.getStops(ROUTE_TYPE, route_id)
        .then(result => {
          const routeStops = result;
          for (let j in routeStops) {
            if (routeStops[j].stop_id === 1070) {
              index = j;
            }
            routeStops[j].route_id = route_id;
          }
          if (index) {
            routeStops.splice(index, 1);
          }
          stops.push(routeStops);

          API.getDeparturesForRoute(ROUTE_TYPE, route_id, result)
            .then(response => {
              departures.push(response);
              if (departures.length === app.locals.routes.length) {
                let uniqueRuns;
                let filteredRuns;
                let runs = [];
                departures = departures.sort(sortDepartures);
                stops = stops.sort(sortStations);

                // Storing the data in express
                app.locals.stops = stops;
                app.locals.departures = departures;

                for (let k in departures) {
                  uniqueRuns = Departures.getUniqueRuns(departures[k], app.locals.routes[k]);
                  filteredRuns = Departures.getDeparturesForRuns(uniqueRuns, departures[k]);
                  for (let l in filteredRuns) {
                    runs.push({
                      departure: filteredRuns[l].departures,
                      coordinates: Stations.getCoordinatesPair(stops[k], filteredRuns[l].departures[0].stop_id, filteredRuns[l].direction_id)
                    });
                  }
                }
                const data = {
                  runs: runs
                }
                app.locals.data = data;
                console.log("Initialized...");
                console.timeEnd("initiate");
              }
            })
        })
    }
  })
}

// Function that repeats every interval to retrieve the latest dynamic data and process it
var repetition = async function () {
  if (app.locals.stops) {
    console.time("repetition");
    let departures = [];
    stops = app.locals.stops;
    for (let i in app.locals.routes) {
      const route_id = app.locals.routes[i];
      API.getDeparturesForRoute(ROUTE_TYPE, route_id, app.locals.stops[i])
        .then(response => {
          departures.push(response);
          if (departures.length === app.locals.routes.length) {
            let uniqueRuns;
            let filteredRuns;
            let runs = [];
            departures = departures.sort(sortDepartures);
            app.locals.departures = departures;

            for (let k in departures) {
              uniqueRuns = Departures.getUniqueRuns(departures[k], app.locals.routes[k]);
              filteredRuns = Departures.getDeparturesForRuns(uniqueRuns, departures[k]);

              for (let l in filteredRuns) {
                runs.push({
                  departure: filteredRuns[l].departures,
                  coordinates: Stations.getCoordinatesPair(stops[k], filteredRuns[l].departures[0].stop_id, filteredRuns[l].direction_id)
                });
              }
            }
            const data = {
              runs: runs
            }
            console.log("Updated...");
            console.log(data.runs.length);
            app.locals.data = data;
            console.timeEnd("repetition");
          }
        })
    }
  }
}

initiate();
setInterval(repetition, 15000);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/api', indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
