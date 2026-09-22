#!/usr/bin/env bash

# ==============================================================================
# CryptoSpatial-DB Management Script
# Automated Start, Stop, Status, and Log Tracking
# ==============================================================================

PROJECT_DIR="$HOME/projects/cryptospatial-db"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
PID_DIR="$PROJECT_DIR/.pids"
LOG_DIR="$PROJECT_DIR/logs"

CONTAINER_NAME="cryptospatial_postgres"

mkdir -p "$PID_DIR" "$LOG_DIR"

start_db() {
    echo "[1/3] Starting PostGIS Database Container ($CONTAINER_NAME)..."
    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo "      PostgreSQL container is already running."
    else
        docker start $CONTAINER_NAME > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "      PostgreSQL container started successfully."
        else
            echo "      ERROR: Failed to start Docker container. Check Docker service."
            exit 1
        fi
    fi
}

start_backend() {
    echo "[2/3] Starting FastAPI Backend Engine (Port 8000)..."
    if [ -f "$PID_DIR/backend.pid" ] && kill -0 $(cat "$PID_DIR/backend.pid") 2>/dev/null; then
        echo "      FastAPI backend is already running."
    else
        cd "$BACKEND_DIR" || exit
        source venv/bin/activate
        nohup uvicorn app.main:app --reload --port 8000 > "$LOG_DIR/backend.log" 2>&1 &
        echo $! > "$PID_DIR/backend.pid"
        echo "      FastAPI started (PID: $(cat $PID_DIR/backend.pid)). Logs -> logs/backend.log"
    fi
}

start_frontend() {
    echo "[3/3] Starting React Vite Frontend Dashboard (Port 5173)..."
    if [ -f "$PID_DIR/frontend.pid" ] && kill -0 $(cat "$PID_DIR/frontend.pid") 2>/dev/null; then
        echo "      React frontend is already running."
    else
        cd "$FRONTEND_DIR" || exit
        nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
        echo $! > "$PID_DIR/frontend.pid"
        echo "      React Vite started (PID: $(cat $PID_DIR/frontend.pid)). Logs -> logs/frontend.log"
    fi
}

stop_all() {
    echo "Stopping all CryptoSpatial-DB services..."

    # Stop Frontend
    if [ -f "$PID_DIR/frontend.pid" ]; then
        PID=$(cat "$PID_DIR/frontend.pid")
        echo "   Stopping React Frontend (PID: $PID)..."
        kill -9 $PID 2>/dev/null
        rm -f "$PID_DIR/frontend.pid"
    fi

    # Stop Backend
    if [ -f "$PID_DIR/backend.pid" ]; then
        PID=$(cat "$PID_DIR/backend.pid")
        echo "   Stopping FastAPI Backend (PID: $PID)..."
        kill -9 $PID 2>/dev/null
        rm -f "$PID_DIR/backend.pid"
    fi

    # Cleanup potential leftover processes on ports 8000 and 5173
    fuser -k 8000/tcp > /dev/null 2>&1
    fuser -k 5173/tcp > /dev/null 2>&1

    # Stop Docker Container
    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo "   Stopping PostgreSQL Docker container..."
        docker stop $CONTAINER_NAME > /dev/null 2>&1
    fi

    echo "All CryptoSpatial-DB services stopped."
}

status_check() {
    echo "=================================================="
    echo "           CryptoSpatial-DB Status                "
    echo "=================================================="

    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo "  Database (PostGIS 16): [ ONLINE  ] (Port 5432)"
    else
        echo "  Database (PostGIS 16): [ OFFLINE ]"
    fi

    if [ -f "$PID_DIR/backend.pid" ] && kill -0 $(cat "$PID_DIR/backend.pid") 2>/dev/null; then
        echo "  Backend  (FastAPI):    [ ONLINE  ] -> http://127.0.0.1:8000/docs"
    else
        echo "  Backend  (FastAPI):    [ OFFLINE ]"
    fi

    if [ -f "$PID_DIR/frontend.pid" ] && kill -0 $(cat "$PID_DIR/frontend.pid") 2>/dev/null; then
        echo "  Frontend (React Vite): [ ONLINE  ] -> http://localhost:5173"
    else
        echo "  Frontend (React Vite): [ OFFLINE ]"
    fi
    echo "=================================================="
}

case "$1" in
    start)
        start_db
        start_backend
        start_frontend
        echo ""
        status_check
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        sleep 2
        start_db
        start_backend
        start_frontend
        echo ""
        status_check
        ;;
    status)
        status_check
        ;;
    logs)
        echo "Streaming active logs (Press Ctrl+C to stop)..."
        tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
        ;;
    *)
        echo "Usage: ./manage.sh {start|stop|restart|status|logs}"
        exit 1
        ;;
esac