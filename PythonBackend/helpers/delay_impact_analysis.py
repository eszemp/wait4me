import os
import requests
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import geopandas as gpd
from shapely.geometry import Point
from pyproj import Transformer

load_dotenv()
API_KEY = os.getenv("API_KEY")
API_URL = 'https://odpch-api.clients.liip.ch/ojp20-beta'
NO_OF_CONSIDERED_STOPS = 20

def get_delay_impact_rating(data):
    depStopRef = data['transfer_stop_ref']
    journeyRef = data['outgoing_journey_ref']
    depTime = data['scheduled_departure_time']
    addedDelay = data['requested_delay']

    buffer_upcoming_stops = get_buffers_of_line(depStopRef, depTime, journeyRef, NO_OF_CONSIDERED_STOPS)

    stops_with_broken_connections = 0
    for buffer in buffer_upcoming_stops:
        if (buffer - addedDelay) < 0:
            stops_with_broken_connections += 1

    percentage_of_broken_connections = (stops_with_broken_connections / len(buffer_upcoming_stops)) * 100

    if percentage_of_broken_connections < 10:
        return 'small'
    elif percentage_of_broken_connections < 40:
        return 'medium'
    else:
        return 'large'
    
def get_buffers_of_line(depStopRef, depTime, journeyRef, number_of_stops):

    dt_object = datetime.fromisoformat(depTime)
    depTime = dt_object.isoformat()
    dt_object = dt_object - timedelta(minutes=3)
    searchTime = dt_object.isoformat() # ensure the connection is actually present in the search results

    # get line (stop event request)
    response = post_stop_event_request(depStopRef, searchTime)
    if read_response(response, depTime, journeyRef)==None:
        return [60.0]
    service_name, onward_stops = read_response(response, depTime, journeyRef)

    buffer_times = get_buffer_time_per_stop(service_name, onward_stops)
    print(buffer_times)

    if len(buffer_times) > number_of_stops:
        return buffer_times[0:number_of_stops]
    return buffer_times

def find_stop_by_coord(gpkg_path, lon, lat, ref, name, buffer_m=500):
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:2056", always_xy=True)
    east, north = transformer.transform(lon, lat)
    minx, miny = east - buffer_m, north - buffer_m
    maxx, maxy = east + buffer_m, north + buffer_m

    # print("searching for", name, "in gpkg")

    stops_subset = gpd.read_file(
        gpkg_path, 
        bbox=(minx, miny, maxx, maxy),
        layer='stop_buffers'
    )

    if stops_subset.empty:
        return None
    
    exact_stop = stops_subset[
        (stops_subset['Nummer'] == str(ref)) | 
        (stops_subset['Name'] == name)
    ]

    if len(exact_stop) > 1:
        return exact_stop.iloc[0]
    elif len(exact_stop) == 1:
        return exact_stop.iloc[0]
    
    return None


def get_buffer_time_per_stop(service_name, onward_stops):
    gpkg_path = '../UseCaseStudy/data/stop-places-schweiz/stop-places-schweiz-with-buffers.gpkg'
    results = []
    for s in onward_stops:
        stop = find_stop_by_coord(gpkg_path, 
                                  float(s['Longitude']), 
                                  float(s['Latitude']), 
                                  s['StopPlaceRef'], 
                                  s['StopName'])
        
        if stop is None:
            print('stop not found in gpkg')
            continue

        raw_data = stop['buffer_timeseries']
        if raw_data == 'NO TRANSFERS':
            continue

        buffer_list = json.loads(raw_data) if isinstance(raw_data, str) else raw_data

        target_dt = datetime.fromisoformat(s['TimetabledArrival'].replace('Z', '+00:00'))
        target_time_secs = target_dt.hour * 3600 + target_dt.minute * 60 + target_dt.second

        best_buffer = None
        min_diff = float('inf')

        for entry in buffer_list:
            if entry['incoming_line_id'] == service_name:
                entry_dt = datetime.fromisoformat(entry['time'].replace('Z', '+00:00'))
                entry_time_secs = entry_dt.hour * 3600 + entry_dt.minute * 60 + entry_dt.second
                
                diff = abs(target_time_secs - entry_time_secs)
                
                if diff < min_diff:
                    min_diff = diff
                    best_buffer = entry['buffer'] / 60 # convert into minutes
                    
        # print('closest match with', min_diff, 'seconds difference to searched time')

        results.append(best_buffer)

    return results


def read_response(xml, reqDepTime, reqJourneyRef):
    
    namespaces = {'ojp': 'http://www.vdv.de/ojp', 'siri': 'http://www.siri.org.uk/siri'}

    root = ET.fromstring(xml)

    stop_context_lookup = {}
    places = root.findall('.//ojp:StopEventResponseContext/ojp:Places/ojp:Place', namespaces)
    
    for place in places:
        stop_point = place.find('ojp:StopPoint', namespaces)
        if stop_point is not None:
            ref = stop_point.find('siri:StopPointRef', namespaces).text
            parent_ref = stop_point.find('ojp:ParentRef', namespaces)
            geo = place.find('ojp:GeoPosition', namespaces)
            
            stop_context_lookup[ref] = {
                'ParentRef': parent_ref.text if parent_ref is not None else "N/A",
                'Lon': geo.find('siri:Longitude', namespaces).text if geo is not None else "0.0",
                'Lat': geo.find('siri:Latitude', namespaces).text if geo is not None else "0.0"
            }

    stop_event_results = root.findall('.//ojp:StopEventResult', namespaces)
    for ser in stop_event_results:
        if ser is None:
            print("No StopEventResult found in the response.")
            return None
        
        departure_time = ser.find('.//ojp:ThisCall/ojp:CallAtStop/ojp:ServiceDeparture/ojp:TimetabledTime', namespaces)
        departure_time = departure_time.text if departure_time is not None else "N/A"

        journey_ref = ser.find('.//ojp:Service/ojp:JourneyRef', namespaces)
        journey_ref = journey_ref.text if journey_ref is not None else "N/A"

        # ensure the correct line has been found
        print(datetime.fromisoformat(departure_time))
        print(datetime.fromisoformat(reqDepTime))
        print(journey_ref)
        print(reqJourneyRef)
        if (datetime.fromisoformat(departure_time) != datetime.fromisoformat(reqDepTime)) or (journey_ref != reqJourneyRef):
            continue

        service_name_element = ser.find('.//ojp:Service/ojp:PublishedServiceName/ojp:Text', namespaces)
        service_name = service_name_element.text if service_name_element is not None else "N/A"

        onward_calls_data = []
        onward_calls = ser.findall('.//ojp:OnwardCall/ojp:CallAtStop', namespaces)
        
        for call in onward_calls:
            stop_point_ref = call.find('siri:StopPointRef', namespaces).text
            stop_name = call.find('.//ojp:StopPointName/ojp:Text', namespaces).text
            arrival_time = call.find('.//ojp:ServiceArrival/ojp:TimetabledTime', namespaces).text

            context = stop_context_lookup.get(stop_point_ref, {})
            
            onward_calls_data.append({
                'StopName': stop_name,
                'StopPointRef': stop_point_ref,
                'StopPlaceRef': context.get('ParentRef', 'N/A'),
                'Longitude': context.get('Lon', '0.0'),
                'Latitude': context.get('Lat', '0.0'),
                'TimetabledArrival': arrival_time
            })


        print(f"Service Name: {service_name}")
        for entry in onward_calls_data:
            print(f" - {entry['StopName']} (Parent: {entry['StopPlaceRef']}) @ [{entry['Latitude']}, {entry['Longitude']}]")

        return service_name, onward_calls_data
    


def post_stop_event_request(depStopRef, depTime):
    timestamp = datetime.now(timezone.utc).isoformat()
    xml_request = f"""<?xml version="1.0" encoding="UTF-8"?>
    <OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0">
        <OJPRequest>
            <siri:ServiceRequest>
                <siri:RequestTimestamp>{timestamp}</siri:RequestTimestamp>
                <siri:RequestorRef>Wait4Me</siri:RequestorRef>
                <OJPStopEventRequest>
                    <siri:RequestTimestamp>{timestamp}</siri:RequestTimestamp>
                    <Location>
                        <PlaceRef>
                            <siri:StopPointRef>{depStopRef}</siri:StopPointRef>
                        </PlaceRef>
                        <DepArrTime>{depTime}</DepArrTime>
                    </Location>
                    <Params>
                        <NumberOfResults>{20}</NumberOfResults>
                        <IncludeOnwardCalls>1</IncludeOnwardCalls>
                        <IncludeRealtimeData>full</IncludeRealtimeData>
                    </Params>
                </OJPStopEventRequest>
            </siri:ServiceRequest>
        </OJPRequest>
    </OJP>"""
    
    headers = {
        'Content-Type': 'application/xml',
        'Authorization': f'Bearer {API_KEY}'
    }

    try:
        response = requests.post(API_URL, data=xml_request, headers=headers)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Error during API request: {e}")
        return None
    

if __name__ == "__main__":
    get_buffers_of_line('8503000','2026-05-01 10:39:00+00', 'ch:1:sjyid:100001:19547-001', 20)
