import os
import re
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path


def _load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file(Path(__file__).resolve().parents[2] / ".env")


def normalize_station_name(name: str) -> str:
    """Normalize common station naming variants to a shared base name."""
    value = str(name).strip()
    
    # Example: "Cham (Cham (CH))" -> Handle nested parentheses by removing all content from the *last* open parenthesis downwards,
    # or comprehensively drop a trailing `(...)` block even if it contains inner parens.
    # regex matches a space, an opening parenthesis, any characters recursively/non-greedily, up to a final closing parenthesis at the end of the string.
    value = re.sub(r"\s*\([^)]*\)?\)*$", "", value)
    value = re.sub(r"\s*,\s*Bahnhof(?:\s+[\wÀ-ÿ./-]+)*$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+Bahnhof(?:\s+[\wÀ-ÿ./-]+)*$", "", value, flags=re.IGNORECASE)
    return value.strip()

class OJPStopInfoRequest:
    
    def __init__(self):
        self.api_key = os.environ.get('OJP_ACCESS_TOKEN')
        self.endpoint = "https://odpch-api.clients.liip.ch/ojp20-beta"
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

    def _build_location_search_payload(self, name, number_of_results):
        """Builds an OJP 2.0 LocationInformationRequest for a station name search."""
        curTime = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

        return f"""<?xml version="1.0" encoding="UTF-8"?>
                        <OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" version="2.0">
                            <OJPRequest>
                                <siri:ServiceRequest>
                                    <siri:RequestTimestamp>{curTime}</siri:RequestTimestamp>
                                    <siri:RequestorRef>{self.requestor_ref}</siri:RequestorRef>
                                    <OJPLocationInformationRequest>
                                        <siri:RequestTimestamp>{curTime}</siri:RequestTimestamp>
                                        <InitialInput>
                                            <Name>{name}</Name>
                                        </InitialInput>
                                        <Restrictions>
                                            <Type>stop</Type>
                                            <NumberOfResults>{number_of_results}</NumberOfResults>
                                        </Restrictions>
                                    </OJPLocationInformationRequest>
                                </siri:ServiceRequest>
                            </OJPRequest>
                        </OJP>"""

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

    def fetch_places_by_name(self, name, number_of_results=25):
        """Search for places and return matching stop-place / stop-point entries."""
        payload = self._build_location_search_payload(name, number_of_results)

        response = requests.post(self.endpoint, data=payload, headers=self.headers)

        if response.status_code != 200:
            raise Exception(f"API Error: {response.status_code} - {response.text}")

        return self._parse_location_response(response.text)

    
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

    def _parse_location_response(self, xml_text):
        """Parse OJPLocationInformationResponse place results into a simple structure."""
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError as e:
            raise Exception(f"Failed to parse XML: {e}")

        results = []
        for place_result in root.findall('.//{http://www.vdv.de/ojp}PlaceResult'):
            place = place_result.find('{http://www.vdv.de/ojp}Place')
            if place is None:
                continue

            stop_place_ref = place.findtext('.//{http://www.vdv.de/ojp}StopPlaceRef')
            stop_point_ref = place.findtext('.//{http://www.siri.org.uk/siri}StopPointRef')
            topographic_place_ref = place.findtext('.//{http://www.vdv.de/ojp}TopographicPlaceRef')
            place_name = place.findtext('.//{http://www.vdv.de/ojp}Name/{http://www.vdv.de/ojp}Text')
            stop_place_name = place.findtext('.//{http://www.vdv.de/ojp}StopPlaceName/{http://www.vdv.de/ojp}Text')
            stop_point_name = place.findtext('.//{http://www.vdv.de/ojp}StopPointName/{http://www.vdv.de/ojp}Text')

            results.append(
                {
                    "name": place_name or stop_place_name or stop_point_name or "N/A",
                    "stop_place_ref": stop_place_ref,
                    "stop_point_ref": stop_point_ref,
                    "topographic_place_ref": topographic_place_ref,
                    "normalized_name": normalize_station_name(
                        place_name or stop_place_name or stop_point_name or ""
                    ),
                }
            )

        return results
    


# --- Example Usage ---
if __name__ == "__main__":
    
    ojp = OJPStopInfoRequest()
    
    try:
        transfer_time = ojp.fetch_transfer_time("8507000") # Example: Bern Hauptbahnhof (8507000)
        print(transfer_time)

    except Exception as e:
        print(f"Error: {e}")