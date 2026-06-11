"""Flask API for Wait4Me passenger requests and stop statistics endpoints."""

import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_apscheduler import APScheduler
from helpers.db_interactions_w4m_requests import *
from helpers.db_interactions_stop_stats import *


backend_app = Flask(__name__)
CORS(backend_app)
scheduler = APScheduler()

# POST a passenger request
@backend_app.route('/create-request', methods=['POST'])
def create_request():
    """Create a new passenger request and return its generated request ID."""
    data = request.json
    status, id = create_new_request(data)
    if status=="created":
        return jsonify({"api_status": status, "request_id": id}), 201
    else:
        return jsonify({"api_status": status}), 500

# POST a status change to a passenger request (cancel, accept or decline)
@backend_app.route('/update-request/<request_id>', methods=['POST'])
def update_request(request_id):
    """Update the status of an existing request by request ID."""
    data = request.json
    status, id = change_request_status(request_id, data)
    if status=="changed":
        return jsonify({"api_status": status, "request_id": id}), 201
    else:
        return jsonify({"api_status": status}), 500

# GET the status of a request
@backend_app.route('/get-status/<request_id>', methods=['GET'])
def get_status(request_id):
    """Return the current status for one request ID."""
    result = get_request_status(request_id)
    if result == 'Not found':
        return jsonify({"api_status": "Not found"}), 404

    return jsonify({"api_status": "found", "request_status": result}), 200


# GET all pending (and cancelled) requests (driver-side)
# example usage: /driver/request?transfer_stop_ref=xxx&outgoing_service=xxx
@backend_app.route('/driver/get-requests', methods=['GET'])
def get_requests():
    """Return pending and cancelled requests for a stop/service pair."""
    stop_ref = request.args.get('transfer_stop_ref')
    service = request.args.get('outgoing_service')
    incoming_requests = get_incoming_requests(stop_ref, service)
    cancelled_requests = get_cancelled_requests(stop_ref, service)
    if incoming_requests != 'Not found':
        if cancelled_requests != 'Not found':
            return jsonify({"api_status": "incoming connections and changes", 
                            "incoming_requests": incoming_requests,
                            "cancelled_requests" : cancelled_requests}), 200
        else:
            return jsonify({"api_status": "incoming connections", 
                            "incoming_requests": incoming_requests}), 200
    else:
        if cancelled_requests != 'Not found':
            return jsonify({"api_status": "incoming changes", 
                            "cancelled_requests" : cancelled_requests}), 200
        else:
            return jsonify({"api_status": "No incoming connections or changes"}), 200
        
@backend_app.route('/get-stops', methods=['GET'])
def get_all_stops():
    """Return all stops with transfer data as a GeoJSON FeatureCollection."""
    db_response = get_all_stops_with_transfers()
    if db_response == "Not found" or not db_response:
        return jsonify({
            "type": "FeatureCollection",
            "features": []
        }), 200
        
    features = []
    
    for row in db_response:
        properties = dict(row)
        geom_str = properties.pop('geom', None)
        geometry = json.loads(geom_str)
        feature = {
            "type": "Feature",
            "geometry": geometry,
            "properties": properties
        }
        features.append(feature)
        
    feature_collection = {
        "type": "FeatureCollection",
        "features": features
    }
    
    return jsonify(feature_collection), 200

@backend_app.route('/get-stop', methods=['GET'])
def get_stop():
    """Return one stop by name as a GeoJSON Feature."""
    #stop_ref = request.args.get('ref', '')
    stop_name = request.args.get('name', '')
    
    if not stop_name:
        return jsonify({"api_status": "Missing name"}), 400
        
    db_response = get_stop_by_name(stop_name)
    
    if not db_response:
        return jsonify({"api_status": "Not found"}), 404
        
    properties = dict(db_response)
    geom_str = properties.pop('geom', None)
    geometry = json.loads(geom_str) if geom_str else None
    
    feature = {
        "type": "Feature",
        "geometry": geometry,
        "properties": properties
    }
    
    return jsonify(feature), 200

# GET health check (see if API is running)
@backend_app.route("/health", methods=["GET"])
def health():
    """Return a simple health response to confirm API availability."""
    return jsonify({"api_status": "Health check okay"}), 200

def expire_old_requests():
    """
    Checks all pending requests and sets them to 'expired' 
    if departure time is in the past.
    """
    result = cleanup_expired_requests()
    print(f"Hourly cleanup {result}")


if __name__ == '__main__':
    scheduler.add_job(id='ExpiredRequestCleanup', func=expire_old_requests, trigger='interval', hours=1)
    scheduler.start()

    backend_app.run(host='127.0.0.1', port=8000)
