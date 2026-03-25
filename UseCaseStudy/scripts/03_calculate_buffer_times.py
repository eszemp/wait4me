import geopandas as gpd
import pandas as pd
import time
import json
from datetime import datetime, timedelta
from tqdm import tqdm
from helpers.ojp_arrivals_and_departures import OJPStopDepArrRequest

FILE_PATH = "../data/stop-places-schwyz/stop-places-schwyz.shp" 


def inread_data():
    print(f"Loading shapefile: {FILE_PATH}")
    return gpd.read_file(FILE_PATH)

def process_all_stops(stops):
    """
    ...
    """

    OJPDepArr = OJPStopDepArrRequest()

    stops['buffer_timeseries'] = None

    print("Processing entries...")
    for index, row in tqdm(stops.iterrows(), total=stops.shape[0], desc="Progress"):
        #if index>50:
        #    break
        result = get_buffer_timeseries(row, OJPDepArr)

        if result:
            stops.at[index, 'buffer_timeseries'] = result['buffer_timeseries']

    # Export to GeoPackage
    output_path = FILE_PATH.replace(".shp", "-with-buffers.gpkg")
    stops.to_file(output_path, driver="GPKG", layer="stop_buffers")
    
    print(f"\nSuccessfully saved {len(stops)} rows to {output_path}")

def get_required_transfer_time(StopPlaceRef):
    """
    # TODO: implement correctly
    # standard is two minutes https://www.sbb.ch/en/help-and-contact/products-services/timetable.html#anchor3.
    # what request to get interchange time of a station?
    """
    required_transfer_time = timedelta(minutes=2)
    return required_transfer_time

def get_all_for_day(OJPDepArr, StopPlaceRef, RequestType):

    # look at 15th April (typical weekday)
    start_time = datetime(year=2026, month=4, day=15, hour=0, minute=0, second=0)
    end_time = datetime(year=2026, month=4, day=16, hour=3, minute=0, second=0)
    current_time = start_time

    results = []

    while current_time < end_time:
        new_batch= OJPDepArr.fetch_departures_or_arrivals(stop_ref=StopPlaceRef, request_type=RequestType, time=current_time)

        if not new_batch:
            # print("No more results returned from API.")
            break
        
        if new_batch[-1]['time'] <= current_time:
            # print("Repeating Data. Stopping.")
            break

        results.extend(new_batch)

        last_result = results[-1]['time']
        current_time = last_result
        time.sleep(1.3)

    # delete all entries where time > end_time
    results = [r for r in results if r['time'] <= end_time]

    return pd.DataFrame(results)


def get_buffer_timeseries(row, OJPDepArr, debug=False):
    """
    ...
    """
    StopPlaceRef = row['Nummer']
    if debug:
        StopPlaceRef = 8505084

    req_transfer_time = get_required_transfer_time(StopPlaceRef)
    all_arrivals = get_all_for_day(OJPDepArr, StopPlaceRef, "arrival")
    all_departures = get_all_for_day(OJPDepArr, StopPlaceRef, "departure")
    if debug:
        print("arrivals:", all_arrivals)
        print("departures:", all_departures)

    if all_arrivals.empty or all_departures.empty:
        print(f"\n{row['Name']} ({row['Nummer']}) has no services")
        time.sleep(1.3)
        return {'buffer_timeseries':'NO SERVICE'}

    combined = pd.merge(all_arrivals, all_departures, how='cross', suffixes=('_arr', '_dep'))

    mask = (
        (combined['time_dep'] >= combined['time_arr'] + req_transfer_time) & 
        (combined['line_arr'] != combined['line_dep'])
    )
    valid_options = combined[mask]

    if len(valid_options)==0:
        print(f"\n{row['Name']} ({row['Nummer']}) has no transfers")
        time.sleep(1.3)
        return {'buffer_timeseries':'NO TRANSFERS'}

    # find the 'First' departure for each arrival, sort by departure time first, then group by the unique arrival (time + line)
    matches = (
        valid_options
        .sort_values('time_dep')
        .groupby(['time_arr', 'line_arr'])
        .first()
        .reset_index()
    )

    # calculate final buffer
    matches['buffer_seconds'] = (matches['time_dep'] - (matches['time_arr'] + req_transfer_time)).dt.total_seconds()
    average_buffer = matches['buffer_seconds'].mean()

    if debug:
        print(matches)

    print(f"\n{row['Name']} ({row['Nummer']}) has average buffer time: {average_buffer} seconds")

    timeseries = (
        matches[['time_arr', 'buffer_seconds']]
        .copy()
        .rename(columns={'time_arr': 'time', 'buffer_seconds': 'buffer'})
    )
    
    # Convert timestamps to ISO strings for JSON
    timeseries['time'] = timeseries['time'].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    # Convert to JSON string
    timeseries_json = json.dumps(timeseries.to_dict(orient='records'))

    print(f"\n{row['Name']} ({row['Nummer']}) processed.")

    return {'buffer_timeseries': timeseries_json}
    

if __name__ == "__main__":

    stops = inread_data()
    process_all_stops(stops)