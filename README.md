# Wait4Me

This repository contains code and the website for Wait4Me. Under [Wait4Me](www.needs-to-be-added.ch) you find the prototype online.


## Setup

### Install Pyenv and Poetry



### Create Environment

Execute the following in a terminal:
```shell
# Create virtualenv, install all dependencies and pre-commit hooks in one command:
make
```


## Contents and Concepts

The following table describe the main structure of the project:

| Folder | Purpose |
|--------|-----|
| `.venv` | This is where the Poetry-managed venv lives. |
| `.vscode` | This is where settings for vscode live. Some useful defaults are added in case you use vscode in your project. If not, this can savely be deleted. |
| `notebooks` | Jupyter-notebooks for data analysis. |
| `src\pagu_data_analysis` | Main directory for the python code. |
| `tests` | Directory containing all tests. This directory will be scanned by the test-infrastructure to find testcases. |




### Test cases

- Multiple delayed transfers
- Allready delayed when routing
- Delay while travelling
- Connection with multiple transfers and one is delayed
- Functionality of restriction