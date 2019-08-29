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
const ROUTE_TYPE = 0;

// Unused station stop IDs
const FLEMINGTON_RC = 1070;

var routes = [];

// Function defined for sorting the array of stations ascendingly according to their route_id
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

// Function defined for sorting the array of departures ascendingly according to their route_id
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

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');


// Function that initiates at the start of the app (process both static and dynamic data)
var initiate = async function () {
  console.time("initiate");
  let departures = [];
  let stops = [];
  let stopIDs = new Set();
  let uniqueStops = [];
  let index;

  // Get all routes for route type
  API.getRoutes(ROUTE_TYPE)
    .then(result => {
      // for(let i in result) {
      //   routes.push(result[i].route_id);
      // }
      routes = result;
      for (let i in routes) {
        const route_id = routes[i].route_id;
        console.log("ROUTE ID = " + route_id + " (" + routes[i].route_name + ")");

        // Get all stops for a given route
        API.getStops(route_id, ROUTE_TYPE)
          .then(result => {
            const routeStops = result;

            for (let j in routeStops) {
              let stopID = routeStops[j].stop_id;

              // Detect unused staions
              if (stopID === FLEMINGTON_RC) {
                index = j;
              }

              // Keep track of unique stations
              if(!stopIDs.has(stopID)) {
                stopIDs.add(stopID);
                uniqueStops.push({
                  stop_id: stopID,
                  stop_name: routeStops[j].stop_name,
                  stop_latitude: routeStops[j].stop_latitude,
                  stop_longitude: routeStops[j].stop_longitude
                });
              }
            }

            // Remove unused stations
            if (index) {
              routeStops.splice(index, 1);
            }

            stops.push({
              routeID: route_id,
              routeStops: routeStops
            });

            // Get all departures for each unique stop when all stops are retrieved
            if(stops.length === routes.length) {
              // Store route descriptions
              app.locals.routes = routes;

              stopIDsArray = Array.from(stopIDs);
              API.getDepartures(routes, ROUTE_TYPE, uniqueStops)
                .then(response => {
                    let routeDepartures = response.routeDepartures;
                    let stationDepartures = response.stationDepartures;

                    let uniqueRunIDs;
                    let filteredRuns;
                    let runs = [];

                    // Storing the data in express
                    app.locals.routeStops = stops;
                    app.locals.uniqueStops = uniqueStops;
                    app.locals.stationDepartures = stationDepartures;

                    // Get depatures for every unique runID
                    for (let k in routeDepartures) {
                      routeID = routeDepartures[k].routeID;
                      uniqueRunIDs = Departures.getUniqueRuns(routeDepartures[k].departures);
                      filteredRuns = Departures.getDeparturesForRuns(uniqueRunIDs, routeDepartures[k].departures);

                      // Get array of departures for the given routeID
                      let routeIDStops;
                      for(let l in stops) {
                        if(stops[l].routeID == routeID) {
                          routeIDStops = stops[l].routeStops;
                        }
                      }

                      // Remove runs that do not have stops in 
                      for (let l in filteredRuns) {
                        let target = new Set();
                        let valid = 0;
                        
                        // Determine all stopIDs covered by all of a given runID departures
                        for(let m in filteredRuns[l].departures) {
                          target.add(filteredRuns[l].departures[m].stop_id);
                        }

                        // Determine if any of the runID stops match up with routeID Stops
                        for(let m in routeIDStops) {
                          if(target.has(routeIDStops[m].stop_id)) {
                            valid++;
                          }
                        }

                        // Require that runID stops are entirely in routeID stops
                        if(valid == target.size) {
                          runs.push({
                            departure: filteredRuns[l].departures,
                            coordinates: Stations.getCoordinatesPair(routeIDStops, filteredRuns[l].departures[0].stop_id, filteredRuns[l].direction_id)
                          });
                        }
                      }
                    }
                    const data = {
                      runs: runs
                    }
                    app.locals.data = data;

                    console.log("Initialized.");
                    console.timeEnd("initiate");
                })
              }
            })
        }
  })
}

// Function that repeats every interval to retrieve the latest dynamic data and process it
var repetition = async function () {
  if (app.locals.routeStops) {
    console.time("repetition");
    let departures = [];
    let stops = app.locals.routeStops;

    API.getDepartures(routes, ROUTE_TYPE, app.locals.uniqueStops)
      .then(response => {
        let routeDepartures = response.routeDepartures;
        let stationDepartures = response.stationDepartures;

        // Update departures stored in Express
        app.locals.stationDepartures = stationDepartures;

        let uniqueRunIDs;
        let filteredRuns;
        let runs = [];

        // Get depatures for every unique runID
        for (let k in routeDepartures) {
          routeID = routeDepartures[k].routeID;
          uniqueRunIDs = Departures.getUniqueRuns(routeDepartures[k].departures);
          filteredRuns = Departures.getDeparturesForRuns(uniqueRunIDs, routeDepartures[k].departures);

          // Find array of departures for routeID
          let routeIDStops;
          for(let l in stops) {
            if(stops[l].routeID == routeID) {
              routeIDStops = stops[l].routeStops;
              break;
            }
          }

          for (let l in filteredRuns) {
            console.log("RunID " + filteredRuns[l].run_id + ", Num departures: " + filteredRuns[l].departures.length);
            
            let target = new Set();
            let valid = 0;
            
            // Determine all stopIDs covered by all of a given runID departures
            for(let m in filteredRuns[l].departures) {
              target.add(filteredRuns[l].departures[m].stop_id);
            }
            
            // Determine if any of the runID stops match up with routeID Stops
            for(let m in routeIDStops) {
              if(target.has(routeIDStops[m].stop_id)) {
                valid++;
              }
            }

            // Require that runID stops are entirely in routeID stops
            if(valid == target.size) {
              runs.push({
                departure: filteredRuns[l].departures,
                coordinates: Stations.getCoordinatesPair(routeIDStops, filteredRuns[l].departures[0].stop_id, filteredRuns[l].direction_id)
              });
            }
          }
        }
        const data = {
          runs: runs
        }
        app.locals.data = data;

        console.log("Updated...");
        console.log(data.runs.length);
        console.timeEnd("repetition");
      })
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
