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


/**
 * Initially populate the maps data structures
 *
 * @returns {Promise<void>} Not currently used
 */
async function initiate() {
  console.time("initiate");
  // Get all routes for a given route type (Train/Tram)
  API.getRoutes(ROUTE_TYPE)
      .then(result => {
        routes = result; // Save the routes in the instance variable
        let stops = [];
        let stopIDs = new Set();
        let uniqueStops = [];
        // For each route, get the stops and directions
        for (let route in routes) {
          const route_id = routes[route].route_id;
          console.log("ROUTE ID = " + route_id + " (" + routes[route].route_name + ")");
          getDirectionsForRoute(route, route_id);
          getStopsForRoute(route_id, stops, uniqueStops, stopIDs);
        }
      });
};

/**
 * Get directions for a given route
 *
 * @param route       Route data from the API
 * @param route_id    Associated id of @param route
 */
async function getDirectionsForRoute(route, route_id) {
  API.getDirections(route_id)
      .then(directions => {
        routes[route].directions = directions;
        console.log("Route ID " + route_id + " directions:");
        for (let direction in routes[route].directions) {
          console.log("\t ID: " + directions[direction].direction_id + " = " + directions[direction].direction_name);
        }
      });
}

/**
 * Get the stops for a given route
 *
 * @param route_id      id of the route to get stops for
 * @param stops         collection of stops to get departures for
 * @param uniqueStops   collection of unique stops
 * @param stopIDs       set of stopIDs for identifying unique stops
 */
async function getStopsForRoute(route_id, stops, uniqueStops, stopIDs) {
  API.getStops(route_id, ROUTE_TYPE)
      .then(routeStops => {
        let index; // Index of unused station

        // For each stop in a route
        for (let stop in routeStops) {
          let stopID = routeStops[stop].stop_id;
          // Detect unused stations
          if (stopID === FLEMINGTON_RC) {
            index = stop;
          }
          // Build a list of distinct stops
          if (!stopIDs.has(stopID)) {
            stopIDs.add(stopID);
            uniqueStops.push({
              stop_id: stopID,
              stop_name: routeStops[stop].stop_name,
              stop_latitude: routeStops[stop].stop_latitude,
              stop_longitude: routeStops[stop].stop_longitude
            });
          }
        } // end of for each loop

        // Remove unused stations
        if (index) {
          routeStops.splice(index, 1);
        }

        // Build stops collection
        stops.push({
          routeID: route_id,
          routeStops: routeStops
        });

        // Get all departures for each unique stop when all stops are retrieved
        if (stops.length === routes.length) {
          // Store route descriptions
          app.locals.routes = routes;
          getDeparturesForStops(stops, uniqueStops, false)
        }
      })
}

/**
 * Get the departures for a given stop
 *
 * @param stops           collection of stops in a route
 * @param uniqueStops     collection of unique stops in a route
 * @param repetition      false if initial run, true for repetitions
 */
async function getDeparturesForStops(stops, uniqueStops, repetition) {
  API.getDepartures(routes, ROUTE_TYPE, uniqueStops)
      .then(response => {
        let routeDepartures = response.routeDepartures;
        let stationDepartures = response.stationDepartures;

        let uniqueRunIDs;
        let filteredRuns;
        let runs = [];

        // Storing the data in express
        if (repetition) {
          app.locals.routeStops = stops;
          app.locals.uniqueStops = uniqueStops;
        }
        app.locals.stationDepartures = stationDepartures;

        // Get departures for every unique runID
        for (let k in routeDepartures) {
          const routeID = routeDepartures[k].routeID;
          uniqueRunIDs = Departures.getUniqueRuns(routeDepartures[k].departures);
          filteredRuns = Departures.getDeparturesForRuns(uniqueRunIDs, routeDepartures[k].departures);

          // Get array of departures for the given routeID
          let routeIDStops;
          for (let l in stops) {
            if (stops[l].routeID === routeID) {
              routeIDStops = stops[l].routeStops;
              if (repetition) break;
            }
          }

          // Remove runs that do not have stops in
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
        app.locals.data = {
          runs: runs
        };

        console.log(repetition ? "Updated..." : "Initialised...");
        console.log(app.locals.data.runs.length);
        console.timeEnd(repetition ? "repetition" : "initiate");
        repetitionReady = true;
      })
}

/**
 * Runs every ptvAPIRepFreq milliseconds to update the departures
 *
 * @returns {Promise<void>}   Not used
 */
async function repetition() {
  // Return if there are no recent requests clients
  if (!API.lastUpdate || new Date().getTime() - API.lastUpdate > apiDemandThreshold) return console.log("--No clients connected--");
  // Return if a repetition is already running
  if (!repetitionReady) return console.log("Repetition is already running")
  repetitionReady = false;
  await checkRouteTypeToggleRequest();
  await getDeparturesForStops(app.locals.routeStops, app.locals.uniqueStops, true);
}

// Check for a requested change in route type
async function checkRouteTypeToggleRequest() {
  if (toggleRouteType) {
    console.log("Reinitialising with new route type");
    toggleRouteType = false;
    ROUTE_TYPE = 1 - ROUTE_TYPE; // Toggle Route Type
    // Clear the existing data
    app.locals.routeStops = [];
    app.locals.uniqueStops = [];
    app.locals.stationDepartures = [];
    await initiate();
    setInterval(repetition, apiDemandThreshold); // TODO: SET THE CORRECT API THRESHOLD
  }
}

initiate();
let refresh = setInterval(repetition, ptvAPIRepFreq);

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
