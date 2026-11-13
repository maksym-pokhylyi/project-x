-- Runs once, when the docker-compose Postgres volume is first created.
CREATE DATABASE app_test OWNER app;
CREATE DATABASE app_e2e OWNER app;
