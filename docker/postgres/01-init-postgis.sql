-- Run on first start of yarok-db container (docker-entrypoint-initdb.d).
CREATE EXTENSION IF NOT EXISTS postgis;
