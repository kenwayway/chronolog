-- Exercises was retired from the Workout content type. Remove historical
-- values from both canonical entity tables.
UPDATE notes
SET
  field_values = CASE
    WHEN json_remove(field_values, '$.exercises') = '{}' THEN NULL
    ELSE json_remove(field_values, '$.exercises')
  END,
  updated_at = unixepoch() * 1000
WHERE content_type = 'workout'
  AND json_valid(field_values)
  AND json_type(field_values, '$.exercises') IS NOT NULL;

UPDATE sessions
SET
  field_values = CASE
    WHEN json_remove(field_values, '$.exercises') = '{}' THEN NULL
    ELSE json_remove(field_values, '$.exercises')
  END,
  updated_at = unixepoch() * 1000
WHERE content_type = 'workout'
  AND json_valid(field_values)
  AND json_type(field_values, '$.exercises') IS NOT NULL;

-- Some databases contain synced copies of built-in definitions.
UPDATE content_types
SET fields = '[{"id":"workoutType","name":"Type","type":"dropdown","options":["Strength","Cardio","Flexibility","Mixed"],"default":"Strength"},{"id":"place","name":"Place","type":"dropdown","options":["Home","In Building Gym","Outside Gym"]}]'
WHERE id = 'workout';
