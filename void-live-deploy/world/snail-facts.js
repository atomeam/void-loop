// A garden snail (Cornu aspersum): what the 3D scene shows and the facts it states. Every fact carries its source, link and the exact words it rests on;
// tools/world-facts.mjs checks each one against the source page. Sizes are in centimetres.
export const manifest = {
  id: 'snail', title: 'A garden snail', sub: 'Drag to turn it, tap a part, tap the ground to drop food. Slow time, look inside, change the weather.',
  sky: { top: '#4f86c6', mid: '#a7c8e0', low: '#efe4c2' }, sun: [-0.55, 0.5, 0.62], sunColor: '#ffddb0', fog: 0.011, shadowBox: 13, view: { dist: 13, min: 2.5, max: 44 },
  parts: ['shell', 'foot', 'mantle', 'upper-tentacle', 'eye', 'lower-tentacle', 'mouth', 'radula', 'pneumostome', 'lung', 'heart', 'digestive-gland', 'brain', 'mucus'].map((id) => ({ id })),
  behaviors: ['crawl-waves', 'steer-and-seek-food', 'tentacle-retract', 'retreat-and-seal', 'feed-with-radula', 'breathing-hole', 'mucus-trail'].map((id) => ({ id })),
  plus: ['slow-time', 'see-inside', 'change-weather', 'look-up-through-glass', 'tap-to-feed', 'facts-with-sources'].map((id) => ({ id })),
  variables: [
    { id: 'temp', label: 'Air temperature', min: -2, max: 30, step: 1, value: 16, unit: '°C', why: 'A simple what-if model, not measured data: colder air slows it, and near freezing it seals its shell.' },
    { id: 'wet', label: 'Humidity', min: 5, max: 100, step: 5, value: 80, unit: '%', why: 'In dry air a snail seals its shell. Move this low to watch it pull in and close the opening.' },
  ],
  toggles: [
    { id: 'xray', label: 'See inside', say: 'The shell and skin turn glass-clear. The organs are placed where they sit in a real snail, simplified.' },
    { id: 'glass', label: 'Look up through glass', say: 'You are under a pane of glass. The ripples travel from tail to head and push it forward.' },
  ],
  facts: [
    { id: 'tentacles', text: 'It has four tentacles: the upper two are larger and carry eye-like light sensors; the lower two feel and smell.', source: 'Wikipedia, Cornu aspersum', url: 'https://en.wikipedia.org/wiki/Cornu_aspersum', quote: 'the upper two are larger and bear eye-like light sensors, and the lower two are tactile and olfactory sense organs' },
    { id: 'radula', text: 'Its tongue is a ribbon with thousands of tiny teeth, called a radula.', source: 'Wikipedia, Snail', url: 'https://en.wikipedia.org/wiki/Snail', quote: 'thousands of microscopic tooth-like structures located on a banded ribbon-like tongue called a radula' },
    { id: 'waves', text: 'It moves on a layer of mucus by waves of muscle contraction that pass forward along the foot.', source: 'Wikipedia, Cornu aspersum', url: 'https://en.wikipedia.org/wiki/Cornu_aspersum', quote: 'rhythmic waves of contraction passing forward within its muscular foot' },
    { id: 'speed', text: 'In snail races only about 2.4 millimetres a second has been reached. The popular figure of 1.3 centimetres a second is doubted.', source: 'Wikipedia, Cornu aspersum', url: 'https://en.wikipedia.org/wiki/Cornu_aspersum', quote: 'only speeds of 2.4 mm/s have been achieved' },
    { id: 'size', text: 'The adult shell is 25 to 40 millimetres across, with four or five whorls.', source: 'Wikipedia, Cornu aspersum', url: 'https://en.wikipedia.org/wiki/Cornu_aspersum', quote: '25–40 millimetres' },
    { id: 'dextral', text: 'Over 90% of snail species have right-handed (dextral) shells.', source: 'Wikipedia, Gastropod shell', url: 'https://en.wikipedia.org/wiki/Gastropod_shell', quote: 'over 90%) of gastropod species have dextral (right-handed) shells' },
    { id: 'chalk', text: 'The shell is mostly calcium carbonate laid down on a protein frame.', source: 'Wikipedia, Gastropod shell', url: 'https://en.wikipedia.org/wiki/Gastropod_shell', quote: 'calcium carbonate (CaCO3)' },
    { id: 'seal', text: 'In dry or cold weather it seals the shell opening with a thin skin of dried mucus, called an epiphragm.', source: 'Wikipedia, Cornu aspersum', url: 'https://en.wikipedia.org/wiki/Cornu_aspersum', quote: 'seals the aperture of the shell with a thin membrane of dried mucus' },
    { id: 'both', text: 'Each garden snail is both male and female (a hermaphrodite).', source: 'Wikipedia, Cornu aspersum', url: 'https://en.wikipedia.org/wiki/Cornu_aspersum', quote: 'individuals are hermaphrodites, producing both male and female gametes' },
    { id: 'lung', text: 'It breathes air through a lung instead of gills.', source: 'Wikipedia, Pulmonata', url: 'https://en.wikipedia.org/wiki/Pulmonata', quote: 'breathe air, by virtue of having a pallial lung' },
    { id: 'three', text: 'Snails share three body features with most molluscs: the foot, the mantle and the radula.', source: 'Wikipedia, Snail', url: 'https://en.wikipedia.org/wiki/Snail', quote: 'the foot, the mantle, and the radula' },
    { id: 'cold', text: 'In winter it can survive air as cold as minus 5 °C.', source: 'Wikipedia, Cornu aspersum', url: 'https://en.wikipedia.org/wiki/Cornu_aspersum', quote: 'survive temperatures as low as −5 °C' },
    { id: 'arches', text: 'On a dry surface it lifts its belly in arches, touching only one to two thirds of the ground it crosses, to save mucus.', source: 'Wikipedia, Cornu aspersum', url: 'https://en.wikipedia.org/wiki/Cornu_aspersum', quote: 'contacting only one to two thirds of the area it passes over' },
  ],
};
export const CARDS = {
  shell: ['The shell', 'A coiled, right-handed spiral of about four and a half whorls, 25 to 40 mm across. It is mostly calcium carbonate, grown by the mantle, and the snail pulls its whole body into it.', 'Wikipedia, Cornu aspersum and Gastropod shell'],
  foot: ['The foot', 'One broad muscle. Waves of contraction pass forward along it while a layer of mucus lets it grip and slide. Look up through the glass to see the ripples.', 'Wikipedia, Cornu aspersum'],
  mantle: ['The mantle', 'The skin collar that makes the shell and covers the lung. It is one of the three features snails share with most molluscs.', 'Wikipedia, Snail'],
  'upper-tentacle': ['Upper tentacle', 'The larger pair. Each tip has an eye-like light sensor. Touch one and it pulls in.', 'Wikipedia, Cornu aspersum'],
  eye: ['The eye', 'A light sensor on the tip of each upper tentacle. It tells light from dark and shapes, but it does not see sharp detail.', 'Wikipedia, Cornu aspersum'],
  'lower-tentacle': ['Lower tentacle', 'The smaller pair. They feel and smell. Drop a leaf and watch it turn toward the food.', 'Wikipedia, Cornu aspersum'],
  mouth: ['The mouth', 'It sits under the tentacles. A toothed ribbon inside scrapes and pulls in food.', 'Wikipedia, Cornu aspersum'],
  radula: ['The radula', 'A ribbon-like tongue covered in thousands of tiny teeth. It scrapes food as the ribbon rolls over a firm cushion. Teeth wear away at the front and grow new ones behind.', 'Wikipedia, Snail and Radula'],
  pneumostome: ['The breathing hole', 'A small opening in the mantle edge on the right side. It opens and closes to let air into the lung.', 'Wikipedia, Pulmonata'],
  lung: ['The lung', 'A garden snail breathes air through a lung made from the roof of its mantle cavity, not through gills.', 'Wikipedia, Pulmonata'],
  heart: ['The heart', 'A small heart pumps blood, which is pale and not red, through the body.', 'Wikipedia, Snail'],
  'digestive-gland': ['The digestive gland', 'The big dark organ that fills the upper coils of the shell. It makes digestive juices and takes in nutrients.', 'Wikipedia, Snail'],
  brain: ['The brain', 'A ring of nerve knots around the gullet, in the head behind the mouth. A snail has no single large brain.', 'Wikipedia, Snail'],
  mucus: ['The mucus trail', 'A thin, shiny layer the foot lays down. It is the track the snail slides on, and it helps it hold on at any angle.', 'Wikipedia, Cornu aspersum'],
};
