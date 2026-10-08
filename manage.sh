#!/usr/bin/env bash

# ==============================================================================
# CryptoSpatial-DB Management Script (Docker Compose Edition)
# Automated Start, Stop, Status, and Log Tracking
# ==============================================================================

start_stack() {
    echo "[1/2] Starting CryptoSpatial-DB Stack with Docker Compose..."
    docker compose up --build -d
    echo "[2/2] Waiting for containers to initialize..."
    sleep 3
}

stop_stack() {
    echo "Stopping CryptoSpatial-DB Stack..."
    docker compose down
    echo "All containers stopped."
}

status_check() {
    echo "=================================================="
    echo "           CryptoSpatial-DB Stack Status          "
    echo "=================================================="
    docker compose ps
    echo "=================================================="
    echo "  Backend API Docs: http://localhost:8000/docs"
    echo "  Frontend Dashboard: http://localhost:5173"
    echo "=================================================="
}

case "$1" in
    start)
        start_stack
        status_check
        ;;
    stop)
        stop_stack
        ;;
    restart)
        stop_stack
        sleep 2
        start_stack
        status_check
        ;;
    status)
        status_check
        ;;
    logs)
        echo "Streaming active stack logs (Press Ctrl+C to stop)..."
        docker compose logs -f
        ;;
    *)
        echo "Usage: ./manage.sh {start|stop|restart|status|logs}"
        exit 1
        ;;
esac