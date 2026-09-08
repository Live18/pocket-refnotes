select tablename, policyname, roles
from pg_policies
where 'anon' = any(roles);