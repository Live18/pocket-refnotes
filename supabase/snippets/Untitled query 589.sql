select policyname, qual, with_check
from pg_policies
where tablename = 'profiles' and policyname = 'update own basic info';