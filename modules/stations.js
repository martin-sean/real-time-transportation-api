module.exports = {
    // Get coordinates of the stops that the train is currently in between
    getCoordinatesPair: function (stops, stop_id, filteredDepartures) {
        const lastStopID = stops[stops.length - 1].stop_id;

        let stopsArray;
        let nextStopCoordinates;
        let previousStopCoordinates;

        let nextStopID = filteredDepartures.departures[0].stop_id;
        let nextNextStopID = filteredDepartures.departures[1].stop_id;

        // Scenario when next stop is not the last stop

        if (nextNextStopID) {
            for (let i in stops) {
                if (stops[i].stop_id === nextStopID) {
                    if (i < stops.length - 1) {
                        if (stops[parseInt(i) + 1].stop_id === nextNextStopID) {
                            stopsArray = stops;
                        }
                    } else {
                        stopsArray = stops.slice().reverse();
                    }
                }
            }
        } else {
            if (nextStopID = lastStopID) {
                stopsArray = stops;
            } else {
                stopsArray = stops.slice().reverse();
            }
        }

        for (let i in stopsArray) {
            if (stopsArray[i].stop_id === stop_id) {
                if (i > 0) {
                    previousStopCoordinates = [stopsArray[i - 1].stop_latitude, stopsArray[i - 1].stop_longitude];
                    nextStopCoordinates = [stopsArray[i].stop_latitude, stopsArray[i].stop_longitude];
                } else {
                    nextStopCoordinates = [stopsArray[i].stop_latitude, stopsArray[i].stop_longitude];
                }
            }
        }

        return {
            previousStopCoordinates: previousStopCoordinates,
            nextStopCoordinates: nextStopCoordinates,
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
}