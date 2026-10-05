-- GENERATED FILE — do not edit by hand.
-- Source: seed/org.json · Regenerate: npm run seed:generate

begin;

insert into campuses (key, name, is_primary) values
  ('holly-springs', 'Holly Springs', true),
  ('union-hill', 'Union Hill', false)
on conflict (key) do update set name = excluded.name, is_primary = excluded.is_primary;

insert into people (key, full_name, email) values
  ('allan-malloy', 'Dr. Allan Malloy', null),
  ('jb-kitts', 'JB Kitts', null),
  ('thomas-davis', 'Thomas Davis', null),
  ('roumar-bromfield', 'Roumar Bromfield', null),
  ('zach-woodall', 'Zach Woodall', 'zach@newlifecanton.com'),
  ('sarah-woodall', 'Sarah Woodall', null),
  ('levi-porter', 'Levi Porter', null),
  ('vannessa-smith', 'Vannessa Smith', null),
  ('anna', 'Anna', null),
  ('john-booth', 'John Booth', null),
  ('josh-floyd', 'Josh Floyd', null),
  ('brandon-ford', 'Brandon Ford', null),
  ('shelby-koerner', 'Shelby Koerner', null),
  ('charlie-shultz', 'Charlie Shultz', null),
  ('kathy-malloy', 'Kathy Malloy', null)
on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;

insert into positions (key, title, department, campus_id, campus_lead)
select v.key, v.title, v.department, c.id, v.campus_lead
  from (values
    ('hs-senior-pastor', 'Senior Pastor', 'Leadership', 'holly-springs', false),
    ('hs-executive-pastor', 'Executive Pastor', 'Leadership', 'holly-springs', false),
    ('hs-worship', 'Worship', 'Worship', 'holly-springs', false),
    ('hs-music-director', 'Music Director', 'Worship', 'holly-springs', false),
    ('hs-students', 'Students', 'Students', 'holly-springs', false),
    ('hs-students-intern', 'Intern', 'Students', 'holly-springs', false),
    ('hs-kids', 'Kids', 'Kids', 'holly-springs', false),
    ('hs-kids-intern', 'Intern', 'Kids', 'holly-springs', false),
    ('hs-production', 'Production', 'Production', 'holly-springs', false),
    ('hs-pastoral-care', 'Pastoral Care', 'Pastoral Care', 'holly-springs', false),
    ('hs-administrative', 'Administrative', 'Administrative', 'holly-springs', false),
    ('hs-facilities', 'Facilities', 'Facilities', 'holly-springs', false),
    ('hs-small-groups', 'Small Groups', 'Small Groups', 'holly-springs', false),
    ('uh-campus-pastor', 'Campus Pastor', 'Leadership', 'union-hill', true),
    ('uh-campus-coordinator', 'Campus Coordinator', 'Leadership', 'union-hill', false),
    ('uh-worship-director', 'Worship Director', 'Worship', 'union-hill', false),
    ('uh-kids-director', 'Kids Director', 'Kids', 'union-hill', false),
    ('uh-student-director', 'Student Director', 'Students', 'union-hill', false),
    ('uh-production-director', 'Production Director', 'Production', 'union-hill', false),
    ('uh-small-groups-director', 'Small Groups Director', 'Small Groups', 'union-hill', false),
    ('uh-next-steps-director', 'Next Steps Director', 'Next Steps', 'union-hill', false),
    ('uh-facilities-director', 'Facilities Director', 'Facilities', 'union-hill', false)
  ) as v (key, title, department, campus, campus_lead)
  join campuses c on c.key = v.campus
on conflict (key) do update set title = excluded.title, department = excluded.department,
  campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;

update positions p set reports_to_id = sup.id
  from (values
    ('hs-executive-pastor', 'hs-senior-pastor'),
    ('hs-worship', 'hs-executive-pastor'),
    ('hs-music-director', 'hs-worship'),
    ('hs-students', 'hs-executive-pastor'),
    ('hs-students-intern', 'hs-students'),
    ('hs-kids', 'hs-executive-pastor'),
    ('hs-kids-intern', 'hs-kids'),
    ('hs-production', 'hs-executive-pastor'),
    ('hs-pastoral-care', 'hs-executive-pastor'),
    ('hs-administrative', 'hs-executive-pastor'),
    ('hs-facilities', 'hs-executive-pastor'),
    ('hs-small-groups', 'hs-executive-pastor'),
    ('uh-campus-pastor', 'hs-executive-pastor'),
    ('uh-campus-coordinator', 'uh-campus-pastor'),
    ('uh-worship-director', 'hs-worship'),
    ('uh-kids-director', 'hs-kids'),
    ('uh-student-director', 'hs-students'),
    ('uh-production-director', 'hs-worship'),
    ('uh-small-groups-director', 'hs-small-groups'),
    ('uh-facilities-director', 'hs-executive-pastor')
  ) as v (child, parent)
  join positions sup on sup.key = v.parent
 where p.key = v.child;

insert into position_holders (position_id, person_id)
select pos.id, ppl.id
  from (values
    ('hs-senior-pastor', 'allan-malloy'),
    ('hs-executive-pastor', 'jb-kitts'),
    ('hs-worship', 'thomas-davis'),
    ('hs-music-director', 'roumar-bromfield'),
    ('hs-students', 'zach-woodall'),
    ('hs-students', 'sarah-woodall'),
    ('hs-students-intern', 'levi-porter'),
    ('hs-kids', 'vannessa-smith'),
    ('hs-kids-intern', 'anna'),
    ('hs-production', 'john-booth'),
    ('hs-production', 'josh-floyd'),
    ('hs-pastoral-care', 'brandon-ford'),
    ('hs-administrative', 'shelby-koerner'),
    ('hs-facilities', 'charlie-shultz'),
    ('hs-small-groups', 'kathy-malloy'),
    ('uh-campus-pastor', 'zach-woodall'),
    ('uh-production-director', 'john-booth'),
    ('uh-facilities-director', 'charlie-shultz')
  ) as v (position_key, person_key)
  join positions pos on pos.key = v.position_key
  join people    ppl on ppl.key = v.person_key
on conflict do nothing;

commit;
