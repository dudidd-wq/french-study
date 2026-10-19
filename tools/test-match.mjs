import { check } from '../js/match.js';
import fs from 'fs';
const T = [['le livre','livre','exact'],['le livre','le livre','exact'],['le livre','la livre','article'],['le livre','Le Livre!','exact'],
['l\'école','école','exact'],['l\'école','ecole','accent'],['l\'école','l’école','exact'],['ami, amie','amie','exact'],['ami, amie','l\'amie','article'],
['l\'œil, les yeux','les yeux','exact'],['l\'œil, les yeux','oeil','exact'],['ne... pas','ne pas','exact'],['aujourd\'hui','aujourdhui','typo'],['aujourd\'hui','aujourd\'hui','exact'],
['la fenêtre','fenetre','accent'],['la fenêtre','fenêtte','typo'],['le chat','chien',false],['beau, belle','belle','exact'],['s\'il vous plaît','s il vous plait','typo'],
['quatre-vingts','quatre vingts','exact'],['le cœur','coeur','exact']];
let bad = 0; for (const [fr, inp, exp] of T) { const r = check(inp, fr); if (r !== exp) { bad++; console.log('FAIL', fr, '|', inp, '->', r, 'expected', exp); } }
console.log(bad ? bad + ' failures' : 'all ' + T.length + ' passed');
const W = JSON.parse(fs.readFileSync(new URL('../data/words.json', import.meta.url))).words;
let f = 0; for (const w of W) { if (check(w.french, w.french) !== 'exact') { f++; console.log('self-fail', w.french); } }
console.log('self-check failures', f);
