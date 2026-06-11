#!/bin/bash
  
echo "Starting app"

source /instances/home/wait4meprd/venv/bin/activate

cd /instances/home/wait4meprd/wait4me/PythonBackend

screen -S w4m-backend -d -m bash -c "waitress-serve --host=127.0.0.1 --port=8000 backend_app:backend_app"