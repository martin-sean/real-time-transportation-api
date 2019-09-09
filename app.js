// Load environment variables
require('dotenv').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

// Self-defined modules
const API = require('./modules/PTVapi');
const Stations = require('./modules/stations');
const Departures = require('./modules/departures');

const app = express();

// Transport type to lookup
// 0 = Train, 1 = Tram
let ROUTE_TYPE = 0;
let toggleRouteType = false;

// Prevent simultaneous repetitions
let repetitionReady = false;

// Unused station stop IDs
const FLEMINGTON_RC = 1070;

let routes = [];

const SECONDS_TO_MS = 1000;

// Set default PTV API call frequency (30 seconds)
let ptvAPIRepFreq = 30 * SECONDS_TO_MS;

// Set default demand threshold since last client connected (60 seconds)
let apiDemandThreshold = 60 * SECONDS_TO_MS;

// Sort array of stations by route_id in ascending order
const sortStations = function (a, b) {
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
};

// Sort array of departures by route_id in ascending order
const sortDepartures = function (a, b) {
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
};

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Function that initiates at the start of the app (process both static and dynamic data)
const initiate = async function () {
  console.time("initiate");
  let departures = [];
  let stops = [];
  let stopIDs = new Set();
  let uniqueStops = [];
  let index;

  // Get all routes for route type
  API.getRoutes(ROUTE_TYPE)
      .then(result => {
        routes = result;
        for (let i in routes) {

          const route_id = routes[i].route_id;
          console.log("ROUTE ID = " + route_id + " (" + routes[i].route_name + ")");

          // Get directions
          API.getDirections(route_id)
              .then(result => {
                routes[i].directions = result;
                console.log("Route ID " + route_id + " directions:");
                for (let j in routes[i].directions) {
                  console.log("\t ID: " + result[j].direction_id + " = " + result[j].direction_name);
                }
              });

          // Get all stops for a given route
          API.getStops(route_id, ROUTE_TYPE)
              .then(result => {
                const routeStops = result;

                for (let j in routeStops) {
                  let stopID = routeStops[j].stop_id;

                  // Detect unused stations
                  if (stopID === FLEMINGTON_RC) {
                    index = j;
                  }

                  // Keep track of unique stations
                  if (!stopIDs.has(stopID)) {
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
                if (stops.length === routes.length) {
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
                          for (let l in stops) {
                            if (stops[l].routeID === routeID) {
                              routeIDStops = stops[l].routeStops;
                            }
                          }

                          // Remove runs that do not have stops in
                          for (let l in filteredRuns) {
                            let target = new Set();
                            let valid = 0;

                            // Determine all stopIDs covered by all of a given runID departures
                            for (let m in filteredRuns[l].departures) {
                              target.add(filteredRuns[l].departures[m].stop_id);
                            }

                            // Determine if any of the runID stops match up with routeID Stops
                            for (let m in routeIDStops) {
                              if (target.has(routeIDStops[m].stop_id)) {
                                valid++;
                              }
                            }

                            // Require that runID stops are entirely in routeID stops
                            if (valid === target.size) {
                              runs.push({
                                departure: filteredRuns[l].departures,
                                coordinates: Stations.getCoordinatesPair(routeIDStops, filteredRuns[l].departures[0].stop_id, filteredRuns[l].direction_id)
                              });
                            }
                          }
                        }
                        app.locals.data = {
                          runs: runs
                        };

                        console.log("Initialized.");
                        console.timeEnd("initiate");
                        repetitionReady = true;
                      })
                }
              })
        }
      });
};

// Function that repeats every interval to retrieve the latest dynamic data and process it
const repetition = async function () {
  // Return if the last API call was longer than the threshold
  if (!API.lastUpdate || new Date().getTime() - API.lastUpdate > apiDemandThreshold) {
    console.log("--No clients connected--");
    return;
  }

  // Only allow single repetition running
  if (!repetitionReady) {
    console.log("Already Running");
    return;
  }
  repetitionReady = false;

  // Check for a requested change in route type
  if (toggleRouteType) {
    console.log("Reinitialising with new route type");
    toggleRouteType = false;
    // Toggle Route Type
    ROUTE_TYPE = 1 - ROUTE_TYPE;
    // Clear the existing data
    app.locals.routeStops = [];
    app.locals.uniqueStops = [];
    app.locals.stationDepartures = [];
    await initiate();
    setInterval(repetition, apiDemandThreshold);
  }

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
            for (let l in stops) {
              if (stops[l].routeID === routeID) {
                routeIDStops = stops[l].routeStops;
                break;
              }
            }

            for (let l in filteredRuns) {
              console.log("RunID " + filteredRuns[l].run_id + ", Num departures: " + filteredRuns[l].departures.length);

              let target = new Set();
              let valid = 0;

              // Determine all stopIDs covered by all of a given runID departures
              for (let m in filteredRuns[l].departures) {
                target.add(filteredRuns[l].departures[m].stop_id);
              }

              // Determine if any of the runID stops match up with routeID Stops
              for (let m in routeIDStops) {
                if (target.has(routeIDStops[m].stop_id)) {
                  valid++;
                }
              }

              // Require that runID stops are entirely in routeID stops
              if (valid === target.size) {
                runs.push({
                  departure: filteredRuns[l].departures,
                  coordinates: Stations.getCoordinatesPair(routeIDStops, filteredRuns[l].departures[0].stop_id, filteredRuns[l].direction_id)
                });
              }
            }
          }
          const data = {
            runs: runs
          };
          app.locals.data = data;

          console.log("Updated...");
          console.log(data.runs.length);
          console.timeEnd("repetition");
          repetitionReady = true;
        });
  }
};

initiate();
var refresh = setInterval(repetition, ptvAPIRepFreq);

// TODO: Cleanup
// Cyclic dependency with index.js, module.exports must be called before requiring index.js.
// Possibly move route type into PTVapi.js instead.
module.exports = {
  app,
  // Notify that the route type should be toggled at the end of the repetition
  notifyToggleRouteType: function () {
    toggleRouteType = true;
  }
};

// Router to handle requests
const indexRouter = require('./routes/index');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


// Forward other requests to router
app.use('/', indexRouter);
app.use('/api', indexRouter);

// Handle requests to update refresh rate
app.use('/refresh', function (req, res, next) {
  if(refresh != null) {
    if(req.body.refreshRate != null) {
      let refreshRate = req.body.refreshRate;

      res.send("Updating refresh rate to: " + refreshRate + " seconds");
      console.log("Updating refresh rate to: " + refreshRate + " seconds");

      // Reset refresh timer with new rate
      API.notifyUpdate();
      clearInterval(refresh);
      ptvAPIRepFreq = refreshRate * SECONDS_TO_MS;
      refresh = setInterval(repetition, ptvAPIRepFreq);

      apiDemandThreshold = 2 * ptvAPIRepFreq;
    } else {
      // Return current refresh rate
      res.json({refresh: ptvAPIRepFreq / SECONDS_TO_MS});
    }
  } else {
    res.send("Wait for initialisation to finish...");
  }
});

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
