import psycopg2
from psycopg2.extras import RealDictCursor
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
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(command, params)
    if multiple:
        result=cur.fetchall()
    else:
        result = cur.fetchone()
    cur.close()
    conn.close()

    if result:
        return result
    return "Not found"      

def create_new_request(data):
    request_id = str(uuid.uuid4())
    
    command = """ INSERT INTO wait4me_requests (
                    request_id, 
                    passenger_id, 
                    incoming_journey_ref, 
                    outgoing_journey_ref, 
                    transfer_stop_ref,
                    scheduled_departure_time,
                    requested_delay_min
                ) 
                VALUES (%s, %s, %s, %s, %s, %s, %s) """
     
    params = (request_id, 
              data['passenger_id'], 
              data['incoming_journey_ref'], 
              data['outgoing_journey_ref'], 
              data['transfer_stop_ref'],
              data['scheduled_departure_time'],
              data['requested_delay']
              )
    
    db_transaction = post_to_db(command, params)
    if db_transaction=='success':
        return jsonify({"status": "created", "request_id": request_id}), 201
    else:
        return jsonify({"status": db_transaction}), 500

def change_request_status(request_id, data):

    command = """
        UPDATE wait4me_requests 
        SET status = %s 
        WHERE request_id = %s
    """
    params = (data['status'], request_id)
    
    db_transaction = post_to_db(command, params)

    if db_transaction=='success':
        return jsonify({"status": "changed", "request_id": request_id}), 201
    else:
        return jsonify({"error": db_transaction}), 500   
    
def get_request_status(request_id):

    command = """
        SELECT status 
        FROM wait4me_requests 
        WHERE request_id = %s
    """
    params = (request_id,)

    result = get_from_db(command, params)

    if result == 'Not found':
        return jsonify({"status": "Not found"}), 404

    return jsonify({"status": result}), 200

def get_incoming_requests(stop_ref, service):

    command = """
        SELECT * 
        FROM wait4me_requests 
        WHERE outgoing_journey_ref = %s AND transfer_stop_ref = %s AND status = %s
    """
    params = (service, stop_ref, 'pending')

    results = get_from_db(command, params, multiple=True)

    if results == 'Not found':
        return jsonify({"message": "No incoming connections"}), 200

    return jsonify({"data": "No incoming connections"}), 200

    