from ojp_stop_event_request import get_buffers_of_line

NO_OF_CONSIDERED_STOPS = 20

def get_delay_impact_rating(data):
    depStopRef = data['transfer_stop_ref']
    depTime = data['scheduled_departure_time']
    addedDelay = data['requested_delay']

    buffer_upcoming_stops = get_buffers_of_line(depStopRef, depTime, NO_OF_CONSIDERED_STOPS)

    if not buffer_upcoming_stops:
        return 'small'

    stops_with_broken_connections = 0
    for buffer in buffer_upcoming_stops:
        if (buffer - addedDelay) < 0:
            stops_with_broken_connections += 1

    percentage_of_broken_connections = (stops_with_broken_connections / len(buffer_upcoming_stops)) * 100

    if percentage_of_broken_connections < 15:
        return 'small'
    elif percentage_of_broken_connections < 50:
        return 'medium'
    else:
        return 'large'
