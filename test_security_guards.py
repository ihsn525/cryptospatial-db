import requests
from cryptospatial_sdk import CryptoSpatialSDK

sdk = CryptoSpatialSDK(base_url="http://localhost:8000", api_key="cs_live_3082bcdee41748ec1f1304ff37ce8133")

print("--- Test 2A: Out-of-Bounds Location Ingestion ---")
try:
    # Attempting to ingest a coordinate outside all active delivery hubs (Delhi location)
    res = requests.post("http://localhost:8000/api/v1/driver-pings/ingest", json={
        "driver_id": "ROGUE-DRV-99",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "enforce_boundary_check": True
    })
    print("Status:", res.status_code, "Response:", res.json())
except Exception as e:
    print("Caught:", e)

print("\n--- Test 2B: Unauthorized Break-Glass (Single Key Attack) ---")
try:
    # Attempting emergency unmask with only 1 valid key instead of 2-of-3 quorum
    sdk.emergency_break_glass_unmask(
        driver_id="SWIGGY-DRV-102",
        quorum_keys=["ADMIN-KEY-99"]
    )
except Exception as e:
    print("Quorum Security Intercepted Request (403 Forbidden):", e)