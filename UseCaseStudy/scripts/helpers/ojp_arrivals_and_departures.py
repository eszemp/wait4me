import os
import requests
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

class OJPStopDepArrRequest:
    
    def __init__(self):
        self.api_key = os.environ.get('OJP_ACCESS_TOKEN')
        self.endpoint = "https://api.opentransportdata.swiss/ojp20"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "text/xml; charset=utf-8",
        }
        self.requestor_ref = 'Wait4Me'
        # XML Namespaces used in OJP
        self.ns = {
            'ojp': 'http://www.vdv.de/ojp',
            'siri': 'http://www.siri.org.uk/siri',
            'xsi': 'http://www.w3.org/2001/XMLSchema-instance'
        }
    

    def _build_xml_payload(self, stop_ref, request_type, timestamp, number_of_results):
        """Builds the OJP 2.0 StopEventRequest XML."""
        curTime = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        if timestamp is None:
            # Format: 2024-03-25T12:00:00Z
            time = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        else: 
            timestamp = timestamp.strftime('%Y-%m-%dT%H:%M:%SZ') 

        assert request_type in ["both", "departure", "arrival"]

        xml_template = f"""<?xml version="1.0" encoding="UTF-8"?>
                        <OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0">
                            <OJPRequest>
                                <siri:ServiceRequest>
                                    <siri:RequestTimestamp>{curTime}</siri:RequestTimestamp>
                                    <siri:RequestorRef>{self.requestor_ref}</siri:RequestorRef>
                                    <OJPStopEventRequest>
                                        <siri:RequestTimestamp>{curTime}</siri:RequestTimestamp>
                                        <Location>
                                            <PlaceRef>
                                                <siri:StopPointRef>{stop_ref}</siri:StopPointRef>
                                            </PlaceRef>
                                            <DepArrTime>{timestamp}</DepArrTime>
                                        </Location>
                                        <Params>
                                            <NumberOfResults>{number_of_results}</NumberOfResults>
                                            <StopEventType>{request_type}</StopEventType>
                                            <IncludeOnwardCalls>true</IncludeOnwardCalls>
                                            <UseRealtimeData>explanatory</UseRealtimeData>
                                        </Params>
                                    </OJPStopEventRequest>
                                </siri:ServiceRequest>
                            </OJPRequest>
                        </OJP>"""

        return xml_template

    def fetch_departures_or_arrivals(self, stop_ref, request_type="departure", timestamp=None, number_of_results=50):
        """Sends the request and returns the parsed results."""
        payload = self._build_xml_payload(stop_ref, request_type, timestamp, number_of_results)
        
        response = requests.post(self.endpoint, data=payload, headers=self.headers)

        if response.status_code == 429:
            print(f"\nAPI Error: {response.status_code} - {response.text}\nWaiting for 30 seconds")
            time.sleep(30)
            response = requests.post(self.endpoint, data=payload, headers=self.headers)

            if response.status_code != 200:
                raise Exception(f"API Error: {response.status_code} - {response.text}")
        
        elif response.status_code != 200:
            raise Exception(f"API Error: {response.status_code} - {response.text}")
            
        return self._parse_response(response.text, request_type)

    
    def _parse_response(self, xml_text, request_type):
        """Parses the XML response into a list of simplified dictionaries."""
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as e:
            raise Exception(f"Failed to parse XML: {e}")

        results = []

        # 1. Improved Namespace Handling
        # The response often puts the main OJP elements in the default namespace
        # We find all StopEvent elements regardless of where they are
        stop_events = root.findall('.//{http://www.vdv.de/ojp}StopEvent')

        for stop_event in stop_events:
            # Helper to find nested text safely
            def get_text(element, path):
                target = element.find(path, self.ns)
                return target.text if target is not None else "N/A"

            # 2. Updated Paths based on OJP 2.0 Structure
            # Service info
            service = stop_event.find('.//ojp:Service', self.ns)
            line = "N/A"
            destination = "N/A"
            
            if service is not None:
                line = get_text(service, './/ojp:PublishedServiceName/ojp:Text')
                destination = get_text(service, './/ojp:DestinationText/ojp:Text')

            # Time info (ThisCall)
            # Look specifically for TimetableTime or EstimatedTime
            this_call = stop_event.find('.//ojp:ThisCall/ojp:CallAtStop', self.ns)
            timestamp = "N/A"
            if this_call is not None:
                if request_type=="departure":
                    timestamp = get_text(this_call, './/ojp:ServiceDeparture/ojp:TimetabledTime')
                elif request_type=="arrival":
                    timestamp = get_text(this_call, './/ojp:ServiceArrival/ojp:TimetabledTime')
            
            results.append({
                "line": line,
                "destination": destination,
                "time": datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%SZ")
            })
            
        return results

# --- Example Usage ---
if __name__ == "__main__":
    
    # Example: Bern Hauptbahnhof (8507000), 8577442
    ojp = OJPStopDepArrRequest()
    
    try:
        departures = ojp.fetch_departures_or_arrivals("8577442", timestamp=datetime(year=2026, month=4, day=15, hour=21, minute=0, second=0))
        print(f"{'Line':<10} | {'Destination':<25} | {'Departure'}")
        print("-" * 55)
        for dep in departures:
            print(f"{dep['line']:<10} | {dep['destination']:<25} | {dep['time']}")
    except Exception as e:
        print(f"Error: {e}")

    try:
        arrivals = ojp.fetch_departures_or_arrivals("8577442", request_type="arrival",  timestamp=datetime(year=2026, month=4, day=15, hour=21, minute=0, second=0))
        print(arrivals)
    except Exception as e:
        print(f"Error: {e}")