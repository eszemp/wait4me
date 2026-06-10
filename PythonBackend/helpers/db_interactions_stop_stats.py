import psycopg2
from psycopg2.extras import RealDictCursor
import uuid
import os
from dotenv import load_dotenv

load_dotenv()
DB_CONFIG = {
    "dbname": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT")
}

def post_to_db(command, params):

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    try:
        cur.execute(command, params)
        conn.commit()
        return "success"
    except Exception as e:
        return str(e)
    finally:
        cur.close()
        conn.close()

def get_from_db(command, params, multiple=False):

    conn = psycopg2.connect(**DB_CONFIG)
    cur = None

    try:
        if multiple:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(command, params)
            result = cur.fetchall()
        else:
            cur = conn.cursor()
            cur.execute(command, params)
            row = cur.fetchone()
            result = row[0] if row is not None else None
    finally:
        if cur is not None:
            cur.close()
        conn.close()

    if result is not None:
        return result
    return "Not found"

    
def get_stop_by_coord(lon, lat, ref, name, buffer_m=500):

    command = """
        SELECT "Nummer", "Name", "<1m", "1-3m", "3-5m", "5-10m", "10-20m", "20m+", buffer_timeseries, ST_AsGeoJSON(geom) as geom
        FROM station_buffers
        WHERE 
            ST_DWithin(
                geom::geography, 
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 
                %s
            )
            AND ("Name" = %s)
        LIMIT 1;
    """
    params = (lon, lat, buffer_m, name)
    response = get_from_db(command, params, multiple=True)
    if response == "Not found" or not response:
        return None
        
    stop_info = response[0]
    return stop_info

def get_all_stops_with_transfers():

    command = """
        SELECT "Nummer", "Name", "<1m", "1-3m", "3-5m", "5-10m", "10-20m", "20m+", buffer_timeseries, ST_AsGeoJSON(geom) as geom        
        FROM station_buffers
        WHERE buffer_timeseries::text != '"NO TRANSFERS"'
    """
    response = get_from_db(command, (), multiple=True)
    return response

def get_stop_by_name(stop_name):
    command = """
        SELECT "Nummer", "Name", buffer_timeseries, ST_AsGeoJSON(geom) as geom
        FROM station_buffers
        WHERE "Name" = %s
        LIMIT 1;
    """
    response = get_from_db(command, (stop_name,), multiple=True)
    
    if response == "Not found" or not response:
        return None
        
    return response[0]


    