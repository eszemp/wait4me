from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
from helpers.db_interactions import *
from helpers.geofencing import is_valid_request


backend_app = Flask(__name__)
CORS(backend_app)

# POST a passenger request
@backend_app.route('/create-request', methods=['POST'])
def create_request():
    data = request.json
    if is_valid_request(data):
        status, id = create_new_request(data)
        if status=="created":
            return jsonify({"api_status": status, "request_id": id}), 201
        else:
            return jsonify({"api_status": status}), 500
    else:
        return jsonify({"api_status": str('error: must be on route to send a request')}), 500

# POST a status change to a passenger request (cancel, accept or decline)
@backend_app.route('/update-request/<request_id>', methods=['POST'])
def update_request(request_id):
    data = request.json
    status, id = change_request_status(request_id, data)
    if status=="changed":
        return jsonify({"api_status": status, "request_id": id}), 201
    else:
        return jsonify({"api_status": status}), 500

# GET the status of a request
@backend_app.route('/get-status/<request_id>', methods=['GET'])
def get_status(request_id):
    result = get_request_status(request_id)
    if result == 'Not found':
        return jsonify({"api_status": "Not found"}), 404

    return jsonify({"api_status": "found", "request_status": result}), 200


# GET all pending requests (driver-side)
# example usage: /driver/request?transfer_stop_ref=xxx&outgoing_service=xxx
@backend_app.route('/driver/get-requests', methods=['GET'])
def get_requests():
    stop_ref = request.args.get('transfer_stop_ref')
    service = request.args.get('outgoing_service')
    result = get_incoming_requests(stop_ref, service)
    if result == 'Not found':
        return jsonify({"api_status": "No incoming connections"}), 200

    return jsonify({"api_status": "incoming connection(s)", "data": result}), 200

@backend_app.route("/health", methods=["GET"])
def health():
    return jsonify({"api_status": "Health check okay"}), 200


if __name__ == '__main__':
    backend_app.run(host='localhost', port=8000)