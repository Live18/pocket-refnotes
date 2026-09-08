select grantee, privilege_type
from information_schema.role_table_grants
where table_name in ('report_jobs', 'entries')
order by table_name, grantee;