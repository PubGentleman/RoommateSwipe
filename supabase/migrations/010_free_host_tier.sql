ALTER TABLE users ALTER COLUMN host_plan SET DEFAULT 'free';

UPDATE users SET host_plan = 'free' WHERE host_plan = 'none' OR host_plan IS NULL;
