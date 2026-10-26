/**
 * learn-data: the facts the learning pages work from, written for Verse (lib/learn-core.js reads them). Elements: symbol, English and German name and the
 * standard atomic weight as IUPAC publishes it (abridged; [n] is the mass number of the longest-lived isotope of an element with no stable one): facts,
 * not anyone's text. The words of the word quiz, their meanings and their German are Verse's own. The typing words are common words of each language.
 */
export const ELEMENTS = 'H,Hydrogen,Wasserstoff,1.008;He,Helium,Helium,4.0026;Li,Lithium,Lithium,6.94;Be,Beryllium,Beryllium,9.0122;B,Boron,Bor,10.81;C,Carbon,Kohlenstoff,12.011;N,Nitrogen,Stickstoff,14.007;O,Oxygen,Sauerstoff,15.999;F,Fluorine,Fluor,18.998;Ne,Neon,Neon,20.180;'
  + 'Na,Sodium,Natrium,22.990;Mg,Magnesium,Magnesium,24.305;Al,Aluminium,Aluminium,26.982;Si,Silicon,Silicium,28.085;P,Phosphorus,Phosphor,30.974;S,Sulfur,Schwefel,32.06;Cl,Chlorine,Chlor,35.45;Ar,Argon,Argon,39.95;K,Potassium,Kalium,39.098;Ca,Calcium,Calcium,40.078;'
  + 'Sc,Scandium,Scandium,44.956;Ti,Titanium,Titan,47.867;V,Vanadium,Vanadium,50.942;Cr,Chromium,Chrom,51.996;Mn,Manganese,Mangan,54.938;Fe,Iron,Eisen,55.845;Co,Cobalt,Cobalt,58.933;Ni,Nickel,Nickel,58.693;Cu,Copper,Kupfer,63.546;Zn,Zinc,Zink,65.38;'
  + 'Ga,Gallium,Gallium,69.723;Ge,Germanium,Germanium,72.630;As,Arsenic,Arsen,74.922;Se,Selenium,Selen,78.971;Br,Bromine,Brom,79.904;Kr,Krypton,Krypton,83.798;Rb,Rubidium,Rubidium,85.468;Sr,Strontium,Strontium,87.62;Y,Yttrium,Yttrium,88.906;Zr,Zirconium,Zirconium,91.224;'
  + 'Nb,Niobium,Niob,92.906;Mo,Molybdenum,Molybdän,95.95;Tc,Technetium,Technetium,[98];Ru,Ruthenium,Ruthenium,101.07;Rh,Rhodium,Rhodium,102.91;Pd,Palladium,Palladium,106.42;Ag,Silver,Silber,107.87;Cd,Cadmium,Cadmium,112.41;In,Indium,Indium,114.82;Sn,Tin,Zinn,118.71;'
  + 'Sb,Antimony,Antimon,121.76;Te,Tellurium,Tellur,127.60;I,Iodine,Iod,126.90;Xe,Xenon,Xenon,131.29;Cs,Caesium,Caesium,132.91;Ba,Barium,Barium,137.33;La,Lanthanum,Lanthan,138.91;Ce,Cerium,Cer,140.12;Pr,Praseodymium,Praseodym,140.91;Nd,Neodymium,Neodym,144.24;'
  + 'Pm,Promethium,Promethium,[145];Sm,Samarium,Samarium,150.36;Eu,Europium,Europium,151.96;Gd,Gadolinium,Gadolinium,157.25;Tb,Terbium,Terbium,158.93;Dy,Dysprosium,Dysprosium,162.50;Ho,Holmium,Holmium,164.93;Er,Erbium,Erbium,167.26;Tm,Thulium,Thulium,168.93;Yb,Ytterbium,Ytterbium,173.05;'
  + 'Lu,Lutetium,Lutetium,174.97;Hf,Hafnium,Hafnium,178.49;Ta,Tantalum,Tantal,180.95;W,Tungsten,Wolfram,183.84;Re,Rhenium,Rhenium,186.21;Os,Osmium,Osmium,190.23;Ir,Iridium,Iridium,192.22;Pt,Platinum,Platin,195.08;Au,Gold,Gold,196.97;Hg,Mercury,Quecksilber,200.59;'
  + 'Tl,Thallium,Thallium,204.38;Pb,Lead,Blei,207.2;Bi,Bismuth,Bismut,208.98;Po,Polonium,Polonium,[209];At,Astatine,Astat,[210];Rn,Radon,Radon,[222];Fr,Francium,Francium,[223];Ra,Radium,Radium,[226];Ac,Actinium,Actinium,[227];Th,Thorium,Thorium,232.04;'
  + 'Pa,Protactinium,Protactinium,231.04;U,Uranium,Uran,238.03;Np,Neptunium,Neptunium,[237];Pu,Plutonium,Plutonium,[244];Am,Americium,Americium,[243];Cm,Curium,Curium,[247];Bk,Berkelium,Berkelium,[247];Cf,Californium,Californium,[251];Es,Einsteinium,Einsteinium,[252];Fm,Fermium,Fermium,[257];'
  + 'Md,Mendelevium,Mendelevium,[258];No,Nobelium,Nobelium,[259];Lr,Lawrencium,Lawrencium,[266];Rf,Rutherfordium,Rutherfordium,[267];Db,Dubnium,Dubnium,[268];Sg,Seaborgium,Seaborgium,[269];Bh,Bohrium,Bohrium,[270];Hs,Hassium,Hassium,[269];Mt,Meitnerium,Meitnerium,[278];Ds,Darmstadtium,Darmstadtium,[281];'
  + 'Rg,Roentgenium,Roentgenium,[282];Cn,Copernicium,Copernicium,[285];Nh,Nihonium,Nihonium,[286];Fl,Flerovium,Flerovium,[289];Mc,Moscovium,Moscovium,[290];Lv,Livermorium,Livermorium,[293];Ts,Tennessine,Tenness,[294];Og,Oganesson,Oganesson,[294]';

// the word quiz: word | its meaning in a few words of Verse's own | German | level 1 (everyday) to 5 (rare)
const W = `big|large in size|groß|1
quick|fast; taking little time|schnell|1
begin|to start|beginnen|1
silent|making no sound|still|1
tiny|very small|winzig|1
angry|feeling strong annoyance|wütend|1
borrow|to take something you will give back|leihen|1
cheap|costing little money|billig|1
choose|to pick one of several|wählen|1
damp|slightly wet|feucht|1
empty|with nothing inside|leer|1
fix|to repair|reparieren|1
gift|something given freely|Geschenk|1
huge|extremely large|riesig|1
journey|a trip from one place to another|Reise|1
neighbour|a person who lives next to you|Nachbar|1
polite|having good manners|höflich|1
rare|not found or seen often|selten|1
shout|to speak very loudly|rufen|1
wealthy|having a lot of money|reich|1
abundant|existing in large amounts|reichlich|2
accurate|correct in every detail|genau|2
brief|lasting a short time|kurz|2
cautious|careful to avoid danger|vorsichtig|2
conceal|to hide|verbergen|2
eager|wanting very much to do something|eifrig|2
fragile|easily broken|zerbrechlich|2
genuine|real, not fake|echt|2
hostile|unfriendly and ready to fight|feindselig|2
imitate|to copy the way someone does something|nachahmen|2
loyal|faithful to a person or cause|treu|2
modest|not boasting about yourself|bescheiden|2
neglect|to fail to look after|vernachlässigen|2
obvious|easy to see or understand|offensichtlich|2
predict|to say what will happen|vorhersagen|2
reluctant|unwilling to do something|widerwillig|2
scarce|hard to find; not enough|knapp|2
sincere|honest in what you say and feel|aufrichtig|2
vast|very great in area|weit|2
vivid|bright and clear|lebhaft|2
ambiguous|having more than one meaning|mehrdeutig|3
benevolent|kind and wishing good to others|wohlwollend|3
candid|frank and honest|offen|3
diligent|working hard and carefully|fleißig|3
eloquent|speaking clearly and persuasively|redegewandt|3
frugal|careful not to waste money|sparsam|3
gregarious|enjoying the company of others|gesellig|3
hinder|to get in the way of|behindern|3
impartial|not favouring one side|unparteiisch|3
jovial|cheerful and friendly|fröhlich|3
lethargic|sluggish and without energy|träge|3
meticulous|paying great attention to detail|sorgfältig|3
novice|a beginner|Anfänger|3
obstinate|refusing to change your mind|stur|3
pragmatic|dealing with things practically|pragmatisch|3
resilient|able to recover quickly|widerstandsfähig|3
skeptical|doubting that something is true|skeptisch|3
tedious|long, slow and boring|mühsam|3
versatile|able to do many different things|vielseitig|3
wary|watchful of possible danger|misstrauisch|3
alleviate|to make less severe|lindern|4
belligerent|eager to fight or argue|kriegerisch|4
capricious|changing mood suddenly|launisch|4
deference|polite respect|Ehrerbietung|4
ephemeral|lasting a very short time|vergänglich|4
fastidious|very hard to please about details|wählerisch|4
garrulous|talking too much about trivial things|geschwätzig|4
impetuous|acting quickly without thinking|ungestüm|4
juxtapose|to place side by side to compare|gegenüberstellen|4
laconic|using very few words|wortkarg|4
magnanimous|generous in forgiving|großmütig|4
nonchalant|calm and seeming not to care|lässig|4
ostentatious|showy, meant to impress|protzig|4
placate|to calm someone's anger|besänftigen|4
recalcitrant|stubbornly refusing to obey|widerspenstig|4
sanguine|hopeful and confident|zuversichtlich|4
tenacious|holding on firmly; persistent|hartnäckig|4
ubiquitous|found everywhere|allgegenwärtig|4
vindicate|to clear of blame|rechtfertigen|4
zealous|full of eager enthusiasm|eifrig|4
abstruse|hard to understand|schwer verständlich|5
bucolic|of pleasant country life|ländlich|5
cogent|clear and convincing|überzeugend|5
diaphanous|light and see-through|durchscheinend|5
equanimity|calmness under stress|Gleichmut|5
fatuous|silly and pointless|albern|5
grandiloquent|using pompous words|hochtrabend|5
inchoate|just begun and not fully formed|unausgereift|5
lugubrious|sad and gloomy|kummervoll|5
mendacious|not telling the truth|verlogen|5
obsequious|too eager to please or obey|unterwürfig|5
perfunctory|done with little care|oberflächlich|5
querulous|complaining in a whining way|nörglerisch|5
sesquipedalian|using long words|langatmig|5
truculent|eager to argue or fight|streitlustig|5
umbrage|offence or annoyance|Anstoß|5
vituperative|bitterly abusive|schmähend|5
winsome|attractive in a sweet way|gewinnend|5
xenial|friendly to guests|gastfreundlich|5
zenith|the highest point|Höhepunkt|5`;
export const WORDS = Object.freeze(W.split('\n').map((l) => { const [word, def, de, level] = l.split('|'); return { word, def, de, level: +level }; }));

// the typing tutor's words: common words of each language
export const TYPE_WORDS = Object.freeze({
  en: ('the of and to in is it that was he for on are as with his they at be this from have or by one had not but what all were when we there can an your which their said if do will each about how up out them then she many some so these would other into has more her two like him see time could no make than first been its who now people my made over did down only way find use may water long little very after words called just where most know get through back much before go good new write our used me man too any day same right look think also around another came come work three word must because does part even place well such here take why things help put years different away again off went old number great tell men say small every found still between name should home big give air line set own under read last never us left end along while might next sound below saw something thought both few those always looked show large often together asked house world going want school important until form food keep children feet land side without boy once animals life enough took sometimes four head above kind began almost live page got earth need far hand high year mother light parts country father let night following picture being study second eyes soon times story boys since white days paper hard near sentence better best across during today others however sure means knew try told young miles sun ways thing whole hear example heard several change answer room sea against top turned learn point city play toward five using himself usually').split(' '),
  de: ('der die und in den von zu das mit sich des auf für ist im dem nicht ein eine als auch es an werden aus er hat dass sie nach wird bei einer um am sind noch wie einem über einen so zum war haben nur oder aber vor zur bis mehr durch man sein wurde sei hatte kann gegen vom können schon wenn habe seine ihre dann unter wir soll ich eines jahr zwei jahre diese dieser wieder keine seiner worden will zwischen immer was sagte gibt alle diesem seit muss wurden beim doch jetzt waren drei neue damit bereits da ihr seinen müssen ab ihrer ihren kein wo heute weil sollen sehr ohne hier mehr viele selbst sagt also ende nun gut weiter tag welt stadt land leben kinder frau mann haus zeit arbeit schule wasser essen spielen lernen lesen schreiben rechnen hören sehen sprechen fragen antworten machen gehen kommen sagen finden denken wissen geben nehmen stehen liegen bringen halten lassen bleiben heißen zeigen kennen beginnen glauben laufen fahren tragen öffnen schließen schön groß klein alt neu jung lang kurz hoch tief warm kalt früh spät oben unten links rechts vielleicht natürlich wirklich bald morgen gestern abend nacht woche monat freund familie straße auto zug hund katze baum blume sonne regen wind schnee berg see meer fluss himmel stern').split(' '),
});
