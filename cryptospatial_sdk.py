import requests
from typing import Dict, Any, List, Optional

class CryptoSpatialSDK:
    def __init__(self, base_url: str = "http://127.0.0.1:8000", api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    def generate_api_key(self, client_name: str) -> Dict[str, Any]:
        url = f"{self.base_url}/v1/sdk/keys/generate"
        payload = {"client_name": client_name}
        response = requests.post(url, json=payload, timeout=5)
        response.raise_for_status()
        res_data = response.json()
        if "raw_api_key" in res_data:
            self.api_key = res_data["raw_api_key"]
        return res_data

    def mask_and_transmit_ping(
        self, driver_id: str, latitude: float, longitude: float, precision: int = 7
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/v1/sdk/telemetry/mask"
        payload = {
            "driver_id": driver_id,
            "raw_latitude": latitude,
            "raw_longitude": longitude,
            "precision": precision
        }
        response = requests.post(url, json=payload, headers=self._get_headers(), timeout=5)
        response.raise_for_status()
        return response.json()

    def verify_restaurant_presence(
        self, driver_id: str, masked_geohash: str, geofence_id: str
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/v1/sdk/zone/proof-of-presence"
        payload = {
            "driver_id": driver_id,
            "masked_geohash": masked_geohash,
            "geofence_id": geofence_id
        }
        response = requests.post(url, json=payload, headers=self._get_headers(), timeout=5)
        response.raise_for_status()
        return response.json()

    def get_zone_driver_density(self, geofence_id: str) -> Dict[str, Any]:
        url = f"{self.base_url}/v1/sdk/analytics/privacy-count"
        params = {"geofence_id": geofence_id}
        response = requests.get(url, params=params, headers=self._get_headers(), timeout=5)
        response.raise_for_status()
        return response.json()

    def emergency_break_glass_unmask(self, driver_id: str, quorum_keys: List[str]) -> Dict[str, Any]:
        url = f"{self.base_url}/v1/sdk/emergency/break-glass"
        payload = {
            "driver_id": driver_id,
            "quorum_keys": quorum_keys
        }
        response = requests.post(url, json=payload, headers=self._get_headers(), timeout=5)
        response.raise_for_status()
        return response.json()