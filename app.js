require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var debugRouter = require('./routes/debug');

var API = require('./modules/PTVapi');
var Stations = require('./modules/stations');
var Departures = require('./modules/departures');

var app = express();

// const routes = [1, 2, 3, 4, 5, 6, 7, 8, 15, 14];
const routes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17];

var sortStations = function (a, b) {
  const aRouteID = a[0].route_id;
  const bRouteID = b[0].route_id;

  const aRouteIDIndex = routes.indexOf(aRouteID);
  const bRouteIDIndex = routes.indexOf(bRouteID);

  let comparison = 0;
  if (aRouteIDIndex > bRouteIDIndex) {
    comparison = 1;
  } else if (aRouteIDIndex < bRouteIDIndex) {
    comparison = -1;
  }

  return comparison;
}

var sortDepartures = function (a, b) {
  const aRouteID = a[0][0].route_id;
  const bRouteID = b[0][0].route_id;
  const aRouteIDIndex = routes.indexOf(aRouteID);
  const bRouteIDIndex = routes.indexOf(bRouteID);

  let comparison = 0;
  if (aRouteIDIndex > bRouteIDIndex) {
    comparison = 1;
  } else if (aRouteIDIndex < bRouteIDIndex) {
    comparison = -1;
  }

  return comparison;
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

var initiate = async function () {
  let departures = [];
  let stops = [];
  let index;
  for (let i in routes) {
    const route_id = routes[i];
    API.getStops(route_id)
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

        API.getDeparturesForRoute(route_id, result)
          .then(response => {
            departures.push(response);
            if (departures.length === routes.length) {
              let uniqueRuns;
              let filteredRuns;
              let runs = [];
              departures = departures.sort(sortDepartures);
              stops = stops.sort(sortStations);

              app.locals.stops = stops;
              app.locals.departures = departures;

              for (let k in departures) {
                uniqueRuns = Departures.getUniqueRuns(departures[k], routes[k]);
                filteredRuns = Departures.getDeparturesForRuns(uniqueRuns, departures[k]);

                for (let l in filteredRuns) {
                  runs.push({
                    departure: filteredRuns[l].departures,
                    coordinates: Stations.getCoordinatesPair(stops[k], filteredRuns[l].departures[0].stop_id, filteredRuns[l])
                  });
                }
              }
              const data = {
                runs: runs
              }
              app.locals.data = data;
              console.log("Done");
              // console.log(app.locals.stops);
              // console.log(runsAtStation);
              // console.log(runsBetweenStations);
            }
          })
      })
  }
}

var recursive = async function () {
  if (app.locals.stops) {
    let departures = [];
    for (let i in routes) {
      const route_id = routes[i];
      API.getDeparturesForRoute(route_id, app.locals.stops[i])
        .then(response => {
          departures.push(response);
          if (departures.length === routes.length) {
            let uniqueRuns;
            let filteredRuns;
            let runs = [];
            departures = departures.sort(sortDepartures);
            stops = app.locals.stops;
            app.locals.departures = departures;

            for (let k in departures) {
              uniqueRuns = Departures.getUniqueRuns(departures[k], routes[k]);
              filteredRuns = Departures.getDeparturesForRuns(uniqueRuns, departures[k]);

              for (let l in filteredRuns) {
                runs.push({
                  departure: filteredRuns[l].departures,
                  coordinates: Stations.getCoordinatesPair(stops[k], filteredRuns[l].departures[0].stop_id, filteredRuns[l])
                });
              }
            }
            const data = {
              runs: runs
            }
            console.log(data);
            app.locals.data = data;
          }
        })
    }
  }
}

initiate();
setInterval(recursive, 15000);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/api', indexRouter);
app.use('/users', usersRouter);
app.use('/debug', debugRouter);

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
