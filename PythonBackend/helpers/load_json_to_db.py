import os
import json
import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, types

load_dotenv()

# Build the connection string for SQLAlchemy
DB_URI = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"

if __name__ == '__main__':
    # 1. Load the JSON data
    # Note: Used 'r' prefix for the Windows file path to avoid escape character issues
    with open(r'C:\Workspace\Wait4Me\stop_histogram_schweiz.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 2. Load into DataFrame
    df = pd.DataFrame(data)
    
    # 💡 IMPORTANT: Ensure the DataFrame columns exactly match your DB layout
    # If your JSON keys are different from the DB column names, uncomment and use this mapping:
    df = df.rename(columns={
         'Nummer' : 'nummer',
         'Name': 'name',
         "<1m": 'under_1m',
         "1-3m": 'from_1_to_3m',
         "3-5m": 'from_3_to_5m',
         "5-10m": 'from_5_to_10m',
         "10-20m": 'from_10_to_20m',
         "20m+": 'over_20m'
    })

    # 3. Handle the jsonb column (buffer_timeseries)
    # Pandas dataframes treat dicts/lists as objects. For SQLAlchemy to understand 
    # it needs to go into a JSONB column, we should stringify it or pass a specific dtype mapping.
    if 'buffer_timeseries' in df.columns:
        df['buffer_timeseries'] = df['buffer_timeseries'].apply(lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x)

    # 4. Initialize SQLAlchemy Engine
    engine = create_engine(DB_URI)
    
    # 5. Insert data safely into PostgreSQL
    try:
        df.to_sql(
            name='station_statistics', 
            con=engine, 
            schema='public', 
            if_exists='append',  # 'append' adds data without dropping the table layout
            index=False,         # Do not write the pandas index as a column
            dtype={
                'buffer_timeseries': types.JSON  # Tells SQLalchemy to treat this stringified text as JSONB
            }
        )
        print("Data successfully loaded into public.station_statistics!")
        
    except Exception as e:
        print(f"An error occurred during insertion: {e}")