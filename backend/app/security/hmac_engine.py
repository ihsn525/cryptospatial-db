import hmac
import hashlib
import time

# Server-side secret key for HMAC token generation
SERVER_HMAC_KEY = b"crypto_spatial_db_secret_key_2026_vit"

def generate_attestation_token(driver_id: str, geofence_id: str, epoch_time: float = None) -> str:
    """
    Generates a 12-character hex HMAC token valid for a 5-minute (300s) time window.
    """
    if epoch_time is None:
        epoch_time = time.time()
    
    # Calculate 5-minute window slot index
    time_window = int(epoch_time // 300)
    
    message = f"{driver_id}:{geofence_id}:{time_window}".encode('utf-8')
    signature = hmac.new(SERVER_HMAC_KEY, message, hashlib.sha256).hexdigest()
    
    # Return truncated 12-char token
    return f"attest_{signature[:12]}"


def verify_attestation_token(token: str, driver_id: str, geofence_id: str) -> bool:
    """
    Verifies token against current and previous 5-minute time windows using constant-time comparison.
    """
    current_time = time.time()
    
    # Check current window (0) and previous window (-1 for network delay tolerance)
    for offset in [0, -1]:
        valid_token = generate_attestation_token(driver_id, geofence_id, current_time + (offset * 300))
        if hmac.compare_digest(token, valid_token):
            return True
            
    return False