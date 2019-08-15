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

// Call to PTV API to get departures for a specific stop
async function getDeparturesForStop(route_type, route_id, stop_id) {
    const request = '/v3/departures/route_type/' + route_type + '/stop/' + stop_id + '/route/' + route_id + '?look_backwards=false&max_results=1&devid=' + devID;
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
    getStops: async function (route_type, route_id) {
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
    // Functions to retreive all the departures for a train line
    getDeparturesForRoute: async function (route_type, route_id, stops) {
        let departures = [];
        for (let i in stops) {
            const stop_id = stops[i].stop_id;

            departures.push(await getDeparturesForStop(route_type, route_id, stop_id)
                .then(response => {
                    // Log whether route has estimated time
                    for(let i in response) {
                        if(response[i].estimated_departure_utc) {
                            console.log("RouteID = " + response[i].route_id + ", estimated_departure_utc = " + response[i].estimated_departure_utc);
                        } else {
                            console.log("RouteID = " + response[i].route_id + ", estimated_departure_utc = NONE");
                        }
                    }
                    return response;
                })
                .catch(error => {
                    console.log(error);
                })
            )
        }
        return departures;
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