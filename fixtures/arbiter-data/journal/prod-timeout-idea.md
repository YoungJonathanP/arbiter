# Prod timeout idea

Prod timeouts spike around 09:00 UTC — maybe cron-related? Saw three 504s in a row on /api/reports right when the daily export fires. Worth checking whether the export job is starving the connection pool.
