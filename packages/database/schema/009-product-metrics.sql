CREATE TABLE IF NOT EXISTS product_metrics(day date NOT NULL,event text NOT NULL,count bigint NOT NULL DEFAULT 0,PRIMARY KEY(day,event));
CREATE TABLE IF NOT EXISTS product_metric_limits(visitor_hash text NOT NULL,day date NOT NULL,count integer NOT NULL DEFAULT 0,PRIMARY KEY(visitor_hash,day));
