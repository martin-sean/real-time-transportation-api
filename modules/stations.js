module.exports = {
    // Get coordinates of the stops that the train is currently in between
    getCoordinatesPair: function (stops, stop_id, direction_id) {
        let stopsArray;
        let previousStopCoordinates;
        let nextStopCoordinates;
        let previousStopID;
        let valid = false;

        // Scenario when next stop is not the last stop
        if (direction_id === 1) {   // all direction_id 1 goes to City (Flinders Street)
            stopsArray = stops
        } else {                    // any other direction_id is going away from City
            stopsArray = stops.slice().reverse();
        }

        for (let i in stopsArray) {
            if (stopsArray[i].stop_id === stop_id) {
                if (i > 0) {
                    previousStopID = stopsArray[parseInt(i) - 1].stop_id;
                    previousStopCoordinates = [stopsArray[parseInt(i) - 1].stop_latitude, stopsArray[parseInt(i) - 1].stop_longitude];
                    nextStopCoordinates = [stopsArray[i].stop_latitude, stopsArray[i].stop_longitude];
                    nextStopID = stopsArray[parseInt(i)].stop_id;
                } else {
                    nextStopCoordinates = [stopsArray[i].stop_latitude, stopsArray[i].stop_longitude];
                    nextStopID = stopsArray[parseInt(i)].stop_id;
                }
                valid = true;
            }
        }
        return {
            previousStopCoordinates: previousStopCoordinates,
            nextStopCoordinates: nextStopCoordinates,
            previousStopID: previousStopID,
            nextStopID: nextStopID,
            direction_id: direction_id
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
    },
    getDuration: function (previousStopID, nextStopID) {

    }
}