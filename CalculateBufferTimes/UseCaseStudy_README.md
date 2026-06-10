# Buffer Analysis
## Set Up
To set up the Python environment for running the Jupyter notebooks in the scripts folder:

1. Create a virtual environment:
   ```bash
   python -m venv env
   ```

2. Activate the virtual environment:
   ```bash
   source env/bin/activate
   ```

3. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a Jupyter kernel:
   ```bash
   python -m ipykernel install --user --name buffer-analysis --display-name "Buffer Analysis"
   ```

Now you can select the "Buffer Analysis" kernel in your Jupyter notebooks.

## OJP API token
Create a file named `.env` in `UseCaseStudy/` with this content:

```bash
OJP_ACCESS_TOKEN=your_access_token_here
```

The helper scripts in `scripts/helpers/` load that file automatically.