import psycopg2
import uuid
import os
from flask import jsonify
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

def execute_sql(command, request_id):

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(command)
        conn.commit()
        return "created"
    except Exception as e:
        return f"error {str(e)}"
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":

    command = """CREATE TABLE wait4me_requests (
        request_id VARCHAR(10) PRIMARY KEY,
        passenger_id VARCHAR(10),
        incoming_service VARCHAR(100),
        outgoing_service VARCHAR(100),
        transfer_stop_ref INTEGER,
        outgoing_departure_time TIMESTAMP,
        requested_delay INTEGER,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );"""
    response = execute_sql(command, None)
    print(response)