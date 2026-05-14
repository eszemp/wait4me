import requests
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from UseCaseStudy.scripts.helpers.ojp_arrivals_and_departures import OJPStopDepArrRequest

load_dotenv(dotenv_path='.env', override=True)
API_KEY = os.getenv("GEOPS_API_KEY")
FEED_NAME = "sbb" 
SWISS_BBOX = "663000,5750000,1168000,6070000" # EPSG:3857 (Web Mercator)

output = '00-realtime-testcases.txt'

ojp_client = OJPStopDepArrRequest()


def get_delayed_trains(min_delay_ms=600000):
    """
    Fetches trains across Switzerland with a delay >= 10 minutes.
    """

    url = f"https://api.geops.io/tracker-http/v1/trajectories/{FEED_NAME}/"
    params = {"bbox": SWISS_BBOX, "key": API_KEY, "mots": "rail", "gen_level": 10}
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    except requests.exceptions.RequestException as e:
        print(f"API Request failed: {e}")
        return []

    delayed_trains = []

    for feature in data.get("features", []):
        props = feature.get("properties", {})
        delay = props.get("delay")
        
        # Filter for delay (delay is in milliseconds)
        if delay is not None and delay >= min_delay_ms:
            delayed_trains.append({
                "train_id": props.get("train_id"),
                "line_name": props.get("line", {}).get("name", "Unknown"),
                "delay_mins": delay / 60000,
                "type": props.get("type"),
                "state": props.get("state")
            })
            
    return delayed_trains


def get_stop_sequence(train_id):
    """
    Fetches the stop sequence for a specific train to see where it's headed.
    """
    url = f"https://api.geops.io/tracker-http/v1/calls/{train_id}/"
    params = {"key": API_KEY}
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    
    except Exception as e:
        print(f"Could not fetch stops for {train_id}: {e}")
        return None


def find_destinations_with_critical_transfers(potential_transfer_station, arr_scheduled, arr_actual, line_name):
    destinations = []

    stop_ref = ojp_client.get_stop_ref(potential_transfer_station)

    if not stop_ref:
        return []

    # Search starting from when the passenger WOULD have been ready if on time
    search_time = arr_scheduled + timedelta(minutes=2) 
    
    # The moment the passenger is ACTUALLY ready to board a new train
    actual_ready_time = arr_actual + timedelta(minutes=2)
    
    try:
        departures = ojp_client.fetch_departures_or_arrivals(
            stop_ref=stop_ref, 
            request_type="departure", 
            timestamp=search_time,
            number_of_results=20,
            include_stops = True,
        )

        for dep in departures:
            # skip if it is the same line number as the incoming service
            if dep['line'] == line_name:
                continue
            
            # If the connecting train departs BEFORE the passenger actually arrives + buffer, 
            # it is a broken (critical) connection.
            if dep['time'] < actual_ready_time:
                
                # first one of the onward stops -> destination for routing
                if dep.get('stops') and len(dep['stops']) > 0:
                    first_onward_stop = dep['stops'][0]
                    destinations.append(first_onward_stop)
        
    except Exception as e:
        print(f"Error fetching OJP data for {stop_ref}: {e}")
    
    return destinations
    

def possibly_broken_connections(delayed_trains):
    """
    Iterates through delayed trains and identifies upcoming stops with arrival delays.
    """
    for train in delayed_trains:
        print(f"\nAnalyzing Train {train['line_name']} (ID: {train['train_id']})\n")
        with open(output, 'a', encoding='utf-8') as file:
            file.write(f"Analyzing Train {train['line_name']} (ID: {train['train_id']})\n")
            file.write(f"Current Delay: {train['delay_mins']:.1f} minutes \n\n")
        
        stops_data = get_stop_sequence(train['train_id'])

        if not stops_data:
            continue

        stations = stops_data[0].get("stations", [])

        suggested_start_station = ''
        suggested_start_time = ''
        suggested_destinations = []
        
        for stop in stations:

            if stop.get("state") == "LEAVING":
                suggested_start_station = stop.get("stationName")
                suggested_start_time = stop.get("departureTime")

            elif stop.get("state") in ["INCOMING", "STOPS_AT", "PENDING"]:
                potential_transfer_station = stop.get("stationName")
                
                fmt = "%Y-%m-%dT%H:%M:%SZ"
                try:
                    arr_scheduled = datetime.strptime(stop.get("aimedArrivalTime"), fmt)
                    arr_actual = datetime.strptime(stop.get("arrivalTime"), fmt)
                except:
                    arr_scheduled = None
                    arr_actual = None
                
                if arr_scheduled and arr_actual:
                    delay = arr_actual - arr_scheduled
                    arr_delay = delay.total_seconds() / 60
                    #print(f"  - {potential_transfer_station}: Expected {arr_actual} (Sched: {arr_scheduled}) -> Delay: {arr_delay} min")
                    if arr_delay > 5:
                        print("searching for destinations from transfer stop", potential_transfer_station)
                        destinations = find_destinations_with_critical_transfers(potential_transfer_station, 
                                                                                 arr_scheduled, 
                                                                                 arr_actual, 
                                                                                 train['line_name'])
                        
                        # remove dublicates
                        destinations = list(set(destinations))
                        
                        suggested_destinations += destinations


        if len(suggested_destinations)>0:
            with open(output, 'a', encoding='utf-8') as file:
                file.write("-> Try these routing requests (possibly broken connection)\n\n")
                lines = []
                for dest in suggested_destinations:
                    lines.append(f"- from {suggested_start_station} at {suggested_start_time} to {dest}\n")
                lines = list(set(lines))
                file.writelines(lines)
                file.write("\n\n")

        



if __name__ == "__main__":

    # TODO: change times to users timezone
    curTime = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    with open(output, 'w', encoding='utf-8') as file:
        file.write(f"Searching for delayed trains across Switzerland... (Current Time: {curTime})\n\n")

    delayed_trains = get_delayed_trains()
    
    if not delayed_trains:
        with open(output, 'a', encoding='utf-8') as file:
            file.write("No trains found with a 10+ minute delay currently.\n")
    else:
        with open(output, 'a', encoding='utf-8') as file:
            file.write(f"Found {len(delayed_trains)} trains with significant delays:\n")
            file.write(f"{'Line':<10} | {'Delay':<10}\n")
            file.write("-" * 50 + "\n")
            for t in delayed_trains:
                file.write(f"{t['line_name']:<10} ({t['type']}) | {t['delay_mins']:>4.1f} min\n")
            file.write("\n")

    possibly_broken_connections(delayed_trains)