-- Cafeterías de EJEMPLO (ficticias) para que el mapa no se vea vacío.
-- Ejecútalo después de schema.sql. Para quitarlas más adelante:
--   delete from public.cafes where is_example = true;

insert into public.cafes (name, address, barrio, lat, lng, hours, tags, description, price, drinks, is_example) values
('Grano Norte (ejemplo)', 'Av. Revolución, cerca del arco', 'Centro', 32.5328, -117.0379,
 '{"lun":{"o":"08:00","c":"20:00"},"mar":{"o":"08:00","c":"20:00"},"mie":{"o":"08:00","c":"20:00"},"jue":{"o":"08:00","c":"20:00"},"vie":{"o":"08:00","c":"22:00"},"sab":{"o":"09:00","c":"22:00"},"dom":null}',
 '{"Café de especialidad","Postres","Wifi"}',
 'Cafetería de ejemplo para mostrar cómo se ve una ficha.', 3, E'Latte de vainilla · $85\nCold brew · $80', true),
('Taza del Río (ejemplo)', 'Zona Río, cerca de Paseo de los Héroes', 'Zona Río', 32.5268, -117.0201,
 '{"lun":{"o":"07:00","c":"19:00"},"mar":{"o":"07:00","c":"19:00"},"mie":{"o":"07:00","c":"19:00"},"jue":{"o":"07:00","c":"19:00"},"vie":{"o":"07:00","c":"19:00"},"sab":{"o":"08:00","c":"15:00"},"dom":{"o":"08:00","c":"15:00"}}',
 '{"Para trabajar","Wifi","Pet friendly"}',
 'Lugar de ejemplo pensado para trabajar con laptop.', 2, null, true),
('Terraza Cacho (ejemplo)', 'Colonia Cacho', 'Cacho', 32.5196, -117.0288,
 '{"lun":null,"mar":{"o":"10:00","c":"21:00"},"mie":{"o":"10:00","c":"21:00"},"jue":{"o":"10:00","c":"21:00"},"vie":{"o":"10:00","c":"23:30"},"sab":{"o":"10:00","c":"23:30"},"dom":{"o":"10:00","c":"18:00"}}',
 '{"Terraza","Vegano","Postres"}',
 'Terraza de ejemplo con opciones veganas.', 2, null, true),
('Brisa Playas (ejemplo)', 'Playas de Tijuana', 'Playas', 32.5262, -117.1176,
 '{"lun":{"o":"08:00","c":"18:00"},"mar":{"o":"08:00","c":"18:00"},"mie":{"o":"08:00","c":"18:00"},"jue":{"o":"08:00","c":"18:00"},"vie":{"o":"08:00","c":"20:00"},"sab":{"o":"08:00","c":"20:00"},"dom":{"o":"08:00","c":"20:00"}}',
 '{"Terraza","Pet friendly"}',
 'Cafetería de ejemplo cerca del mar.', 1, null, true);
