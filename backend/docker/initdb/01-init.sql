-- Runs once, when the Postgres data volume is first initialised.
-- Creates an isolated database used by the backend test-suite.

CREATE DATABASE paperflow_test;
GRANT ALL PRIVILEGES ON DATABASE paperflow_test TO paperflow;
