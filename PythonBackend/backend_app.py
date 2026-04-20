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
        return create_new_request(data)
    else:
        return jsonify({"error": str('must be on route to send a request')}), 500

# POST a status change to a passenger request (cancel, accept or decline)
# TODO: post status change to multiple requests at once?
@backend_app.route('/update-request/<request_id>', methods=['POST'])
def update_request(request_id):
    data = request.json
    return change_request_status(request_id, data)

# GET the status of a request
@backend_app.route('/get-status/<request_id>', methods=['GET'])
def get_status(request_id):
    return get_request_status(request_id)

# GET all pending requests (driver-side)
# example usage: /driver/request?transfer_stop_ref=xxx&outgoing_service=xxx
@backend_app.route('/driver/get-requests', methods=['GET'])
def get_requests():
    stop_ref = request.args.get('transfer_stop_ref')
    service = request.args.get('outgoing_service')
    return get_incoming_requests(stop_ref, service)

@backend_app.route("/health", methods=["GET"])
def health():
    return jsonify({"message": "Health check okay"}), 200


if __name__ == '__main__':
    backend_app.run(host='0.0.0.0', port=8000)