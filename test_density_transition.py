from cryptospatial_sdk import CryptoSpatialSDK

sdk = CryptoSpatialSDK(base_url="http://localhost:8000", api_key="cs_live_3082bcdee41748ec1f1304ff37ce8133")
geofence_id = "11111111-1111-1111-1111-111111111111"  # Koramangala Hub

print("--- Step 1: Query Low-Density Zone ---")
print(sdk.get_zone_driver_density(geofence_id))

print("\n--- Step 2: Simulating 8 Drivers Entering the Zone ---")
for i in range(1, 9):
    sdk.mask_and_transmit_ping(
        driver_id=f"SWIGGY-DRV-20{i}",
        latitude=12.9350 + (i * 0.0001),
        longitude=77.6240 + (i * 0.0001)
    )

print("\n--- Step 3: Query High-Density Zone (Notice Auto-Tuned Epsilon) ---")
print(sdk.get_zone_driver_density(geofence_id))