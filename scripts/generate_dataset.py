import uuid
import random
import argparse
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# Base32 Character map for Geohash encoding
BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"

def encode_geohash(latitude, longitude, precision=7):
    """Encode latitude and longitude into Base32 Geohash string."""
    lat_interval = (-90.0, 90.0)
    lon_interval = (-180.0, 180.0)
    geohash = []
    bits = [16, 8, 4, 2, 1]
    bit = 0
    ch = 0
    even = True

    while len(geohash) < precision:
        if even:
            mid = (lon_interval[0] + lon_interval[1]) / 2.0
            if longitude > mid:
                ch |= bits[bit]
                lon_interval = (mid, lon_interval[1])
            else:
                lon_interval = (lon_interval[0], mid)
        else:
            mid = (lat_interval[0] + lat_interval[1]) / 2.0
            if latitude > mid:
                ch |= bits[bit]
                lat_interval = (mid, lat_interval[1])
            else:
                lat_interval = (lat_interval[0], mid)
        even = not even
        if bit < 4:
            bit += 1
        else:
            geohash.append(BASE32[ch])
            bit = 0
            ch = 0

    return "".join(geohash)

def generate_vellore_telemetry(num_records=100000, seed=42):
    """Generates synthetic GPS telemetry matching Section VII-A parameters."""
    np.random.seed(seed)
    random.seed(seed)

    # Vellore Bounding Box (Section VII-A)
    MIN_LAT, MAX_LAT = 12.9600, 12.9800
    MIN_LON, MAX_LON = 79.1300, 79.1600

    # Major road network cluster centers (Katpadi Rd, VIT Perimeter, Highway Junction)
    cluster_centers = [
        (12.9700, 79.1450),  # Katpadi Road Corridor
        (12.9750, 79.1550),  # VIT Campus perimeter
        (12.9650, 79.1380)   # Chittoor Road Junction
    ]

    records = []
    base_time = datetime(2026, 10, 1, 8, 0, 0)
    drivers = [f"DRV-{i:05d}" for i in range(1, 10001)]

    # 70% Gaussian road clusters, 30% uniform background
    num_clustered = int(num_records * 0.70)
    num_uniform = num_records - num_clustered

    # 1. Clustered Points (Gaussian density near road networks)
    for i in range(num_clustered):
        center_lat, center_lon = cluster_centers[i % len(cluster_centers)]
        lat = np.clip(np.random.normal(center_lat, 0.0025), MIN_LAT, MAX_LAT)
        lon = np.clip(np.random.normal(center_lon, 0.0025), MIN_LON, MAX_LON)

        geohash_7 = encode_geohash(lat, lon, precision=7)
        timestamp = base_time + timedelta(seconds=random.randint(0, 86400 * 30))

        records.append({
            "log_id": str(uuid.uuid4()),
            "driver_id": random.choice(drivers),
            "masked_geohash": geohash_7,
            "recorded_at": timestamp.strftime("%Y-%m-%d %H:%M:%S+00"),
            "raw_lat": "",  # Set to NULL on database insert per spec
            "raw_lon": ""   # Set to NULL on database insert per spec
        })

    # 2. Uniform Background Points
    for _ in range(num_uniform):
        lat = np.random.uniform(MIN_LAT, MAX_LAT)
        lon = np.random.uniform(MIN_LON, MAX_LON)

        geohash_7 = encode_geohash(lat, lon, precision=7)
        timestamp = base_time + timedelta(seconds=random.randint(0, 86400 * 30))

        records.append({
            "log_id": str(uuid.uuid4()),
            "driver_id": random.choice(drivers),
            "masked_geohash": geohash_7,
            "recorded_at": timestamp.strftime("%Y-%m-%d %H:%M:%S+00"),
            "raw_lat": "",
            "raw_lon": ""
        })

    df = pd.DataFrame(records)
    return df

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate CryptoSpatial-DB Synthetic Telemetry Dataset")
    parser.add_argument("--records", type=int, default=100000, help="Number of records to generate")
    parser.add_argument("--output", type=str, default="data/dataset_100k.csv", help="Output CSV path")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    print(f"Generating {args.records:,} records with seed={args.seed}...")
    df = generate_vellore_telemetry(num_records=args.records, seed=args.seed)
    df.to_csv(args.output, index=False)
    print(f"Saved dataset to {args.output} successfully.")