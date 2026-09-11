ALTER TABLE cosmetic_catalog
  DROP CONSTRAINT IF EXISTS cosmetic_catalog_type_check;

ALTER TABLE cosmetic_catalog
  ADD CONSTRAINT cosmetic_catalog_type_check
  CHECK (type IN ('draw_color', 'brush_size', 'name_font', 'nameplate_border'));

ALTER TABLE cosmetic_catalog
  ADD COLUMN IF NOT EXISTS value text;

UPDATE cosmetic_catalog SET enabled = false, value = item_id
WHERE item_id IN ('frame-sunrise', 'theme-paper', 'title-sketcher');

UPDATE cosmetic_catalog SET value = item_id WHERE value IS NULL;

ALTER TABLE cosmetic_catalog
  ALTER COLUMN value SET NOT NULL;

CREATE TABLE IF NOT EXISTS player_cosmetic_loadout (
  player_id uuid NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('draw_color', 'brush_size', 'name_color', 'name_font', 'nameplate_border')),
  item_id text NOT NULL REFERENCES cosmetic_catalog(item_id),
  equipped_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, slot),
  FOREIGN KEY (player_id, item_id) REFERENCES player_cosmetics(player_id, item_id) ON DELETE CASCADE
);

INSERT INTO cosmetic_catalog (item_id, type, name, price, value, enabled) VALUES
  ('color-red', 'draw_color', 'Rocket Red', 0, '#c62828', true),
  ('color-green', 'draw_color', 'Go Green', 0, '#2e7d32', true),
  ('color-blue', 'draw_color', 'Doodle Blue', 0, '#1a73ff', true),
  ('color-orange', 'draw_color', 'Juicy Orange', 12, '#f57c00', true),
  ('color-brown', 'draw_color', 'Cocoa Brown', 14, '#795548', true),
  ('color-purple', 'draw_color', 'Pop Purple', 16, '#6a1b9a', true),
  ('color-teal', 'draw_color', 'Splash Teal', 18, '#00838f', true),
  ('color-pink', 'draw_color', 'Bubblegum Pink', 20, '#ec407a', true),
  ('color-yellow', 'draw_color', 'Sunny Yellow', 20, '#fbc02d', true),
  ('color-black', 'draw_color', 'Ink Black', 22, '#111111', true),
  ('brush-medium', 'brush_size', 'Medium Brush', 0, '12', true),
  ('brush-very-small', 'brush_size', 'Very Small Brush', 10, '3', true),
  ('brush-small', 'brush_size', 'Small Brush', 12, '6', true),
  ('brush-large', 'brush_size', 'Large Brush', 18, '20', true),
  ('brush-extra-large', 'brush_size', 'Extra Large Brush', 24, '32', true),
  ('font-plain', 'name_font', 'Classic Name', 0, 'plain', true),
  ('font-bubble', 'name_font', 'Bubble Pop', 24, 'bubble', true),
  ('font-comic', 'name_font', 'Comic Bounce', 30, 'comic', true),
  ('font-marker', 'name_font', 'Sketch Marker', 36, 'marker', true),
  ('border-plain', 'nameplate_border', 'Plain Nameplate', 0, 'plain', true),
  ('border-sunshine', 'nameplate_border', 'Sunshine Frame', 20, 'sunshine', true),
  ('border-candy', 'nameplate_border', 'Candy Stripe', 28, 'candy', true),
  ('border-neon', 'nameplate_border', 'Electric Glow', 38, 'neon', true)
ON CONFLICT (item_id) DO UPDATE SET
  type = EXCLUDED.type,
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  value = EXCLUDED.value,
  enabled = EXCLUDED.enabled;

INSERT INTO player_cosmetics (player_id, item_id)
SELECT players.player_id, starter.item_id
FROM players
CROSS JOIN (VALUES ('color-red'), ('color-green'), ('color-blue'), ('brush-medium'), ('font-plain'), ('border-plain')) starter(item_id)
ON CONFLICT DO NOTHING;

INSERT INTO player_cosmetic_loadout (player_id, slot, item_id)
SELECT player_id, defaults.slot, defaults.item_id
FROM players
CROSS JOIN (VALUES
  ('draw_color', 'color-blue'),
  ('brush_size', 'brush-medium'),
  ('name_font', 'font-plain'),
  ('nameplate_border', 'border-plain')
) defaults(slot, item_id)
ON CONFLICT (player_id, slot) DO NOTHING;
