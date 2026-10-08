from cryptospatial_sdk import CryptoSpatialSDK

# 1. Initialize SDK pointing to your Dockerized FastAPI container
API_KEY = "cs_live_d3f3a76213931efb908ae4a73ce6b510"  # Replace with key generated in Step 3
sdk = CryptoSpatialSDK(base_url="http://localhost:8000", api_key=API_KEY)

print("\n--- 1. Testing Telemetry Edge Masking ---")
ping_res = sdk.mask_and_transmit_ping(
    driver_id="DOCKER-DRV-77",
    latitude=12.935241,
    longitude=77.624518,
    precision=7
)
print("Response:", ping_res)

print("\n--- 2. Testing Proof-of-Presence Verification ---")
presence_res = sdk.verify_restaurant_presence(
    driver_id="DOCKER-DRV-77",
    masked_geohash=ping_res["masked_geohash"],
    geofence_id="11111111-1111-1111-1111-111111111111"
)
print("Response:", presence_res)

print("\n--- 3. Testing Dynamic Differential Privacy Audit ---")
density_res = sdk.get_zone_driver_density(
    geofence_id="11111111-1111-1111-1111-111111111111"
)
print("Response:", density_res)

print("\n--- 4. Testing Emergency Break-Glass Unmasking ---")
unmask_res = sdk.emergency_break_glass_unmask(
    driver_id="DOCKER-DRV-77",
    quorum_keys=["ADMIN-KEY-99", "POLICE-KEY-42"]
)
print("Response:", unmask_res)