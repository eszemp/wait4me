import geopandas as gpd
import pandas as pd
import time
import json
from functools import lru_cache
from pathlib import Path
from datetime import datetime, timedelta
from tqdm import tqdm
from helpers.ojp_arrivals_and_departures import (
    OJPStopDepArrRequest,
    AuthAccessDeniedError,
    MissingTokenError,
)
from helpers.ojp_transfer_windows import OJPStopInfoRequest, normalize_station_name
from helpers.write_log import initialize_logfile, add_to_log

SCRIPT_DIR = Path(__file__).resolve().parent
FILE_PATH = SCRIPT_DIR.parent / "data/stop-places-schweiz/stop-places-schweiz.shp"
TRANSFER_FILE_PATH = SCRIPT_DIR.parent / "data/transfer-time/transfers.txt"
LOG = SCRIPT_DIR / "03_calculate_buffer_times_LOGFILE.txt"
CHECKPOINT_PATH = SCRIPT_DIR / "03_calculate_buffer_times_checkpoint.json"
OUTPUT_PATH = FILE_PATH.with_name(f"{FILE_PATH.stem}-with-buffers.gpkg")
PARTIAL_OUTPUT_PATH = FILE_PATH.with_name(f"{FILE_PATH.stem}-with-buffers.partial.gpkg")

MAX_RETRIES = 3
RETRY_DELAY = 2
REQUEST_RATE_LIMIT = 0.02
CHECKPOINT_SAVE_EVERY = 25


@lru_cache(maxsize=1024)
def get_station_cluster_refs(stop_name):
    """Resolve all stop refs that belong to the same station cluster."""
    ojp_info = OJPStopInfoRequest()
    query_name = normalize_station_name(stop_name)

    try:
        places = ojp_info.fetch_places_by_name(query_name, number_of_results=25)
    except Exception:
        return tuple()

    refs = []
    seen = set()
    for place in places:
        if place.get("normalized_name") != query_name:
            continue

        for ref_key in ("stop_place_ref", "stop_point_ref"):
            ref = place.get(ref_key)
            if ref and ref not in seen:
                seen.add(ref)
                refs.append(ref)

    return tuple(refs)


def load_checkpoint():
    """Load processed stop indices from checkpoint file."""
    if CHECKPOINT_PATH.exists():
        try:
            with open(CHECKPOINT_PATH, "r") as f:
                data = json.load(f)
                processed = set(data.get("processed_indices", []))
                print(f"Resuming from checkpoint: {len(processed)} stops already processed.")
                return processed
        except Exception as e:
            print(f"Warning: Could not load checkpoint: {e}")
            return set()
    return set()


def save_checkpoint(processed_indices):
    """Save processed stop indices to checkpoint file."""
    try:
        with open(CHECKPOINT_PATH, "w") as f:
            json.dump({"processed_indices": list(processed_indices)}, f)
    except Exception as e:
        print(f"Warning: Could not save checkpoint: {e}")


def save_progress(stops, processed_indices):
    """Persist checkpoint metadata and partial computed results to disk."""
    save_checkpoint(processed_indices)
    try:
        partial_stops = stops[stops["buffer_timeseries"].notna()].copy()
        partial_stops.to_file(str(PARTIAL_OUTPUT_PATH), driver="GPKG", layer="stop_buffers")
    except Exception as e:
        print(f"Warning: Could not save partial output: {e}")


def restore_progress(stops):
    """Restore already-computed buffer_timeseries values from partial output."""
    processed_indices = load_checkpoint()
    if processed_indices and not PARTIAL_OUTPUT_PATH.exists():
        print("Warning: checkpoint exists but partial output is missing. Restarting from scratch.")
        return set()

    if not PARTIAL_OUTPUT_PATH.exists():
        return processed_indices

    try:
        partial_stops = gpd.read_file(str(PARTIAL_OUTPUT_PATH), layer="stop_buffers")
        if "Nummer" not in partial_stops.columns or "buffer_timeseries" not in partial_stops.columns:
            print("Warning: partial output is missing required columns. Ignoring partial output.")
            return set()

        buffer_by_nummer = partial_stops.set_index("Nummer")["buffer_timeseries"].to_dict()
        stops["buffer_timeseries"] = stops["Nummer"].map(buffer_by_nummer)
        restored_indices = set(stops.index[stops["buffer_timeseries"].notna()].tolist())

        if processed_indices:
            restored_indices = processed_indices.intersection(restored_indices)

        print(f"Restored {len(restored_indices)} processed rows from partial output.")
        return restored_indices
    except Exception as e:
        print(f"Warning: Could not load partial output: {e}")
        return set()


def inread_data():
    """Load stop places from the configured shapefile."""
    print(f"Loading shapefile: {FILE_PATH}")
    return gpd.read_file(str(FILE_PATH))


def process_all_stops(stops):
    """
    Compute transfer-buffer timeseries for each stop and write results to GeoPackage.
    Supports resume from checkpoint if processing was interrupted.

    Args:
        stops: GeoDataFrame containing stop metadata including Nummer and Name.

    Returns:
        None. Results are written to disk and stored in the buffer_timeseries column.
    """

    try:
        OJPDepArr = OJPStopDepArrRequest()
    except MissingTokenError as e:
        print(f"Configuration error: {e}")
        initialize_logfile(LOG)
        add_to_log(LOG, f"AUTH CONFIG ERROR: {e}")
        return

    stops["buffer_timeseries"] = None

    # Restore persisted progress and skip already-processed stops.
    processed_indices = restore_progress(stops)
    total_stops = stops.shape[0]
    remaining_stops = total_stops - len(processed_indices)

    initialize_logfile(LOG)
    print(f"Processing entries... ({remaining_stops} remaining of {total_stops} total)")
    auth_denied_logged = False
    
    cluster_cache = {}
    
    try:
        for index, row in tqdm(stops.iterrows(), total=stops.shape[0], desc="Progress"):
            StopPlaceRef = str(row["Nummer"])
            stop_name = row["Name"]
            
            station_refs = get_station_cluster_refs(stop_name)
            if station_refs:
                stop_refs = tuple(sorted(set([StopPlaceRef, *station_refs])))
            else:
                stop_refs = (StopPlaceRef,)

            # Restore cached data for checkpoints efficiently
            if index in processed_indices:
                if stop_refs not in cluster_cache:
                    cluster_cache[stop_refs] = {"buffer_timeseries": stops.at[index, "buffer_timeseries"]}
                continue

            # Cache hit: Avoid making duplicate API requests for identical station clusters
            if stop_refs in cluster_cache:
                result = cluster_cache[stop_refs]
                if result:
                    stops.at[index, "buffer_timeseries"] = result["buffer_timeseries"]
                
                add_to_log(LOG, f"{stop_name} ({StopPlaceRef}) used cached results for refs: {stop_refs}")
                
                processed_indices.add(index)
                if len(processed_indices) % CHECKPOINT_SAVE_EVERY == 0:
                    save_progress(stops, processed_indices)
                continue

            try:
                result = get_buffer_timeseries(row, OJPDepArr, stop_refs)
            except AuthAccessDeniedError as e:
                if not auth_denied_logged:
                    message = f"AUTH ACCESS DENIED: {e}. Stopping processing cleanly."
                    print(f"\n{message}")
                    add_to_log(LOG, message)
                    auth_denied_logged = True
                save_progress(stops, processed_indices)
                return

            if result:
                stops.at[index, "buffer_timeseries"] = result["buffer_timeseries"]
                cluster_cache[stop_refs] = result

            # Persist progress regularly to support crash-safe resume.
            processed_indices.add(index)
            if len(processed_indices) % CHECKPOINT_SAVE_EVERY == 0:
                save_progress(stops, processed_indices)
    except KeyboardInterrupt:
        print("\nProcessing interrupted. Checkpoint saved. Run again to resume.")
        save_progress(stops, processed_indices)
        return
    except Exception as e:
        print(f"\nError during processing: {e}")
        print("Checkpoint saved. Run again to resume.")
        save_progress(stops, processed_indices)
        raise

    save_progress(stops, processed_indices)

    # Export to GeoPackage
    stops.to_file(str(OUTPUT_PATH), driver="GPKG", layer="stop_buffers")

    print(f"\nSuccessfully saved {len(stops)} rows to {OUTPUT_PATH}")
    
    # Clean up checkpoint on successful completion
    if CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()
        print("Checkpoint cleared.")
    if PARTIAL_OUTPUT_PATH.exists():
        PARTIAL_OUTPUT_PATH.unlink()
        print("Partial output cleared.")


@lru_cache(maxsize=1)
def load_required_transfer_times_by_stop():
    """
    Returns a dict: stop_id (string) -> required transfer timedelta.
    Uses GTFS transfer_type=2 entries with min_transfer_time (seconds).
    """
    transfers_df = pd.read_csv(
        TRANSFER_FILE_PATH,
        dtype={
            "from_stop_id": str,
            "to_stop_id": str,
            "transfer_type": str,
            "min_transfer_time": str,
        },
        usecols=["from_stop_id", "to_stop_id", "transfer_type", "min_transfer_time"],
    )

    station_defaults = transfers_df[
        (transfers_df["transfer_type"] == "2")
        & (transfers_df["min_transfer_time"].notna())
        & (transfers_df["min_transfer_time"] != "")
        & (transfers_df["from_stop_id"] == transfers_df["to_stop_id"])
    ].copy()

    if station_defaults.empty:
        return {}

    station_defaults["min_transfer_time"] = pd.to_numeric(
        station_defaults["min_transfer_time"], errors="coerce"
    )
    station_defaults = station_defaults.dropna(subset=["min_transfer_time"])

    # If multiple rows exist for the same stop, keep the first (values are typically identical).
    station_defaults = station_defaults.drop_duplicates(
        subset=["from_stop_id"], keep="first"
    )

    return {
        row["from_stop_id"]: timedelta(seconds=int(row["min_transfer_time"]))
        for _, row in station_defaults.iterrows()
    }


def get_stop_ref_candidates(stop_place_ref):
    """Build normalized stop-id candidates used for transfer-time lookup."""
    value = str(stop_place_ref).strip()
    digits_only = "".join(ch for ch in value if ch.isdigit())

    candidates = [value]
    if digits_only and digits_only != value:
        candidates.append(digits_only)

    return candidates


def get_required_transfer_time(StopPlaceRef):
    """
    Resolve required transfer time for a stop.

    Looks up GTFS transfer_type=2 station defaults in transfers.txt and falls back
    to 2 minutes if no explicit match is found.

    Args:
        StopPlaceRef: Stop identifier used in OJP requests.

    Returns:
        timedelta representing required interchange time.
    """
    transfer_times_by_stop = load_required_transfer_times_by_stop()

    for candidate in get_stop_ref_candidates(StopPlaceRef):
        if candidate in transfer_times_by_stop:
            return transfer_times_by_stop[candidate]

    # Fallback if no explicit entry exists in transfers.txt.
    return timedelta(minutes=2)


def get_all_for_day(OJPDepArr, StopPlaceRefs, RequestType):
    """
    Fetch all arrivals or departures for a stop in the configured analysis window.
    Includes retry logic for transient API failures and rate limiting.

    Args:
        OJPDepArr: OJPStopDepArrRequest client instance.
        StopPlaceRefs: One stop identifier or a collection of sibling refs used by the OJP API.
        RequestType: Either "arrival" or "departure".

    Returns:
        DataFrame with fetched records, truncated to the end of the time window.
        Returns empty DataFrame on persistent API failure.
    """

    # look at 9th December (typical weekday)
    start_time = datetime(year=2026, month=12, day=9, hour=0, minute=0, second=0)
    end_time = datetime(year=2026, month=12, day=10, hour=3, minute=0, second=0)
    current_time = start_time

    results = []

    if isinstance(StopPlaceRefs, (str, int)):
        stop_refs = [str(StopPlaceRefs)]
    else:
        stop_refs = [str(ref) for ref in StopPlaceRefs if ref]

    for stop_ref in stop_refs:
        current_time = start_time
        while current_time < end_time:
            new_batch = None
            for attempt in range(MAX_RETRIES):
                try:
                    new_batch = OJPDepArr.fetch_departures_or_arrivals(
                        stop_ref=stop_ref, request_type=RequestType, timestamp=current_time
                    )
                    break
                except AuthAccessDeniedError:
                    raise
                except Exception as e:
                    if attempt < MAX_RETRIES - 1:
                        wait_time = RETRY_DELAY * (2 ** attempt)
                        print(f"API call failed (attempt {attempt + 1}/{MAX_RETRIES}): {e}. Retrying in {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        print(f"API call failed after {MAX_RETRIES} attempts. Returning partial results.")
                        new_batch = pd.DataFrame()
                        break

            # Handle case where fetch_departures_or_arrivals returns a list instead of DataFrame
            if isinstance(new_batch, list):
                if not new_batch:
                    break
                new_batch = pd.DataFrame(new_batch)

            if new_batch is None or new_batch.empty:
                break

            if new_batch.iloc[-1]["time"] <= current_time:
                break

            results.extend(new_batch.to_dict(orient="records"))
            current_time = results[-1]["time"]
            time.sleep(REQUEST_RATE_LIMIT)

    if not results:
        return pd.DataFrame()

    results = pd.DataFrame(results).drop_duplicates(subset=["time", "line", "destination"])
    results = results[results["time"] <= end_time]

    return results


def get_buffer_timeseries(row, OJPDepArr, stop_refs, debug=False):
    """
    Calculate the transfer-buffer timeseries for a single stop.
    Handles API errors gracefully and logs them.

    Args:
        row: Row from the stop GeoDataFrame (must contain Nummer and Name).
        OJPDepArr: OJPStopDepArrRequest client instance.
        stop_refs: Tuple of string stop references to query, representing the station cluster.
        debug: If True, prints additional debug information.

    Returns:
        Dict with key buffer_timeseries containing a JSON string, or status strings
        "NO SERVICE" / "NO TRANSFERS" / "API_ERROR" when errors occur.
    """
    StopPlaceRef = str(row["Nummer"])

    try:
        req_transfer_time = get_required_transfer_time(StopPlaceRef)

        # Log which stop refs are being queried
        add_to_log(LOG, f"{row['Name']} ({StopPlaceRef}) querying stop_refs: {stop_refs}")

        all_arrivals = get_all_for_day(OJPDepArr, stop_refs, "arrival")
        all_departures = get_all_for_day(OJPDepArr, stop_refs, "departure")
        if debug:
            print("arrivals:", all_arrivals)
            print("departures:", all_departures)

        if all_arrivals.empty or all_departures.empty:
            add_to_log(LOG, f"{row['Name']} ({row['Nummer']}) has no services")
            return {"buffer_timeseries": "NO SERVICE"}
    except AuthAccessDeniedError:
        # Bubble up so the caller can log once and terminate cleanly.
        raise
    except Exception as e:
        add_to_log(LOG, f"{row['Name']} ({row['Nummer']}) API error: {str(e)}")
        return {"buffer_timeseries": "API_ERROR"}

    combined = pd.merge(
        all_arrivals, all_departures, how="cross", suffixes=("_arr", "_dep")
    )

    mask = (combined["time_dep"] >= combined["time_arr"] + req_transfer_time) & (
        combined["line_arr"] != combined["line_dep"]
    )
    valid_options = combined[mask]

    if len(valid_options) == 0:
        add_to_log(LOG, f"{row['Name']} ({row['Nummer']}) has no transfers")
        return {"buffer_timeseries": "NO TRANSFERS"}

    # find the 'First' departure for each arrival, sort by departure time first, then group by the unique arrival (time + line)
    matches = (
        valid_options.sort_values("time_dep")
        .groupby(["time_arr", "line_arr"])
        .first()
        .reset_index()
    )

    # calculate final buffer
    matches["buffer_seconds"] = (
        matches["time_dep"] - (matches["time_arr"] + req_transfer_time)
    ).dt.total_seconds()
    average_buffer = matches["buffer_seconds"].mean()

    if debug:
        print(matches)

    add_to_log(
        LOG,
        f"{row['Name']} ({row['Nummer']}) has average buffer time: {average_buffer} seconds",
    )

    timeseries = (
        matches[["time_arr", "line_arr", "line_dep", "buffer_seconds"]]
        .copy()
        .rename(
            columns={
                "time_arr": "time",
                "line_arr": "incoming_line_id",
                "line_dep": "outgoing_line_id",
                "buffer_seconds": "buffer",
            }
        )
    )

    timeseries["time"] = timeseries["time"].dt.strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )  # timestamps to ISO strings for JSON
    timeseries_json = json.dumps(
        timeseries.to_dict(orient="records")
    )  # Convert to JSON string

    add_to_log(LOG, f"{row['Name']} ({row['Nummer']}) processed.")
    return {"buffer_timeseries": timeseries_json}


if __name__ == "__main__":

    stops = inread_data()
    process_all_stops(stops)