/**
 * calc-units: the units and the formula language behind /calculators/ (the tower's vcalc.com floor). Every unit is its factor to SI (and an
 * offset for the temperature scales: kelvin = (value + offset) x factor), grouped by kind, and every kind carries its dimension over the seven
 * SI base quantities plus money: [length, mass, time, current, temperature, amount, luminosity, money]. The formula language is a small parser
 * (no eval): numbers, + - * / ^, brackets, functions, constants with their units, and variables bound to quantities. It carries the dimension
 * through every step, so a formula that adds a length to a time says so, and a result is checked against the unit asked for. Pure.
 * Tests: tools/calculators.test.mjs.
 */

// dimension order: L M T I Θ N J $
const D = (L = 0, M = 0, T = 0, I = 0, K = 0, N = 0, J = 0, $ = 0) => [L, M, T, I, K, N, J, $];
const u = (id, name, f, extra = {}) => ({ id, name, f, o: 0, ...extra });
const PI = Math.PI;

/** kind -> { name, dim, units: [{ id, name, f, o }] }; each unit's factor takes a value in it to SI */
export const KINDS = Object.freeze({
  number: { name: 'Number', dim: D(), units: [u('', 'plain number', 1)] },
  ratio: { name: 'Ratio', dim: D(), units: [u('%', 'percent', 0.01), u('×', 'fraction (0.25 = 25%)', 1), u('‰', 'per mille', 0.001), u('ppm', 'parts per million', 1e-6)] },
  money: { name: 'Money', dim: D(0, 0, 0, 0, 0, 0, 0, 1), units: [u('$', 'money (any currency)', 1)] },
  length: { name: 'Length', dim: D(1), units: [u('m', 'metres', 1), u('km', 'kilometres', 1000), u('cm', 'centimetres', 0.01), u('mm', 'millimetres', 0.001), u('µm', 'micrometres', 1e-6), u('nm', 'nanometres', 1e-9),
    u('in', 'inches', 0.0254), u('ft', 'feet', 0.3048), u('yd', 'yards', 0.9144), u('mi', 'miles', 1609.344), u('nmi', 'nautical miles', 1852), u('au', 'astronomical units', 149597870700), u('ly', 'light years', 9460730472580800), u('pc', 'parsecs', 3.0856775814913673e16)] },
  area: { name: 'Area', dim: D(2), units: [u('m²', 'square metres', 1), u('km²', 'square kilometres', 1e6), u('cm²', 'square centimetres', 1e-4), u('mm²', 'square millimetres', 1e-6), u('ha', 'hectares', 1e4),
    u('in²', 'square inches', 0.00064516), u('ft²', 'square feet', 0.09290304), u('yd²', 'square yards', 0.83612736), u('acre', 'acres', 4046.8564224), u('mi²', 'square miles', 2589988.110336)] },
  volume: { name: 'Volume', dim: D(3), units: [u('m³', 'cubic metres', 1), u('L', 'litres', 0.001), u('mL', 'millilitres', 1e-6), u('cm³', 'cubic centimetres', 1e-6), u('in³', 'cubic inches', 1.6387064e-5),
    u('ft³', 'cubic feet', 0.028316846592), u('yd³', 'cubic yards', 0.764554857984), u('gal', 'US gallons', 0.003785411784), u('qt', 'US quarts', 0.000946352946), u('cup', 'US cups', 0.0002365882365),
    u('fl oz', 'US fluid ounces', 2.95735295625e-5), u('tbsp', 'tablespoons (US)', 1.478676478125e-5), u('tsp', 'teaspoons (US)', 4.92892159375e-6), u('imp gal', 'imperial gallons', 0.00454609), u('bbl', 'oil barrels', 0.158987294928)] },
  mass: { name: 'Mass', dim: D(0, 1), units: [u('kg', 'kilograms', 1), u('g', 'grams', 0.001), u('mg', 'milligrams', 1e-6), u('µg', 'micrograms', 1e-9), u('t', 'tonnes', 1000), u('lb', 'pounds', 0.45359237),
    u('oz', 'ounces', 0.028349523125), u('st', 'stone', 6.35029318), u('ton', 'US tons', 907.18474), u('gr', 'grains', 6.479891e-5), u('Da', 'daltons', 1.66053906660e-27)] },
  time: { name: 'Time', dim: D(0, 0, 1), units: [u('s', 'seconds', 1), u('ms', 'milliseconds', 0.001), u('µs', 'microseconds', 1e-6), u('ns', 'nanoseconds', 1e-9), u('min', 'minutes', 60), u('h', 'hours', 3600), u('day', 'days', 86400),
    u('week', 'weeks', 604800), u('month', 'months (1/12 year)', 2629800), u('yr', 'years (365.25 days)', 31557600)] },
  speed: { name: 'Speed', dim: D(1, 0, -1), units: [u('m/s', 'metres a second', 1), u('km/h', 'kilometres an hour', 1 / 3.6), u('km/s', 'kilometres a second', 1000), u('mph', 'miles an hour', 0.44704), u('ft/s', 'feet a second', 0.3048), u('kn', 'knots', 1852 / 3600), u('c', 'speed of light', 299792458)] },
  acceleration: { name: 'Acceleration', dim: D(1, 0, -2), units: [u('m/s²', 'metres a second squared', 1), u('ft/s²', 'feet a second squared', 0.3048), u('g₀', 'standard gravity', 9.80665), u('Gal', 'gals (cm/s²)', 0.01)] },
  force: { name: 'Force', dim: D(1, 1, -2), units: [u('N', 'newtons', 1), u('kN', 'kilonewtons', 1000), u('MN', 'meganewtons', 1e6), u('lbf', 'pounds-force', 4.4482216152605), u('kgf', 'kilograms-force', 9.80665), u('dyn', 'dynes', 1e-5)] },
  pressure: { name: 'Pressure or stress', dim: D(-1, 1, -2), units: [u('Pa', 'pascals', 1), u('kPa', 'kilopascals', 1000), u('MPa', 'megapascals', 1e6), u('GPa', 'gigapascals', 1e9), u('bar', 'bar', 1e5), u('mbar', 'millibar', 100),
    u('atm', 'atmospheres', 101325), u('psi', 'pounds per square inch', 6894.757293168361), u('ksi', 'kips per square inch', 6894757.293168361), u('mmHg', 'millimetres of mercury', 133.322387415), u('inHg', 'inches of mercury', 3386.389), u('Torr', 'torr', 101325 / 760)] },
  energy: { name: 'Energy', dim: D(2, 1, -2), units: [u('J', 'joules', 1), u('mJ', 'millijoules', 0.001), u('kJ', 'kilojoules', 1000), u('MJ', 'megajoules', 1e6), u('Wh', 'watt-hours', 3600), u('kWh', 'kilowatt-hours', 3.6e6), u('cal', 'calories', 4.184),
    u('kcal', 'kilocalories', 4184), u('BTU', 'British thermal units', 1055.05585262), u('eV', 'electronvolts', 1.602176634e-19), u('ft·lbf', 'foot-pounds', 1.3558179483314004), u('erg', 'ergs', 1e-7)] },
  power: { name: 'Power', dim: D(2, 1, -3), units: [u('W', 'watts', 1), u('mW', 'milliwatts', 0.001), u('kW', 'kilowatts', 1000), u('MW', 'megawatts', 1e6), u('hp', 'horsepower (mechanical)', 745.6998715822702), u('PS', 'metric horsepower', 735.49875), u('BTU/h', 'BTU an hour', 0.29307107017222)] },
  momentum: { name: 'Momentum', dim: D(1, 1, -1), units: [u('kg·m/s', 'kilogram-metres a second', 1), u('N·s', 'newton-seconds', 1), u('lb·ft/s', 'pound-feet a second', 0.138254954376)] },
  expansion: { name: 'Expansion coefficient', dim: D(0, 0, 0, 0, -1), units: [u('/K', 'per kelvin', 1), u('/°C', 'per degree Celsius', 1), u('/°F', 'per degree Fahrenheit', 1.8)] },
  torque: { name: 'Torque', dim: D(2, 1, -2), units: [u('N·m', 'newton-metres', 1), u('kN·m', 'kilonewton-metres', 1000), u('lbf·ft', 'pound-feet', 1.3558179483314004), u('lbf·in', 'pound-inches', 0.1129848290276167)] },
  density: { name: 'Density', dim: D(-3, 1), units: [u('kg/m³', 'kilograms per cubic metre', 1), u('g/cm³', 'grams per cubic centimetre', 1000), u('g/mL', 'grams per millilitre', 1000), u('kg/L', 'kilograms per litre', 1000), u('lb/ft³', 'pounds per cubic foot', 16.018463373960138), u('lb/in³', 'pounds per cubic inch', 27679.904710203125), u('lb/gal', 'pounds per US gallon', 119.82642731689663)] },
  temperature: { name: 'Temperature', dim: D(0, 0, 0, 0, 1), units: [u('K', 'kelvin', 1), u('°C', 'degrees Celsius', 1, { o: 273.15 }), u('°F', 'degrees Fahrenheit', 5 / 9, { o: 459.67 }), u('°R', 'degrees Rankine', 5 / 9)] },
  tempdiff: { name: 'Temperature change', dim: D(0, 0, 0, 0, 1), units: [u('K', 'kelvin', 1), u('°C', 'degrees Celsius (change)', 1), u('°F', 'degrees Fahrenheit (change)', 5 / 9)] },
  current: { name: 'Current', dim: D(0, 0, 0, 1), units: [u('A', 'amperes', 1), u('mA', 'milliamperes', 0.001), u('µA', 'microamperes', 1e-6), u('kA', 'kiloamperes', 1000)] },
  voltage: { name: 'Voltage', dim: D(2, 1, -3, -1), units: [u('V', 'volts', 1), u('mV', 'millivolts', 0.001), u('µV', 'microvolts', 1e-6), u('kV', 'kilovolts', 1000)] },
  resistance: { name: 'Resistance', dim: D(2, 1, -3, -2), units: [u('Ω', 'ohms', 1), u('mΩ', 'milliohms', 0.001), u('kΩ', 'kilohms', 1000), u('MΩ', 'megohms', 1e6)] },
  charge: { name: 'Charge', dim: D(0, 0, 1, 1), units: [u('C', 'coulombs', 1), u('mC', 'millicoulombs', 0.001), u('µC', 'microcoulombs', 1e-6), u('nC', 'nanocoulombs', 1e-9), u('mAh', 'milliampere-hours', 3.6), u('Ah', 'ampere-hours', 3600)] },
  capacitance: { name: 'Capacitance', dim: D(-2, -1, 4, 2), units: [u('F', 'farads', 1), u('mF', 'millifarads', 0.001), u('µF', 'microfarads', 1e-6), u('nF', 'nanofarads', 1e-9), u('pF', 'picofarads', 1e-12)] },
  inductance: { name: 'Inductance', dim: D(2, 1, -2, -2), units: [u('H', 'henries', 1), u('mH', 'millihenries', 0.001), u('µH', 'microhenries', 1e-6), u('nH', 'nanohenries', 1e-9)] },
  frequency: { name: 'Frequency', dim: D(0, 0, -1), units: [u('Hz', 'hertz', 1), u('kHz', 'kilohertz', 1000), u('MHz', 'megahertz', 1e6), u('GHz', 'gigahertz', 1e9), u('THz', 'terahertz', 1e12), u('rpm', 'revolutions a minute', 1 / 60), u('/min', 'per minute', 1 / 60), u('/h', 'per hour', 1 / 3600), u('/day', 'per day', 1 / 86400), u('/yr', 'per year (365.25 days)', 1 / 31557600)] },
  angle: { name: 'Angle', dim: D(), units: [u('°', 'degrees', PI / 180), u('rad', 'radians', 1), u('grad', 'gradians', PI / 200), u('turn', 'turns', 2 * PI), u('′', 'arcminutes', PI / 10800)] },
  angvel: { name: 'Angular speed', dim: D(0, 0, -1), units: [u('rad/s', 'radians a second', 1), u('rpm', 'revolutions a minute', (2 * PI) / 60), u('°/s', 'degrees a second', PI / 180)] },
  amount: { name: 'Amount of substance', dim: D(0, 0, 0, 0, 0, 1), units: [u('mol', 'moles', 1), u('mmol', 'millimoles', 0.001), u('µmol', 'micromoles', 1e-6), u('kmol', 'kilomoles', 1000)] },
  molarmass: { name: 'Molar mass', dim: D(0, 1, 0, 0, 0, -1), units: [u('g/mol', 'grams per mole', 0.001), u('kg/mol', 'kilograms per mole', 1)] },
  concentration: { name: 'Concentration', dim: D(-3, 0, 0, 0, 0, 1), units: [u('M', 'moles per litre (molar)', 1000), u('mM', 'millimolar', 1), u('µM', 'micromolar', 0.001), u('mol/m³', 'moles per cubic metre', 1)] },
  flow: { name: 'Flow rate', dim: D(3, 0, -1), units: [u('m³/s', 'cubic metres a second', 1), u('m³/h', 'cubic metres an hour', 1 / 3600), u('L/s', 'litres a second', 0.001), u('L/min', 'litres a minute', 0.001 / 60), u('gpm', 'US gallons a minute', 0.003785411784 / 60), u('ft³/s', 'cubic feet a second', 0.028316846592), u('cfm', 'cubic feet a minute', 0.028316846592 / 60)] },
  viscosity: { name: 'Dynamic viscosity', dim: D(-1, 1, -1), units: [u('Pa·s', 'pascal-seconds', 1), u('mPa·s', 'millipascal-seconds', 0.001), u('cP', 'centipoise', 0.001), u('P', 'poise', 0.1)] },
  specificheat: { name: 'Specific heat', dim: D(2, 0, -2, 0, -1), units: [u('J/(kg·K)', 'joules per kilogram kelvin', 1), u('J/(g·K)', 'joules per gram kelvin', 1000), u('kJ/(kg·K)', 'kilojoules per kilogram kelvin', 1000), u('BTU/(lb·°F)', 'BTU per pound °F', 4186.8)] },
  conductivity: { name: 'Thermal conductivity', dim: D(1, 1, -3, 0, -1), units: [u('W/(m·K)', 'watts per metre kelvin', 1), u('BTU/(h·ft·°F)', 'BTU per hour foot °F', 1.730734666371)] },
  resistivity: { name: 'Resistivity', dim: D(3, 1, -3, -2), units: [u('Ω·m', 'ohm-metres', 1), u('Ω·mm²/m', 'ohm square millimetres per metre', 1e-6), u('µΩ·cm', 'microhm-centimetres', 1e-8)] },
  areadensity: { name: 'Mass per area', dim: D(-2, 1), units: [u('kg/m²', 'kilograms per square metre', 1), u('g/cm²', 'grams per square centimetre', 10), u('lb/in²', 'pounds per square inch (mass)', 703.0695796391), u('lb/ft²', 'pounds per square foot (mass)', 4.882427636383)] },
  stiffness: { name: 'Spring stiffness', dim: D(0, 1, -2), units: [u('N/m', 'newtons per metre', 1), u('N/mm', 'newtons per millimetre', 1000), u('kN/m', 'kilonewtons per metre', 1000), u('lbf/in', 'pounds-force per inch', 175.12683524647636)] },
  inertia: { name: 'Moment of inertia (area)', dim: D(4), units: [u('m⁴', 'metres to the fourth', 1), u('cm⁴', 'centimetres to the fourth', 1e-8), u('mm⁴', 'millimetres to the fourth', 1e-12), u('in⁴', 'inches to the fourth', 4.162314256e-7)] },
  pricemass: { name: 'Price per mass', dim: D(0, -1, 0, 0, 0, 0, 0, 1), units: [u('$/kg', 'per kilogram', 1), u('$/lb', 'per pound', 1 / 0.45359237), u('$/g', 'per gram', 1000), u('$/oz', 'per ounce', 1 / 0.028349523125)] },
  pricevolume: { name: 'Price per volume', dim: D(-3, 0, 0, 0, 0, 0, 0, 1), units: [u('$/L', 'per litre', 1000), u('$/gal', 'per US gallon', 1 / 0.003785411784), u('$/m³', 'per cubic metre', 1)] },
  priceenergy: { name: 'Price per energy', dim: D(-2, -1, 2, 0, 0, 0, 0, 1), units: [u('$/kWh', 'per kilowatt-hour', 1 / 3.6e6), u('$/MJ', 'per megajoule', 1e-6), u('$/J', 'per joule', 1)] },
  pricelength: { name: 'Price per length', dim: D(-1, 0, 0, 0, 0, 0, 0, 1), units: [u('$/km', 'per kilometre', 0.001), u('$/mi', 'per mile', 1 / 1609.344), u('$/m', 'per metre', 1), u('$/ft', 'per foot', 1 / 0.3048)] },
  fuel: { name: 'Fuel economy', dim: D(-2), units: [u('km/L', 'kilometres per litre', 1e6), u('mpg', 'miles per US gallon', 1609.344 / 0.003785411784), u('mpg (UK)', 'miles per imperial gallon', 1609.344 / 0.00454609), u('m/m³', 'metres per cubic metre', 1)] },
  // kinds the formula library's domains need (2026-10-28): light and heat flow, fluids, radiation, magnetism, rates of pay and cost per area
  intensity: { name: 'Intensity or heat flux', dim: D(0, 1, -3), units: [u('W/m²', 'watts per square metre', 1), u('kW/m²', 'kilowatts per square metre', 1000), u('mW/cm²', 'milliwatts per square centimetre', 10), u('BTU/(h·ft²)', 'BTU an hour per square foot', 3.154590745)] },
  heattransfer: { name: 'Heat transfer coefficient', dim: D(0, 1, -3, 0, -1), units: [u('W/(m²·K)', 'watts per square metre kelvin', 1), u('BTU/(h·ft²·°F)', 'BTU an hour per square foot °F', 5.678263341)] },
  rvalue: { name: 'Thermal resistance (R-value)', dim: D(0, -1, 3, 0, 1), units: [u('m²·K/W', 'square metre kelvin per watt (RSI)', 1), u('ft²·°F·h/BTU', 'US R-value', 0.1761101838)] },
  kinvisc: { name: 'Kinematic viscosity', dim: D(2, 0, -1), units: [u('m²/s', 'square metres a second', 1), u('mm²/s', 'square millimetres a second', 1e-6), u('cSt', 'centistokes', 1e-6), u('ft²/s', 'square feet a second', 0.09290304)] },
  specenergy: { name: 'Energy per mass', dim: D(2, 0, -2), units: [u('J/kg', 'joules per kilogram', 1), u('kJ/kg', 'kilojoules per kilogram', 1000), u('MJ/kg', 'megajoules per kilogram', 1e6), u('BTU/lb', 'BTU per pound', 2326), u('kcal/kg', 'kilocalories per kilogram', 4184)] },
  dose: { name: 'Radiation dose', dim: D(2, 0, -2), units: [u('Gy', 'grays', 1), u('mGy', 'milligrays', 0.001), u('Sv', 'sieverts', 1), u('mSv', 'millisieverts', 0.001), u('µSv', 'microsieverts', 1e-6), u('rad', 'rads (dose)', 0.01), u('rem', 'rems', 0.01)] },
  molarenergy: { name: 'Energy per mole', dim: D(2, 1, -2, 0, 0, -1), units: [u('J/mol', 'joules per mole', 1), u('kJ/mol', 'kilojoules per mole', 1000), u('kcal/mol', 'kilocalories per mole', 4184)] },
  entropy: { name: 'Entropy or heat capacity', dim: D(2, 1, -2, 0, -1), units: [u('J/K', 'joules per kelvin', 1), u('kJ/K', 'kilojoules per kelvin', 1000)] },
  magfield: { name: 'Magnetic flux density', dim: D(0, 1, -2, -1), units: [u('T', 'teslas', 1), u('mT', 'milliteslas', 0.001), u('µT', 'microteslas', 1e-6), u('nT', 'nanoteslas', 1e-9), u('Gs', 'gauss', 1e-4)] },
  magflux: { name: 'Magnetic flux', dim: D(2, 1, -2, -1), units: [u('Wb', 'webers', 1), u('mWb', 'milliwebers', 0.001), u('Mx', 'maxwells', 1e-8)] },
  efield: { name: 'Electric field', dim: D(1, 1, -3, -1), units: [u('V/m', 'volts per metre', 1), u('kV/m', 'kilovolts per metre', 1000), u('V/cm', 'volts per centimetre', 100)] },
  conductance: { name: 'Conductance', dim: D(-2, -1, 3, 2), units: [u('S', 'siemens', 1), u('mS', 'millisiemens', 0.001), u('µS', 'microsiemens', 1e-6)] },
  activity: { name: 'Radioactivity', dim: D(0, 0, -1), units: [u('Bq', 'becquerels', 1), u('kBq', 'kilobecquerels', 1000), u('MBq', 'megabecquerels', 1e6), u('GBq', 'gigabecquerels', 1e9), u('Ci', 'curies', 3.7e10), u('mCi', 'millicuries', 3.7e7), u('µCi', 'microcuries', 3.7e4)] },
  wavenumber: { name: 'Per length (wavenumber, lens power)', dim: D(-1), units: [u('/m', 'per metre (dioptres for a lens)', 1), u('/cm', 'per centimetre', 100), u('/mm', 'per millimetre', 1000), u('dpt', 'dioptres', 1)] },
  massflow: { name: 'Mass flow rate', dim: D(0, 1, -1), units: [u('kg/s', 'kilograms a second', 1), u('g/s', 'grams a second', 0.001), u('kg/h', 'kilograms an hour', 1 / 3600), u('lb/s', 'pounds a second', 0.45359237), u('lb/h', 'pounds an hour', 0.45359237 / 3600)] },
  angaccel: { name: 'Angular acceleration', dim: D(0, 0, -2), units: [u('rad/s²', 'radians a second squared', 1), u('°/s²', 'degrees a second squared', PI / 180)] },
  surfacetension: { name: 'Surface tension', dim: D(0, 1, -2), units: [u('N/m', 'newtons per metre', 1), u('mN/m', 'millinewtons per metre', 0.001), u('dyn/cm', 'dynes per centimetre', 0.001)] },
  molality: { name: 'Molality', dim: D(0, -1, 0, 0, 0, 1), units: [u('mol/kg', 'moles per kilogram (molal)', 1), u('mmol/kg', 'millimoles per kilogram', 0.001)] },
  illuminance: { name: 'Illuminance', dim: D(-2, 0, 0, 0, 0, 0, 1), units: [u('lx', 'lux', 1), u('fc', 'foot-candles', 10.76391041671)] },
  luminous: { name: 'Luminous flux or intensity', dim: D(0, 0, 0, 0, 0, 0, 1), units: [u('lm', 'lumens (or candela-steradians)', 1), u('cd', 'candelas (per steradian)', 1)] },
  pricearea: { name: 'Price per area', dim: D(-2, 0, 0, 0, 0, 0, 0, 1), units: [u('$/ft²', 'per square foot', 1 / 0.09290304), u('$/m²', 'per square metre', 1), u('$/yd²', 'per square yard', 1 / 0.83612736)] },
  pricetime: { name: 'Pay or cost per time', dim: D(0, 0, -1, 0, 0, 0, 0, 1), units: [u('$/h', 'an hour', 1 / 3600), u('$/day', 'a day', 1 / 86400), u('$/week', 'a week', 1 / 604800), u('$/month', 'a month (1/12 year)', 12 / 31557600), u('$/yr', 'a year (365.25 days)', 1 / 31557600), u('$/s', 'a second', 1)] },
});

const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
/** a unit written as people type it, made comparable: ft^2, ft2, sq ft and ft² are one; N*m and N.m are N·m; u is µ. Pure. */
export function unitKey(s) {
  let t = String(s ?? '').trim().replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (c) => SUP[c]).replace(/\^/g, '').replace(/\s*[*·.]\s*(?=[A-Za-zΩµ°$])/g, '·').replace(/μ/g, 'µ');
  t = t.replace(/^sq\.?\s*(\w+)$/i, '$12').replace(/^cu\.?\s*(\w+)$/i, '$13').replace(/^deg\s*([CFR])$/i, '°$1').replace(/^degrees?$/i, '°').replace(/^deg$/i, '°');
  t = t.replace(/^u(?=[mgsAVFHLC])/, 'µ').replace(/^ohms?$/i, 'Ω').replace(/(k|M|m)ohms?$/i, '$1Ω');
  return t;
}
const BY = new Map(), BYCI = new Map();
for (const [kind, k] of Object.entries(KINDS)) for (const x of k.units) {
  const key = unitKey(x.id); if (!BY.has(key)) BY.set(key, { kind, unit: x });
  const ci = key.toLowerCase(); BYCI.set(ci, BYCI.has(ci) ? null : { kind, unit: x });
}
/** a unit by what was typed: { kind, unit } or null; the exact symbol first (mm and Mm differ), then a unique case-blind match. Pure. */
export function findUnit(text, kind = null) {
  const key = unitKey(text); if (!key && kind) return { kind, unit: KINDS[kind].units[0] };
  if (kind && KINDS[kind]) { const x = KINDS[kind].units.find((y) => unitKey(y.id) === key) || KINDS[kind].units.find((y) => unitKey(y.id).toLowerCase() === key.toLowerCase()); return x ? { kind, unit: x } : null; }
  return BY.get(key) || BYCI.get(key.toLowerCase()) || null;
}
export const unitOf = (kind, id) => (KINDS[kind] ? KINDS[kind].units.find((x) => x.id === id) || null : null);
/** a value in a unit to SI, and back. Pure. */
export const toSI = (v, unit) => (Number(v) + (unit.o || 0)) * unit.f;
export const fromSI = (v, unit) => Number(v) / unit.f - (unit.o || 0);

// --- dimensions
const NAMES = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd', '$'];
export const sameDim = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
export const isPlain = (d) => d.every((x) => Math.abs(x) < 1e-9);
const SUPW = (n) => String(n).replace(/[-0-9]/g, (c) => ({ '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' })[c]);
/** a dimension as an SI unit: [2,1,-2] -> kg·m²·s⁻², none -> '' (a plain number). Pure. */
export function dimText(d) {
  const order = [1, 0, 2, 3, 4, 5, 6, 7], parts = [];
  for (const i of order) { const p = Math.round(d[i] * 1000) / 1000; if (!p) continue; parts.push(NAMES[i] + (p === 1 ? '' : Number.isInteger(p) ? SUPW(p) : '^' + p)); }
  return parts.join('·');
}
/** the kinds whose dimension is d, named: ['Energy', 'Torque'] for kg·m²·s⁻². Pure. */
export const kindsOfDim = (d) => Object.entries(KINDS).filter(([, k]) => sameDim(k.dim, d)).map(([id]) => id);

// --- the formula language
export const CONSTANTS = Object.freeze({
  pi: { v: PI, d: D(), name: 'π' }, 'π': { v: PI, d: D(), name: 'π' }, e: { v: Math.E, d: D(), name: "Euler's number" },
  g: { v: 9.80665, d: D(1, 0, -2), name: 'standard gravity, 9.80665 m/s²' }, c: { v: 299792458, d: D(1, 0, -1), name: 'speed of light, 299,792,458 m/s' },
  G: { v: 6.6743e-11, d: D(3, -1, -2), name: 'gravitational constant, 6.6743e-11 m³/(kg·s²)' }, h: { v: 6.62607015e-34, d: D(2, 1, -1), name: 'Planck constant, 6.62607015e-34 J·s' },
  kB: { v: 1.380649e-23, d: D(2, 1, -2, 0, -1), name: 'Boltzmann constant, 1.380649e-23 J/K' }, NA: { v: 6.02214076e23, d: D(0, 0, 0, 0, 0, -1), name: 'Avogadro constant, 6.02214076e23 /mol' },
  R: { v: 8.314462618, d: D(2, 1, -2, 0, -1, -1), name: 'gas constant, 8.314462618 J/(mol·K)' }, qe: { v: 1.602176634e-19, d: D(0, 0, 1, 1), name: 'elementary charge, 1.602176634e-19 C' },
  eps0: { v: 8.8541878128e-12, d: D(-3, -1, 4, 2), name: 'vacuum permittivity, 8.8541878128e-12 F/m' }, mu0: { v: 1.25663706212e-6, d: D(1, 1, -2, -2), name: 'vacuum permeability, 1.25663706212e-6 N/A²' },
  sigma: { v: 5.670374419e-8, d: D(0, 1, -3, 0, -4), name: 'Stefan-Boltzmann constant, 5.670374419e-8 W/(m²·K⁴)' },
});
const F1 = (fn, need = 'plain') => ({ n: 1, fn, need });
export const FUNCTIONS = Object.freeze({
  sqrt: { n: 1, fn: Math.sqrt, pow: 0.5 }, cbrt: { n: 1, fn: Math.cbrt, pow: 1 / 3 }, abs: { n: 1, fn: Math.abs, keep: true }, floor: { n: 1, fn: Math.floor, keep: true }, ceil: { n: 1, fn: Math.ceil, keep: true }, round: { n: 1, fn: Math.round, keep: true },
  ln: F1(Math.log), log: F1(Math.log10), log10: F1(Math.log10), log2: F1(Math.log2), exp: F1(Math.exp),
  sin: F1(Math.sin), cos: F1(Math.cos), tan: F1(Math.tan), asin: F1(Math.asin), acos: F1(Math.acos), atan: F1(Math.atan), sinh: F1(Math.sinh), cosh: F1(Math.cosh), tanh: F1(Math.tanh),
  sind: F1((x) => Math.sin((x * PI) / 180)), cosd: F1((x) => Math.cos((x * PI) / 180)), tand: F1((x) => Math.tan((x * PI) / 180)),
  min: { n: -1, fn: Math.min, same: true }, max: { n: -1, fn: Math.max, same: true }, hypot: { n: -1, fn: Math.hypot, same: true },
  atan2: { n: 2, fn: Math.atan2, same: true, plainOut: true }, pow: { n: 2, fn: null },
});

/** the formula's tokens: numbers, names, operators and brackets; throws on a character it cannot read. Pure. */
export function tokenize(src) {
  const s = String(src ?? '').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/\*\*/g, '^'), out = [];
  for (let i = 0; i < s.length;) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    const num = /^(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(s.slice(i));
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^[A-Za-z_πµ\u0370-\u03ff][\w\u0370-\u03ffµ]*/.exec(s.slice(i));
    if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
    if ('+-*/^(),'.includes(ch)) { out.push({ t: ch }); i++; continue; }
    throw new Error('cannot read "' + ch + '" at position ' + (i + 1));
  }
  return out;
}
/** the formula as a tree: { op, a, b } | { num } | { id } | { fn, args } | { neg }; implicit times between a number and a name or bracket (2pi, 3(x+1)). Pure. */
export function parse(src) {
  const tk = tokenize(src); let i = 0;
  const peek = () => tk[i], take = (t) => { if (tk[i] && tk[i].t === t) return tk[i++]; return null; };
  const need = (t) => { if (!take(t)) throw new Error('expected "' + t + '"' + (tk[i] ? ' before "' + (tk[i].v ?? tk[i].t) + '"' : ' at the end')); };
  function expr() { let a = term(); for (;;) { if (take('+')) a = { op: '+', a, b: term() }; else if (take('-')) a = { op: '-', a, b: term() }; else return a; } }
  function term() {
    let a = unary();
    for (;;) {
      if (take('*')) a = { op: '*', a, b: unary() }; else if (take('/')) a = { op: '/', a, b: unary() };
      else if (peek() && (peek().t === 'id' || peek().t === '(' || peek().t === 'num') && a) a = { op: '*', a, b: unary() }; // 2pi, 2(x), (a)(b), x y
      else return a;
    }
  }
  function unary() { if (take('-')) return { neg: unary() }; if (take('+')) return unary(); return power(); }
  function power() { const base = atom(); if (take('^')) return { op: '^', a: base, b: unary() }; return base; }
  function atom() {
    const t = peek(); if (!t) throw new Error('the formula ends too soon');
    if (take('num')) return { num: t.v };
    if (take('(')) { const e = expr(); need(')'); return e; }
    if (take('id')) {
      if (take('(')) { const args = []; if (!take(')')) { do args.push(expr()); while (take(',')); need(')'); } return { fn: t.v, args }; }
      return { id: t.v };
    }
    throw new Error('unexpected "' + (t.v ?? t.t) + '"');
  }
  const tree = expr(); if (i < tk.length) throw new Error('unexpected "' + (tk[i].v ?? tk[i].t) + '"'); return tree;
}
/** every variable name a formula reads (constants and functions left out unless bound). Pure. */
export function namesIn(src, bound = {}) {
  const out = []; const walk = (n) => { if (!n) return; if (n.id !== undefined) { if ((bound[n.id] || !CONSTANTS[n.id]) && !out.includes(n.id)) out.push(n.id); } else if (n.fn) n.args.forEach(walk); else if (n.neg) walk(n.neg); else if (n.op) { walk(n.a); walk(n.b); } };
  walk(parse(src)); return out;
}
const ADD = (a, b, w) => { if (!sameDim(a.d, b.d)) throw new Error('cannot ' + w + ' ' + (dimText(a.d) || 'a plain number') + ' and ' + (dimText(b.d) || 'a plain number')); };
/** the formula worked out on quantities { v (SI), d (dimension) }: vars name -> { v, d }; throws in words on a unit clash or an unknown name. Pure. */
export function evaluate(src, vars = {}) {
  const tree = typeof src === 'string' ? parse(src) : src;
  const ev = (n) => {
    if (n.num !== undefined) return { v: n.num, d: D() };
    if (n.id !== undefined) { const x = vars[n.id] || CONSTANTS[n.id]; if (!x) throw new Error('"' + n.id + '" has no value'); return { v: x.v, d: x.d }; }
    if (n.neg) { const x = ev(n.neg); return { v: -x.v, d: x.d }; }
    if (n.fn) {
      const f = FUNCTIONS[n.fn]; if (!f) throw new Error('no function called "' + n.fn + '"');
      const args = n.args.map(ev);
      if (f.n > 0 && args.length !== f.n) throw new Error(n.fn + ' takes ' + f.n + (f.n === 1 ? ' value' : ' values'));
      if (!args.length) throw new Error(n.fn + ' needs a value');
      if (n.fn === 'pow') return ev({ op: '^', a: n.args[0], b: n.args[1] });
      if (f.pow) return { v: f.fn(args[0].v), d: args[0].d.map((x) => x * f.pow) };
      if (f.keep) return { v: f.fn(args[0].v), d: args[0].d };
      if (f.same) { for (const a of args.slice(1)) ADD(args[0], a, 'compare'); return { v: f.fn(...args.map((a) => a.v)), d: f.plainOut ? D() : args[0].d }; }
      if (!isPlain(args[0].d)) throw new Error(n.fn + ' needs a plain number, not ' + dimText(args[0].d));
      return { v: f.fn(args[0].v), d: D() };
    }
    const a = ev(n.a), b = ev(n.b);
    switch (n.op) {
      case '+': ADD(a, b, 'add'); return { v: a.v + b.v, d: a.d };
      case '-': ADD(a, b, 'subtract'); return { v: a.v - b.v, d: a.d };
      case '*': return { v: a.v * b.v, d: a.d.map((x, i) => x + b.d[i]) };
      case '/': return { v: a.v / b.v, d: a.d.map((x, i) => x - b.d[i]) };
      case '^': if (!isPlain(b.d)) throw new Error('a power must be a plain number, not ' + dimText(b.d)); return { v: Math.pow(a.v, b.v), d: a.d.map((x) => x * b.v) };
    }
    throw new Error('cannot work that out');
  };
  return ev(tree);
}

// --- a custom formula as text (the raw mode; the guided mode writes the same text)
//   A [ft²] = 2*pi*(d/2)*l      a result: its name, the unit it is shown in, and its formula
//   d [in] = 2   # Diameter     an input: a plain number, its unit, and a label after #
const LINE = /^\s*([A-Za-z_\u0370-\u03ff][\w\u0370-\u03ff]*)\s*(?:\[([^\]]*)\])?\s*(?:=\s*(.*?))?\s*(?:#\s*(.*))?$/;
const NUMERIC = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;
/** the text read into { title, inputs: [{ k, label, kind, unit, v }], results: [{ k, label, kind, unit, expr }], errors: [] }. Pure. */
export function parseSpec(text) {
  const spec = { title: '', inputs: [], results: [], errors: [] };
  String(text ?? '').split(/\r?\n/).forEach((raw, n) => {
    const line = raw.trim(); if (!line) return;
    if (/^#/.test(line)) { if (!spec.title) spec.title = line.replace(/^#+\s*/, ''); return; }
    const m = LINE.exec(line); if (!m) { spec.errors.push('line ' + (n + 1) + ': write it as name [unit] = formula'); return; }
    const [, k, unitText = '', rhs = '', label = ''] = m, found = unitText.trim() ? findUnit(unitText) : { kind: 'number', unit: KINDS.number.units[0] };
    if (!found) spec.errors.push('line ' + (n + 1) + ': no unit called "' + unitText.trim() + '"');
    const kind = found ? found.kind : 'number', unit = found ? found.unit.id : '';
    if (spec.inputs.some((x) => x.k === k) || spec.results.some((x) => x.k === k)) { spec.errors.push('line ' + (n + 1) + ': "' + k + '" is named twice'); return; }
    if (rhs === '' || NUMERIC.test(rhs.replace(/,/g, ''))) spec.inputs.push({ k, label: label.trim() || k, kind, unit, v: rhs === '' ? '' : rhs.replace(/,/g, '') });
    else spec.results.push({ k, label: label.trim() || k, kind, unit, expr: rhs });
  });
  // a name a formula reads that nothing defines becomes an input with no value yet, so the guided mode can ask for it
  const known = new Set([...spec.inputs, ...spec.results].map((x) => x.k));
  for (const r of spec.results) { let names = []; try { names = namesIn(r.expr); } catch (e) { continue; } for (const nm of names) if (!known.has(nm) && !CONSTANTS[nm]) { spec.inputs.push({ k: nm, label: nm, kind: 'number', unit: '', v: '' }); known.add(nm); } }
  return spec;
}
/** a spec written back as text, inputs after results, one a line. Pure. */
export function specText(spec) {
  const unit = (x) => (x.unit ? ' [' + x.unit + ']' : ''), note = (x) => (x.label && x.label !== x.k ? '  # ' + x.label : '');
  return [...(spec.title ? ['# ' + spec.title] : []), ...spec.results.map((r) => r.k + unit(r) + ' = ' + r.expr + note(r)), ...spec.inputs.map((x) => x.k + unit(x) + ' = ' + (x.v ?? '') + note(x))].join('\n');
}
/** a spec worked out: { values: { k: { v, d } }, results: [{ k, label, si, d, shown, unit, kind, warn, error }], errors }. Pure. */
export function runSpec(spec) {
  const values = {}, errors = [...spec.errors], results = [];
  for (const x of spec.inputs) {
    const unit = unitOf(x.kind, x.unit) || KINDS[x.kind].units[0];
    if (x.v === '' || x.v === undefined || !Number.isFinite(Number(x.v))) { errors.push('"' + x.k + '" needs a value'); continue; }
    values[x.k] = { v: toSI(Number(x.v), unit), d: KINDS[x.kind].dim };
  }
  for (const r of spec.results) {
    try {
      const q = evaluate(r.expr, values); values[r.k] = q;
      const kind = KINDS[r.kind], unit = unitOf(r.kind, r.unit) || kind.units[0], ok = sameDim(q.d, kind.dim) || (r.kind === 'number' && false);
      if (r.unit === '' && r.kind === 'number' && !isPlain(q.d)) { // no unit asked: shown in SI, with the kinds it could be
        results.push({ ...r, si: q.v, d: q.d, shown: q.v, unitText: dimText(q.d), kinds: kindsOfDim(q.d) }); continue; }
      if (!ok) { results.push({ ...r, si: q.v, d: q.d, shown: q.v, unitText: dimText(q.d) || '(plain number)', warn: 'the formula gives ' + (dimText(q.d) || 'a plain number') + ', which is not ' + kind.name.toLowerCase() + ' (' + unit.id + '); shown in SI', kinds: kindsOfDim(q.d) }); continue; }
      results.push({ ...r, si: q.v, d: q.d, shown: fromSI(q.v, unit), unitText: unit.id });
    } catch (e) { results.push({ ...r, error: String(e.message || e) }); }
  }
  return { values, results, errors };
}
