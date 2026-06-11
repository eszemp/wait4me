import requests
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from UseCaseStudy.scripts.helpers.ojp_arrivals_and_departures import OJPStopDepArrRequest

script_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(script_dir, '.env')
load_dotenv(dotenv_path=dotenv_path, override=True)
API_KEY = os.getenv("GEOPS_API_KEY")

ojp_client = OJPStopDepArrRequest()

# CONFIGS
FEED_NAME = "sbb" 
SWISS_BBOX = "663000,5750000,1168000,6070000" # EPSG:3857 (Web Mercator)
output = 'FindTestCases/testcases.txt'



def get_delayed_trains(min_delay_ms=600000):
    """
    Fetches delayed trains across Switzerland from the GEOPS Realtime API.
    Default: Searches for delays bigger than 10 minutes.
    """

    url = f"https://api.geops.io/tracker-http/v1/trajectories/{FEED_NAME}/"
    params = {"bbox": SWISS_BBOX, "key": API_KEY, "mots": "rail"}
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    except requests.exceptions.RequestException as e:
        print(f"API Request failed: {e}")
        return []

    delayed_trains = []

    for feature in data.get("features", []):
        properties = feature.get("properties", {})
        delay = properties.get("delay")
        traffic_mode = properties.get("type")
        
        # filter for delay and mode
        if delay is not None and delay >= min_delay_ms:
            if traffic_mode == "rail":
                delayed_trains.append({
                    "train_id": properties.get("train_id"),
                    "line_name": properties.get("line", {}).get("name", "Unknown"),
                    "delay_mins": delay / 60000
                })
            
    return delayed_trains


def get_stop_sequence(train_id):
    """
    Fetches the stop sequence for a specific train from the GEOPS API.
    """

    url = f"https://api.geops.io/tracker-http/v1/calls/{train_id}/"
    params = {"key": API_KEY}
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        return data[0].get("stations")
    
    except Exception as e:
        print(f"Could not fetch stops for {train_id}: {e}")
        return None


def find_destinations_with_critical_transfers(potential_transfer_station, arr_scheduled, arr_actual, line_name, stop_names_incoming_line):
    """
    Looks at departures from a station where an incoming line is delayed. 
    The goal is to find destinations to which a connection would theoretically 
    be possible from the incoming service according to the timetable but where that connection is no longer possible due to a delay.
    """
    
    destinations = []
    stop_ref = ojp_client.get_stop_ref(potential_transfer_station)

    if not stop_ref:
        return []

    # search starting from when the passenger WOULD have been ready to depart if they arrived on time 
    # (assume 2 min for transfer)
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
            
            # If the connecting train departs BEFORE the passenger is ready,
            # it is a broken (critical) connection.
            if dep['time'] < actual_ready_time:

                # check that the onward stops are not also stops of the original delayed line
                # save the first onward stop that fulfills this condition
                for onward_stop in dep.get('stops', []):

                    if onward_stop not in stop_names_incoming_line:
                        destinations.append(onward_stop)
                        break
        
    except Exception as e:
        print(f"Error fetching OJP data for {stop_ref}: {e}")
    
    return destinations
    

def find_broken_connections(delayed_trains):
    """
    Iterates through delayed trains and identifies upcoming stops with arrival delays.
    Then it looks at departures from upcoming onward stops to find potential broken connections.
    """

    for train in delayed_trains:
        print(f"\nAnalyzing Train {train['line_name']} (ID: {train['train_id']})\n")

        with open(output, 'a', encoding='utf-8') as file:
            file.write(f"Analyzing Train {train['line_name']} (ID: {train['train_id']})\n")
            file.write(f"Current Delay: {train['delay_mins']:.1f} minutes \n\n")
        
        all_stops_of_line = get_stop_sequence(train['train_id'])

        if not all_stops_of_line:
            continue

        suggested_start_station = ''
        suggested_start_time = ''
        suggested_destinations = []

        stops_of_delayed_line = [stop.get("stationName") for stop in all_stops_of_line if stop.get("stationName")]
        
        for stop in all_stops_of_line:

            # if the train has already left a station, save this as a suggested start
            if stop.get("state") == "LEAVING":
                suggested_start_station = stop.get("stationName")
                suggested_start_time = stop.get("aimedDepartureTime")

            # for all upcoming stops, check for a significant arrival delay
            elif stop.get("state") == "PENDING":
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
                    if arr_delay > 5:
                        print("searching for destinations from transfer stop", potential_transfer_station)
                        destinations = find_destinations_with_critical_transfers(potential_transfer_station, arr_scheduled, arr_actual, train['line_name'], stops_of_delayed_line)                   
                        suggested_destinations += list(set(destinations))


        if len(suggested_destinations)>0:
            with open(output, 'a', encoding='utf-8') as file:
                file.write("-> Try these routing requests (possibly broken connections)\n\n")
                lines = []
                for dest in suggested_destinations:
                    lines.append(f"- from {suggested_start_station} at {suggested_start_time} (timetabled time) to {dest}\n")
                lines = list(set(lines))
                file.writelines(lines)
                file.write("\n\n")




if __name__ == "__main__":

    # TODO: change times to users timezone
    curTime = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    with open(output, 'w', encoding='utf-8') as file:
        file.write(f"Searching for delayed trains in the SBB network... (Current Time: {curTime})\n\n")

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
                file.write(f"{t['line_name']:<10} | {t['delay_mins']:>4.1f} min\n")
            file.write("\n")

        find_broken_connections(delayed_trains)