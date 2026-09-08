select e.id as entry_id, e.game_id, g.title, g.opponent, g.location, g.game_date
from entries e
join games g on g.id = e.game_id
where e.id = '57054fcc-da7c-4c8d-a27e-68e990065761';