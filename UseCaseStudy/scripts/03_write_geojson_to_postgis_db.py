import os
import json
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "dbname": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT")
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

def import_geojson_to_postgis(file_path, table_name):
    """
    Truncates the target table and loads GeoJSON features into PostGIS.
    """
    # 1. Read and parse the local GeoJSON file
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
    except Exception as e:
        return f"Error reading file: {str(e)}"

    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # 2. Clear existing content and reset the primary key sequence
        print(f"Truncating table {table_name}...")
        cur.execute(f'TRUNCATE TABLE "{table_name}" RESTART IDENTITY;')
        
        # 3. Prepare data rows for batch insertion
        insert_records = []
        for feature in geojson_data.get('features', []):
            props = feature.get('properties', {})
            geom = feature.get('geometry', {})
            
            # Extract properties matching your table schema
            nummer = props.get('Nummer')
            name = props.get('Name')
            lt_1m = props.get('<1m')
            m_1_3 = props.get('1-3m')
            m_3_5 = props.get('3-5m')
            m_5_10 = props.get('5-10m')
            m_10_20 = props.get('10-20m')
            gt_20m = props.get('20m+')
            
            # Serialize the nested list/dict into a JSON string for the JSONB column
            buffer_ts = json.dumps(props.get('buffer_timeseries', []))
            
            # Serialize the geometry dict into a GeoJSON string for PostGIS
            geom_str = json.dumps(geom)
            
            record = (nummer, name, lt_1m, m_1_3, m_3_5, m_5_10, m_10_20, gt_20m, buffer_ts, geom_str)
            insert_records.append(record)
            
        # 4. Build the parameterized batch insert query
        # We wrap columns with special characters inside double quotes
        insert_query = f"""
            INSERT INTO {table_name} (
                "Nummer", "Name", "<1m", "1-3m", "3-5m", "5-10m", "10-20m", "20m+", buffer_timeseries, geom
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)
            );
        """
        
        # 5. Execute batch insertion
        print(f"Inserting {len(insert_records)} features into {table_name}...")
        psycopg2.extras.execute_batch(cur, insert_query, insert_records)
        
        conn.commit()
        return f"Successfully imported {len(insert_records)} features."
        
    except Exception as e:
        conn.rollback()
        return f"Database error: {str(e)}"
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":

    # Define your file path and target PostGIS table
    GEOJSON_FILE = "../data/output/stop_transfer_buffer_statistics.geojson"
    TARGET_TABLE = "station_buffers" 
    
    response = import_geojson_to_postgis(GEOJSON_FILE, TARGET_TABLE)
    print(response)