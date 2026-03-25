import os
import re
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

class OJPStopInfoRequest:
    
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
    

    def _build_xml_payload(self, stop_ref):
        """Builds the OJP 2.0 StopEventRequest XML."""
        curTime = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

        xml_template = f"""<?xml version="1.0" encoding="UTF-8"?>
                        <OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0">
                            <OJPRequest>
                                <siri:ServiceRequest>
                                    <siri:RequestTimestamp>{curTime}</siri:RequestTimestamp>
                                    <siri:RequestorRef>{self.requestor_ref}</siri:RequestorRef>
                                    <OJPLocationInformationRequest>
                                        <siri:RequestTimestamp>{curTime}</siri:RequestTimestamp>
                                        <PlaceRef>
                                            <siri:StopPointRef>{stop_ref}</siri:StopPointRef>
                                        </PlaceRef>
                                        <Restrictions>
                                            <Type>stop</Type>
                                            <NumberOfResults>1</NumberOfResults>
                                        </Restrictions>
                                    </OJPLocationInformationRequest>
                                </siri:ServiceRequest>
                            </OJPRequest>
                        </OJP>"""

        return xml_template

    def fetch_transfer_time(self, stop_ref):
        """Sends the request and returns the parsed results."""
        payload = self._build_xml_payload(stop_ref)

        print(payload)
        
        response = requests.post(self.endpoint, data=payload, headers=self.headers)

        print("returned")

        print(response.text)
        
        if response.status_code != 200:
            raise Exception(f"API Error: {response.status_code} - {response.text}")
            
        return self._parse_response(response.text)

    
    def _parse_duration(self, duration_str):
        """
        Converts ISO 8601 duration (e.g., PT2M, PT1H30M) to a timedelta object.
        """
        if not duration_str or duration_str == "N/A":
            return None
            
        # Regex to match Hours (H), Minutes (M), and Seconds (S)
        pattern = r'PT(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)S)?'
        match = re.match(pattern, duration_str)
        if not match:
            return None
            
        parts = {k: int(v) if v else 0 for k, v in match.groupdict().items()}
        return timedelta(**parts)

    def _parse_response(self, xml_text):
        """
        Parses the OJPLocationInformationResponse specifically for PlaceRefStructure.
        """
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as e:
            raise Exception(f"Failed to parse XML: {e}")

        results = []
        # Find all Location elements in the response
        locations = root.findall('.//ojp:Location', self.ns)

        for location in locations:
            # 1. Extract Name
            name = "N/A"
            name_el = location.find('.//ojp:LocationName/ojp:Text', self.ns)
            if name_el is not None:
                name = name_el.text

            # 2. Extract StopPointRef (the unique ID for the stop)
            stop_ref = "N/A"
            ref_el = location.find('.//siri:StopPointRef', self.ns)
            if ref_el is not None:
                stop_ref = ref_el.text

            # 3. Extract DefaultTransferTime (e.g., PT2M)
            raw_duration = "N/A"
            dt_el = location.find('.//ojp:DefaultTransferTime', self.ns)
            if dt_el is not None:
                raw_duration = dt_el.text

            # Convert duration to a usable timedelta/seconds
            # duration_delta = self._parse_duration(raw_duration)
            # transfer_seconds = int(duration_delta.total_seconds()) if duration_delta else 0
            transfer_seconds = raw_duration

            results.append({
                "stop_name": name,
                "stop_ref": stop_ref,
                "transfer_time_raw": raw_duration,
                "transfer_seconds": transfer_seconds,
                "type": "stop"
            })
            
        return results
    


# --- Example Usage ---
if __name__ == "__main__":
    
    ojp = OJPStopInfoRequest()
    
    try:
        transfer_time = ojp.fetch_transfer_time("8507000") # Example: Bern Hauptbahnhof (8507000)
        print(transfer_time)

    except Exception as e:
        print(f"Error: {e}")