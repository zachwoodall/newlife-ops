-- GENERATED FILE — do not edit by hand.
-- Source: seed/org.json · Regenerate: npm run seed:generate

begin;

-- campuses
insert into campuses (key, name, is_primary) values ('holly-springs', 'Holly Springs', true)
  on conflict (key) do update set name = excluded.name, is_primary = excluded.is_primary;
insert into campuses (key, name, is_primary) values ('union-hill', 'Union Hill', false)
  on conflict (key) do update set name = excluded.name, is_primary = excluded.is_primary;

-- people
insert into people (key, full_name, email) values ('allan-malloy', 'Dr. Allan Malloy', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('jb-kitts', 'JB Kitts', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('thomas-davis', 'Thomas Davis', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('roumar-bromfield', 'Roumar Bromfield', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('zach-woodall', 'Zach Woodall', 'zach@newlifecanton.com')
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('sarah-woodall', 'Sarah Woodall', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('levi-porter', 'Levi Porter', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('vannessa-smith', 'Vannessa Smith', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('anna', 'Anna', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('john-booth', 'John Booth', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('josh-floyd', 'Josh Floyd', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('brandon-ford', 'Brandon Ford', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('shelby-koerner', 'Shelby Koerner', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('charlie-shultz', 'Charlie Shultz', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;
insert into people (key, full_name, email) values ('kathy-malloy', 'Kathy Malloy', NULL)
  on conflict (key) do update set full_name = excluded.full_name, email = excluded.email;

-- positions (reporting lines set afterwards so order never matters)
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-senior-pastor', 'Senior Pastor', 'Leadership', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-executive-pastor', 'Executive Pastor', 'Leadership', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-worship', 'Worship', 'Worship', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-music-director', 'Music Director', 'Worship', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-students', 'Students', 'Students', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-students-intern', 'Intern', 'Students', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-kids', 'Kids', 'Kids', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-kids-intern', 'Intern', 'Kids', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-production', 'Production', 'Production', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-pastoral-care', 'Pastoral Care', 'Pastoral Care', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-administrative', 'Administrative', 'Administrative', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-facilities', 'Facilities', 'Facilities', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'hs-small-groups', 'Small Groups', 'Small Groups', c.id, false
    from campuses c where c.key = 'holly-springs'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'uh-campus-pastor', 'Campus Pastor', 'Leadership', c.id, true
    from campuses c where c.key = 'union-hill'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'uh-campus-coordinator', 'Campus Coordinator', 'Leadership', c.id, false
    from campuses c where c.key = 'union-hill'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'uh-worship-director', 'Worship Director', 'Worship', c.id, false
    from campuses c where c.key = 'union-hill'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'uh-kids-director', 'Kids Director', 'Kids', c.id, false
    from campuses c where c.key = 'union-hill'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'uh-student-director', 'Student Director', 'Students', c.id, false
    from campuses c where c.key = 'union-hill'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'uh-production-director', 'Production Director', 'Production', c.id, false
    from campuses c where c.key = 'union-hill'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'uh-small-groups-director', 'Small Groups Director', 'Small Groups', c.id, false
    from campuses c where c.key = 'union-hill'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'uh-next-steps-director', 'Next Steps Director', 'Next Steps', c.id, false
    from campuses c where c.key = 'union-hill'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;
insert into positions (key, title, department, campus_id, campus_lead)
  select 'uh-facilities-director', 'Facilities Director', 'Facilities', c.id, false
    from campuses c where c.key = 'union-hill'
  on conflict (key) do update set title = excluded.title, department = excluded.department, campus_id = excluded.campus_id, campus_lead = excluded.campus_lead;

-- reporting lines
update positions set reports_to_id = (select id from positions where key = 'hs-senior-pastor') where key = 'hs-executive-pastor';
update positions set reports_to_id = (select id from positions where key = 'hs-executive-pastor') where key = 'hs-worship';
update positions set reports_to_id = (select id from positions where key = 'hs-worship') where key = 'hs-music-director';
update positions set reports_to_id = (select id from positions where key = 'hs-executive-pastor') where key = 'hs-students';
update positions set reports_to_id = (select id from positions where key = 'hs-students') where key = 'hs-students-intern';
update positions set reports_to_id = (select id from positions where key = 'hs-executive-pastor') where key = 'hs-kids';
update positions set reports_to_id = (select id from positions where key = 'hs-kids') where key = 'hs-kids-intern';
update positions set reports_to_id = (select id from positions where key = 'hs-executive-pastor') where key = 'hs-production';
update positions set reports_to_id = (select id from positions where key = 'hs-executive-pastor') where key = 'hs-pastoral-care';
update positions set reports_to_id = (select id from positions where key = 'hs-executive-pastor') where key = 'hs-administrative';
update positions set reports_to_id = (select id from positions where key = 'hs-executive-pastor') where key = 'hs-facilities';
update positions set reports_to_id = (select id from positions where key = 'hs-executive-pastor') where key = 'hs-small-groups';
update positions set reports_to_id = (select id from positions where key = 'hs-executive-pastor') where key = 'uh-campus-pastor';
update positions set reports_to_id = (select id from positions where key = 'uh-campus-pastor') where key = 'uh-campus-coordinator';
update positions set reports_to_id = (select id from positions where key = 'hs-worship') where key = 'uh-worship-director';
update positions set reports_to_id = (select id from positions where key = 'hs-kids') where key = 'uh-kids-director';
update positions set reports_to_id = (select id from positions where key = 'hs-students') where key = 'uh-student-director';
update positions set reports_to_id = (select id from positions where key = 'hs-worship') where key = 'uh-production-director';
update positions set reports_to_id = (select id from positions where key = 'hs-small-groups') where key = 'uh-small-groups-director';
update positions set reports_to_id = (select id from positions where key = 'hs-executive-pastor') where key = 'uh-facilities-director';

-- who holds which position
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-senior-pastor' and ppl.key = 'allan-malloy'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-executive-pastor' and ppl.key = 'jb-kitts'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-worship' and ppl.key = 'thomas-davis'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-music-director' and ppl.key = 'roumar-bromfield'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-students' and ppl.key = 'zach-woodall'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-students' and ppl.key = 'sarah-woodall'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-students-intern' and ppl.key = 'levi-porter'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-kids' and ppl.key = 'vannessa-smith'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-kids-intern' and ppl.key = 'anna'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-production' and ppl.key = 'john-booth'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-production' and ppl.key = 'josh-floyd'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-pastoral-care' and ppl.key = 'brandon-ford'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-administrative' and ppl.key = 'shelby-koerner'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-facilities' and ppl.key = 'charlie-shultz'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'hs-small-groups' and ppl.key = 'kathy-malloy'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'uh-campus-pastor' and ppl.key = 'zach-woodall'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'uh-production-director' and ppl.key = 'john-booth'
  on conflict do nothing;
insert into position_holders (position_id, person_id)
  select pos.id, ppl.id from positions pos, people ppl
   where pos.key = 'uh-facilities-director' and ppl.key = 'charlie-shultz'
  on conflict do nothing;

commit;
