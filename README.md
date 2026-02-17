# Pagu Data Analysis

ARCHIVIERT [Datensicherung für Nachweisführung des Piloten (Sept-Okt 2024)](https://sbb.sharepoint.com/:f:/s/pantoguard-umsetzung/EjHydHzT8FlNgxh_0K48CHgBdDu5bxKyFa0adAwX1k-A2Q?e=cWRDov)

```shell
Disclaimer:

Diese Version von PAGU wurde als Proof of Concept (PoC) umgesetzt und wird nun mit der Ablösung durch das Produkt nicht mehr gepflegt. Diese Dokumentation dient dazu, die Datensicherung für die Nachweisführung des Piloten (Sept-Okt 2024) sicherzustellen, sodass die Archivierung der Ergebnisse im Bedarfsfall reproduziert werden kann. Es ist jedoch zu beachten, dass ein gewisser manueller Aufwand erforderlich ist. Die Berechnungslogik und weitere relevante Informationen sind im Archiv gesichert, wodurch die Experimente und Ergebnisse reproduziert werden können.
```




This repository contains code and notebooks to perform data analysis on monitoring and positioning data in PAGU project. See https://confluence.sbb.ch/display/PANTO and https://confluence.sbb.ch/x/cKV6pw in particular for details about the project.


## Setup

### Install Pyenv and Poetry

- If not already installed, install [pyenv](https://github.com/pyenv/pyenv).

- If not already installed, get Poetry according to <https://python-poetry.org/docs/#installation>. If your are new to Poetry, you may find <https://python-poetry.org/docs/basic-usage/> interesting.

### Create Environment

Execute the following in a terminal:
```shell
# Create virtualenv, install all dependencies and pre-commit hooks in one command:
make
```

### Connection to Snowflake

Create a file `credentials.env` with the following content:

```
SNOWFLAKE_ACCOUNT=sbb-eap
SNOWFLAKE_USER=PROD_STD_DARCSCILAB_USER
SNOWFLAKE_PASSWORD=<...>
SNOWFLAKE_ROLE=FUNC_DARCSCILAB_STD_RW_PROD
SNOWFLAKE_WAREHOUSE=PROD_DARCSCILAB_BI_WH
SNOWFLAKE_SCHEMA=PAGU
SNOWFLAKE_DATABASE=PROD_STD_DARCSCILAB_DB
```

For passwords, see Azure Keyvault.

You might need to whitelist your IP with

```
CALL EAP.NETWORK_POLICIES.ADD_TEMPORARY_PROJECT_POLICY('DARCSCILAB','homeoffice_<your u-number>','<your IP>');
```

## Contents and Concepts

At first glance one may be overwhelmed by the amount of files and folders present in this directory. This is mainly due to the fact, that each tool uses its own configuration file. The situation has improved with more and more tools adding support for pyproject.toml. The following two tables describe the main structure of the project:

| Folder | Purpose |
|--------|-----|
| `.venv` | This is where the Poetry-managed venv lives. |
| `.vscode` | This is where settings for vscode live. Some useful defaults are added in case you use vscode in your project. If not, this can savely be deleted. |
| `notebooks` | Jupyter-notebooks for data analysis. |
| `src\pagu_data_analysis` | Main directory for the python code. |
| `tests` | Directory containing all tests. This directory will be scanned by the test-infrastructure to find testcases. |

| File                      | Purpose |
|---------------------------|---------|
| `.gitattributes`           | Attributes for git are defined in this file, such as automatic line-ending conversion. |
| `.gitignore`               | This file contains a list of path patterns that you want to ignore for git (they will never appear in commits). |
| `.pre-commit-config.yaml`  | This file contains configuration for the pre-commit hook, which is run whenever you `git commit`, you can configure running code quality tools and tests here. |
| `estaTektonPipeline.yaml`  | Configuration file for Continuous Integration on the ESTA Tekton Pipeline infrastructure. Refer to [ESTA Tekton Parameters - estaTektonPipeline.json](https://confluence.sbb.ch/display/CLEW/ESTA+Tekton+Parameters+-+estaTektonPipeline.json) for more information. |
| `poetry.toml`              | Configuration for Poetry. |
| `pyproject.toml`           | This file contains meta information for your project, as well as a high-level specification of the dependencies of your project, from which Poetry will do its dependency resolution and generate the `poetry.lock`. Also, it contains some customization for code-quality tools. Check [PEP 621](https://peps.python.org/pep-0621/) for details. |
| `README.md`                | This file. Document how to develop and use your application in here. |
| `sonar-project.properties` | Configuration for the Sonar check. |

### The main code base: `src\pagu_data_analysis`

The main architecture is inspired by domain-driven design and consists of four layers:

| Folder | Purpose |
|--------|-----|
| `application` | Contains the applications (data loading, data evaluation, assessment of pagu). |
| `configuration` | Contains all configuration code. |
| `domain` | All business logic is implemented here ("Fachlichkeit"). This encompasses everything from classes for vehicles to confidence intervals. |
| `infrastructure` | Contains all the code for providing the infrastructure for the applications, including the database and the interaction with the Azure blob storage. |

Currently the dependencies between the layers look as follows (*a -> b* means *b* imports from *a*):

<img src="utils/ddd.svg" alt="drawing" width="400"/>

**Notes:**

1. `domain` forms the core and does not import from any of the other layer since the business logic comes first and does not depend on our `infrastructure`, `application` or `configuration`. We want to be able to change our `infrastructure` and `application` without affecting the business logic.
2. Currently, `application` depends on `infrastructure`. This might / should be turned around. The `application` should dictate the interfaces that the `infrastructure` has to meet, not the other way around. We want to be able to change the `infrastructure` without affecting the `application`.

## Environment Variable

The following environment variables may be used to configure `pagu_data_analysis`:

| Environment Variable | Purpose | Default Value | Allowed Values |
|----------------------|-|-|-|
| LOG_LEVEL            | Sets the default log level [here](src/pagu_data_analysis/common/logging_configuration.py). | "INFO" | See [Python Standard Library API-Reference](https://docs.python.org/3/library/logging.html#logging-levels) |
