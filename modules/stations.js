module.exports = {
    // Get coordinates of the stops that the train is currently in between
    getCoordinatesPair: function (stops, stop_id, filteredDepartures) {
        const lastStopID = stops[stops.length - 1].stop_id;

        let stopsArray;
        let previousStopCoordinates;
        let nextStopCoordinates;
        let previousStopID;
        let direction_id;

        let nextStopID = filteredDepartures.departures[0].stop_id;
        let nextNextStopID;
        if (filteredDepartures.departures[1]) {
            nextNextStopID = filteredDepartures.departures[1].stop_id;
        }

        // Scenario when next stop is not the last stop

        if (nextNextStopID) {
            for (let i in stops) {
                if (stops[i].stop_id === nextStopID) {
                    if (i < stops.length - 1) {
                        if (stops[parseInt(i) + 1].stop_id === nextNextStopID) {
                            stopsArray = stops;
                            direction_id = 1;
                        } else {
                            stopsArray = stops.slice().reverse();
                            direction_id = 2;
                        }
                    } else {
                        stopsArray = stops.slice().reverse();
                        direction_id = 2;
                    }
                }
            }
        } else {
            if (nextStopID = lastStopID) {
                stopsArray = stops;
                direction_id = 1;
            } else {
                stopsArray = stops.slice().reverse();
                direction_id = 2;
            }
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