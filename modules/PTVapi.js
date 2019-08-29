const axios = require('axios');
const crypto = require('crypto');
const moment = require('moment');

const baseURL = 'https://timetableapi.ptv.vic.gov.au';
const apiKey = process.env.API_KEY;
const devID = process.env.DEV_ID;


// Generate signature for the API request
function encryptSignature(url) {
    return crypto.createHmac('sha1', apiKey).update(url).digest('hex');
}

function compareStops(a, b) {
    const aStopSequence = a.stop_sequence;
    const bStopSequence = b.stop_sequence;

    let comparison = 0;
    if (aStopSequence > bStopSequence) {
        comparison = 1;
    } else if (aStopSequence < bStopSequence) {
        comparison = -1;
    }

    return comparison;
}

// Used to determine where a route ID is inside of the route descriptions
function getRouteIndex(route, route_id) {
    result = -1;
    for(let i in route) {
        if(route[i].route_id == route_id) {
            return i;
        }
    }
    return result;
}

// Call to PTV API to get all departures for a specific stop
async function getDeparturesForStop(stop_id, route_type) {
    const request = '/v3/departures/route_type/' + route_type + '/stop/' + stop_id + '?look_backwards=false&max_results=1&devid=' + devID;
    const signature = encryptSignature(request);

    const departures = await axios.get(baseURL + request + '&signature=' + signature)
        .then(response => {
            return response.data.departures;
        })
        .catch(error => {
            console.log(error);
        })
    return departures;
}

module.exports = {
    // To check if the connection to the API is working
    healthCheck: async function () {
        const timestamp = moment.utc().format();
        const request = '/v2/healthcheck?timestamp=' + timestamp + '&devid=' + devID;
        const signature = encryptSignature(request);
        const result = await axios.get(baseURL + request + '&signature=' + signature)
            .then(response => {
                return response;
            })
            .catch(error => {
                console.log(error);
            })
        return result;
    },
    // Function to retreive all the stops for a train line
    getStops: async function (route_id, route_type) {
        const request = '/v3/stops/route/' + route_id + '/route_type/' + route_type + '?direction_id=1&devid=' + devID;
        const signature = encryptSignature(request);

        const stops = await axios.get(baseURL + request + '&signature=' + signature)
            .then(response => {
                const stops = response.data.stops.sort(compareStops);
                return stops;
            })
            .catch(error => {
                console.log(error);
            })
        return stops;
    },
    // Retreive all the departures for stations and routes
    getDepartures: async function (routes, route_type, uniqueStops) {
        let routeIndexes = [];
        let routeDepartures = [];
        let stationDepartures = [];

        // Set up array of departures for each route ID
        for(let i in routes) {
            routeDepartures.push({
                routeID: routes[i].route_id,
                departures: []
            })
        }

        for (let i in uniqueStops) {
            const stop_id = uniqueStops[i].stop_id;
            
            // Get all departures for a station
            let stopDepartures = {
                stop_id: stop_id,
                stop_name: uniqueStops[i].stop_name,
                stop_latitude: uniqueStops[i].stop_latitude,
                stop_longitude: uniqueStops[i].stop_longitude,
                departures: await getDeparturesForStop(stop_id, route_type)
                .then(response => {
                    return response;
                })
                .catch(error => {
                    console.log(error);
                }) 
            };
            console.log("(" + i + "/" + uniqueStops.length +
                        ") Updating " + stopDepartures.stop_name +
                        " (ID = " + stopDepartures.stop_id +")");
            stationDepartures.push(stopDepartures);

            // Append departures from a station to associated route departure array
            for(let j in stopDepartures.departures) {
                let routeIndex = getRouteIndex(routes, stopDepartures.departures[j].route_id);
                if(routeIndex != -1) {
                    routeDepartures[routeIndex].departures.push(stopDepartures.departures[j]);
                }
            }
        }
        return {
            routeDepartures: routeDepartures,
            stationDepartures: stationDepartures
        };
    },
    // Get routes for a given transportation type.
    getRoutes: async function (route_type) {
        const request = '/v3/routes?route_types=' + route_type + '&devid=' + devID;
        const signature = encryptSignature(request);
        const routes = await axios.get(baseURL + request + '&signature=' + signature)
            .then(response => {
                return response.data.routes;
            })
            .catch(error => {
                console.log(error);
            })
        return routes;
    }
}