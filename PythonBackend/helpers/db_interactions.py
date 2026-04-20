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
    
    if multiple:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(command, params)
        result=cur.fetchall()
    else:
        cur = conn.cursor()
        cur.execute(command, params)
        result=cur.fetchone()[0]

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
        return "created", request_id
    else:
        return db_transaction, 0

def change_request_status(request_id, data):

    command = """
        UPDATE wait4me_requests 
        SET status = %s 
        WHERE request_id = %s
    """
    params = (data['status'], request_id)
    
    db_transaction = post_to_db(command, params)

    if db_transaction=='success':
        return "changed", request_id
    else:
        return db_transaction, 0  
    
def get_request_status(request_id):

    command = """
        SELECT status 
        FROM wait4me_requests 
        WHERE request_id = %s
    """
    params = (request_id,)
    result = get_from_db(command, params)
    return result

def get_incoming_requests(stop_ref, service):

    command = """
        SELECT * 
        FROM wait4me_requests 
        WHERE outgoing_journey_ref = %s AND transfer_stop_ref = %s AND status = %s
    """
    params = (service, stop_ref, 'pending')

    results = get_from_db(command, params, multiple=True)

    return results

def cleanup_expired_requests():
    """
    Updates all pending requests to 'expired' if their scheduled 
    departure time is in the past.
    """

    command = """
        UPDATE wait4me_requests 
        SET status = 'expired' 
        WHERE status = 'pending' 
        AND scheduled_departure_time < CURRENT_TIMESTAMP
    """
    
    db_transaction = post_to_db(command, ())
    
    if db_transaction == 'success':
        return "successful"
    else:
        return f"failed: {db_transaction}"

    