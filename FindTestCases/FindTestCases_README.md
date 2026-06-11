# FindTestCases

This is a tool developped to aid in the testing of the application by making it easier to identify currently broken connections where Wait4Me can be used.

## Structure

```text
FindTestCases/
  |- FindTestCases_README.md
  |- realtime_testcases.py
  |- testcases.txt
  `- .env.example
```

- `realtime_testcases.py`: Script that finds currently delayed services and connections with broken transfers. Should be run from the parent directory of FindTestCases, so that it can import its modules correctly.
- `testcases.txt`: Result of the script (possible routes with broken connections).

## Set Up

You can use the same virtual environment used for the calculation of buffer times to run this script.

Use `.env.example` as a template for the environment file to store the Access Tokens for the GEOPS API used by the scrip. Create a file named `.env` with the same structure:

```bash
GEOPS_API_KEY=your_access_token_here
```