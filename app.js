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

const routes = [1, 3, 15, 14];

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
  for (let i in routes) {
    const route_id = routes[i];
    API.getStops(route_id)
      .then(result => {
        const routeStops = result;
        for (let j in routeStops) {
          routeStops[j].route_id = route_id;
        }
        stops.push(routeStops);

        API.getDeparturesForRoute(route_id, result)
          .then(response => {
            departures.push(response);
            if (departures.length === routes.length) {
              let runs;
              let filteredRuns;
              let runsAtStation = [];
              let runsBetweenStations = [];
              departures = departures.sort(sortDepartures);
              stops = stops.sort(sortStations);

              app.locals.stops = stops;
              app.locals.departures = departures;

              for (let k in departures) {
                runs = Departures.getUniqueRuns(departures[k], routes[k]);
                filteredRuns = Departures.getDeparturesForRuns(runs, departures[k]);

                for (let l in filteredRuns) {
                  if (filteredRuns[l].departures[0].at_platform) {
                    runsAtStation.push({
                      departure: filteredRuns[l].departures[0],
                      coordinates: Stations.getStopCoordinate(stops[k], filteredRuns[l].departures[0].stop_id)
                    });
                  } else {
                    runsBetweenStations.push({
                      departure: filteredRuns[l].departures[0],
                      coordinates: Stations.getCoordinatesPair(stops[k], filteredRuns[l].departures[0].stop_id, filteredRuns[l].direction_id)
                    });
                  }
                }
              }
              const data = {
                runsAtStation: runsAtStation,
                runsBetweenStations: runsBetweenStations
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
  let departures = [];
  for (let i in routes) {
    const route_id = routes[i];
    API.getDeparturesForRoute(route_id, app.locals.stops[i])
      .then(response => {
        departures.push(response);
        if (departures.length === routes.length) {
          let runs;
          let filteredRuns;
          let runsAtStation = [];
          let runsBetweenStations = [];
          departures = departures.sort(sortDepartures);
          stops = app.locals.stops;
          app.locals.departures = departures;

          for (let k in departures) {
            runs = Departures.getUniqueRuns(departures[k], routes[k]);
            filteredRuns = Departures.getDeparturesForRuns(runs, departures[k]);

            for (let l in filteredRuns) {
              if (filteredRuns[l].departures[0].at_platform) {
                runsAtStation.push({
                  departure: filteredRuns[l].departures[0],
                  coordinates: Stations.getStopCoordinate(stops[k], filteredRuns[l].departures[0].stop_id)
                });
              } else {
                runsBetweenStations.push({
                  departure: filteredRuns[l].departures[0],
                  coordinates: Stations.getCoordinatesPair(stops[k], filteredRuns[l].departures[0].stop_id, filteredRuns[l].direction_id)
                });
              }
            }
          }
          const data = {
            runsAtStation: runsAtStation,
            runsBetweenStations: runsBetweenStations
          }
          app.locals.data = data;
          console.log(data);
        }
      })
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

const port = process.env.PORT || 5000;
app.listen(port);

console.log('App is listening on port ' + port);

module.exports = app;
