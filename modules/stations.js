function getNextPrevStopID(routeStops, run) {
    let stopsArray;
    let prevStopID;
    let nextStopID;
    let direction_id = run.departures[run.currentDeparture].direction_id;

    // Scenario when next stop is not the last stop
    if (direction_id === 1) {   // all direction_id 1 goes to City (Flinders Street)
        stopsArray = routeStops
    } else {                    // any other direction_id is going away from City
        stopsArray = routeStops.slice().reverse();
    }

    if(run.currentDeparture > 0) {
        // Run departures are known
        prevStopID = run.departures[run.currentDeparture - 1].stop_id;
        nextStopID = run.departures[run.currentDeparture].stop_id;
    } else {
        // Infer stops based on route pattern
        let stop_id = run.departures[run.currentDeparture].stop_id;
        for (let i in stopsArray) {
            if (stopsArray[i].stop_id === stop_id) {
                if (i > 0) {
                    prevStopID = stopsArray[i - 1].stop_id;
                    nextStopID = stopsArray[i].stop_id;
                } else {
                    nextStopID = stopsArray[i].stop_id;
                }
            }
        }
    }

    return {
        prevStopID: prevStopID,
        nextStopID: nextStopID
    }
}

module.exports = {
    // Get coordinates of the stops that the train is currently in between
    getCoordinatesPair: function (routeStops, uniqueStops, run) {
        let nextPrevStopIDs = getNextPrevStopID(routeStops, run);
        let prevStopID = nextPrevStopIDs.prevStopID;
        let nextStopID = nextPrevStopIDs.nextStopID;

        let previousStopCoordinates;
        if(prevStopID) {
            previousStopCoordinates = [uniqueStops.get(prevStopID).stop_latitude, uniqueStops.get(prevStopID).stop_longitude];
        }
        let nextStopCoordinates = [uniqueStops.get(nextStopID).stop_latitude, uniqueStops.get(nextStopID).stop_longitude];

        return {
            previousStopCoordinates: previousStopCoordinates,
            nextStopCoordinates: nextStopCoordinates,
            prevStopID: prevStopID,
            nextStopID: nextStopID,
            direction_id: run.departures[run.currentDeparture].direction_id
        }
    },
    // Get coordinates of the stop when the train is at platform
    getStopCoordinate: function (stops, stop_id) {
        for (let i in stops) {
            if (stops[i].stop_id === stop_id) {
                const stop_latitude = stops[i].stop_latitude;
                const stop_longitude = stops[i].stop_longitude;
                const coordinates = [stop_latitude, stop_longitude];
                return coordinates;
            }
        }
    }
}