"""Conversation sentences (light set: 4 per part) -> /workspace/french-study/data/sentences.json
Target words are referenced by their display form in words.json; part = target's part.
Validator: target exists, answer appears in options, distractors differ, build tiles rebuild the sentence."""
import json, re, hashlib
F = lambda t, s, ans, d, he: dict(type='fill', t=t, s=s, ans=ans, d=d, he=he)
B = lambda t, s, he, alt=(): dict(type='build', t=t, s=s, he=he, alt=list(alt))
D = lambda t, lines, ans, d: dict(type='dialog', t=t, lines=lines, ans=ans, d=d)
ITEMS = [
# 1
F('pourquoi', "___ tu es triste ?", 'Pourquoi', ['Comment', 'Combien', 'Quand'], 'למה את עצובה?'),
F('avec', "Je vais au cinéma ___ mes amis.", 'avec', ['sans', 'sous', 'entre'], 'אני הולכת לקולנוע עם החברים שלי.'),
B('toujours', "Elle est toujours en retard.", 'היא תמיד מאחרת.'),
D('ça va ?', [("Salut Noa, ___", 'היי נועה, מה נשמע?'), ("Ça va bien, merci !", 'הכול טוב, תודה!')], 'ça va ?', ['de rien', 'pardon', 'au revoir'], ),
# 2
F('la semaine', "Il y a sept jours dans une ___.", 'semaine', ['heure', 'minute', 'année'], 'יש שבעה ימים בשבוע.'),
F('le frère', "Mon ___ a quinze ans.", 'frère', ['sœur', 'mère', 'tante'], 'אחי בן חמש־עשרה.'),
B('le week-end', "Le week-end, je dors beaucoup.", 'בסוף השבוע אני ישנה הרבה.', ["je dors beaucoup le week-end"]),
D('l\'heure', [("Tu sais quelle ___ il est ?", 'את יודעת מה השעה?'), ("Il est huit heures.", 'השעה שמונה.')], 'heure', ['semaine', 'année', 'fois']),
# 3
F('la cuisine', "Maman prépare le dîner dans la ___.", 'cuisine', ['chambre', 'salle de bains', 'porte'], 'אמא מכינה את ארוחת הערב במטבח.'),
F('le fromage', "En France, on mange beaucoup de ___.", 'fromage', ['chaise', 'pull', 'cahier'], 'בצרפת אוכלים הרבה גבינה.'),
B('les chaussures', "Mes chaussures sont noires.", 'הנעליים שלי שחורות.'),
D('le petit-déjeuner', [("Tu prends un ___ le matin ?", 'את אוכלת ארוחת בוקר בבוקר?'), ("Oui, du pain et du lait.", 'כן, לחם וחלב.')], 'petit-déjeuner', ['dîner', 'pantalon', 'jardin']),
# 4
F('la boulangerie', "J'achète une baguette à la ___.", 'boulangerie', ['piscine', 'gare', 'banque'], 'אני קונה באגט במאפייה.'),
F('il fait froid', "En hiver, ___ : mets ton manteau !", 'il fait froid', ['il fait chaud', 'il fait beau', "il y a"], 'בחורף קר: תלבשי את המעיל!'),
B('les vacances', "Les vacances commencent demain.", 'החופש מתחיל מחר.', ["demain les vacances commencent"]),
D('le cadeau', [("C'est pour toi, joyeux anniversaire !", 'זה בשבילך, יום הולדת שמח!'), ("Merci pour le ___ !", 'תודה על המתנה!')], 'cadeau', ['billet', 'vent', 'magasin']),
# 5
F('dormir', "Je suis fatiguée, je veux ___.", 'dormir', ['courir', 'chanter', 'payer'], 'אני עייפה, אני רוצה לישון.'),
F('cher, chère', "Ce téléphone est trop ___ pour moi.", 'cher', ['content', 'fatigué', 'prêt'], 'הטלפון הזה יקר מדי בשבילי.'),
B('aimer', "J'aime écouter de la musique.", 'אני אוהבת להקשיב למוזיקה.'),
D('prêt, prête', [("Tu es ___ ? On part !", 'את מוכנה? יוצאים!'), ("Oui, j'arrive !", 'כן, אני באה!')], 'prête', ['triste', 'malade', 'difficile']),
# 6
F('la chanson', "C'est ma ___ préférée, écoute !", 'chanson', ['forêt', 'douche', 'fourchette'], 'זה השיר האהוב עליי, תקשיבי!'),
F('tout droit', "Pour aller à la gare, allez ___.", 'tout droit', ['là-haut', 'le nord', 'la recette'], 'כדי להגיע לתחנה, לכו ישר.'),
B('le message', "Je t'envoie un message ce soir.", 'אני אשלח לך הודעה הערב.', ["ce soir je t'envoie un message"]),
D('la recette', [("Ton gâteau est délicieux !", 'העוגה שלך טעימה מאוד!'), ("Merci ! C'est la ___ de ma grand-mère.", 'תודה! זה המתכון של סבתא שלי.')], 'recette', ['carte', 'promenade', 'réservation']),
# 7
F('la fièvre', "Il est malade, il a de la ___.", 'fièvre', ['farine', 'soif', 'ceinture'], 'הוא חולה, יש לו חום.'),
F('l\'examen', "Demain, j'ai un ___ de maths.", 'examen', ['salaire', 'yaourt', 'genou'], 'מחר יש לי מבחן במתמטיקה.'),
B('les lunettes', "Je ne trouve pas mes lunettes.", 'אני לא מוצאת את המשקפיים שלי.'),
D('la récréation', [("On joue au foot à la ___ ?", 'נשחק כדורגל בהפסקה?'), ("D'accord, à dix heures !", 'בסדר, בעשר!')], 'récréation', ['matière', 'physique', 'voix']),
# 8
F('le mensonge', "Ce n'est pas vrai, c'est un ___ !", 'mensonge', ['moment', 'début', 'château'], 'זה לא נכון, זה שקר!'),
F('la chance', "Tu as gagné ? Tu as de la ___ !", 'chance', ['faute', 'lumière', 'poule'], 'ניצחת? יש לך מזל!'),
B('la surprise', "Quelle belle surprise !", 'איזו הפתעה יפה!'),
D('le problème', [("Ça ne marche pas…", 'זה לא עובד…'), ("Pas de ___, je vais t'aider.", 'אין בעיה, אני אעזור לך.')], 'problème', ['quart', 'singe', 'bois']),
# 9
F('se dépêcher', "Le bus arrive, il faut ___ !", 'se dépêcher', ['se marier', 'peindre', 'naître'], 'האוטובוס מגיע, צריך למהר!'),
F('réussir', "Si tu travailles, tu vas ___ ton examen.", 'réussir', ['jeter', 'sourire', 'garder'], 'אם תעבדי, תצליחי במבחן.'),
B('raconter', "Raconte-moi ton week-end !", 'ספרי לי על סוף השבוע שלך!'),
D('se sentir', [("Tu te ___ mieux aujourd'hui ?", 'את מרגישה טוב יותר היום?'), ("Oui, merci, beaucoup mieux.", 'כן, תודה, הרבה יותר טוב.')], 'sens', ['souviens', 'promènes', 'maries']),
# 10
F('ensemble', "On fait nos devoirs ___ ?", 'ensemble', ['dehors', 'bientôt', 'surtout'], 'נעשה את שיעורי הבית ביחד?'),
F('drôle', "Ce film est très ___, j'ai beaucoup ri.", 'drôle', ['lent', 'sale', 'bas'], 'הסרט הזה מצחיק מאוד, צחקתי הרבה.'),
B('d\'abord', "D'abord, je mange, puis je travaille.", 'קודם אני אוכלת, ואחר כך אני עובדת.', ["je mange d'abord puis je travaille"]),
D('inquiet, inquiète', [("Pourquoi tu es ___ ?", 'למה את מודאגת?'), ("J'ai un examen demain.", 'יש לי מבחן מחר.')], 'inquiète', ['génial', 'moderne', 'possible']),
# 11
F('l\'équipe', "Notre ___ a gagné le match !", 'équipe', ['horaire', 'arrêt', 'aide'], 'הקבוצה שלנו ניצחה במשחק!'),
F('faire attention', "Il faut ___ en traversant la rue.", 'faire attention', ['faire du shopping', 'faire le ménage', 'avoir raison'], 'צריך להיזהר כשחוצים את הכביש.'),
B('ce n\'est pas grave', "Ce n'est pas grave, ça arrive.", 'זה לא נורא, זה קורה.', ["ça arrive ce n'est pas grave"]),
D('ça coûte combien ?', [("Ce tee-shirt est joli. ___", 'החולצה הזאת יפה. כמה זה עולה?'), ("Quinze euros.", 'חמישה־עשר אירו.')], 'Ça coûte combien ?', ['Il est midi.', 'Bravo !', "J'aimerais."]),
# 12
F('le recyclage', "Le ___ protège l'environnement.", 'recyclage', ['crime', 'conflit', 'débat'], 'המיחזור מגן על הסביבה.'),
F('voter', "En Israël, on peut ___ à dix-huit ans.", 'voter', ['protéger', 'douter', 'exposer'], 'בישראל אפשר להצביע מגיל שמונה־עשרה.'),
B('l\'opinion', "Quelle est ton opinion ?", 'מה דעתך?'),
D('le personnage', [("Qui est ton ___ préféré dans le livre ?", 'מי הדמות האהובה עלייך בספר?'), ("Le Petit Prince, bien sûr !", 'הנסיך הקטן, כמובן!')], 'personnage', ['titre', 'public', 'progrès']),
# 13
F('le courage', "Il faut du ___ pour dire la vérité.", 'courage', ['choix', 'rapport', 'projet'], 'צריך אומץ כדי לומר את האמת.'),
F('s\'excuser', "Tu dois ___ auprès de ton amie.", "t'excuser", ['casser', 'ajouter', 'détruire'], 'את צריכה להתנצל בפני החברה שלך.'),
B('rêver', "Je rêve de voyager à Paris.", 'אני חולמת לטייל בפריז.'),
D('hésiter', [("Je ne sais pas quoi choisir…", 'אני לא יודעת מה לבחור…'), ("N'___ pas, prends le rouge !", 'אל תהססי, קחי את האדום!')], 'hésite', ['évite', 'avoue', 'remercie']),
# 14
F('se taire', "Chut ! Il faut ___ pendant le film.", 'se taire', ['se battre', 'se fâcher', 'fuir'], 'שקט! צריך לשתוק בזמן הסרט.'),
F('arroser', "N'oublie pas d'___ les fleurs.", 'arroser', ['attraper', 'pousser', 'résumer'], 'אל תשכחי להשקות את הפרחים.'),
B('désolé, désolée', "Je suis désolée, je suis en retard.", 'אני מצטערת, אני מאחרת.'),
D('s\'agir de', [("De quoi parle ce livre ?", 'על מה הספר הזה?'), ("Il ___ d'un petit prince et d'une rose.", 'מדובר בנסיך קטן ובוורד.')], "s'agit", ['cache', 'dure', 'existe']),
# 15
F('malheureusement', "___, il pleut : on reste à la maison.", 'Malheureusement', ['Absolument', 'Environ', 'Autrefois'], 'למרבה הצער יורד גשם: נשארים בבית.'),
F('têtu, têtue', "Mon petit frère ne m'écoute jamais, il est ___ !", 'têtu', ['humble', 'précis', 'utile'], 'אחי הקטן אף פעם לא מקשיב לי, הוא עקשן!'),
B('en fait', "En fait, je préfère le thé.", 'למעשה, אני מעדיפה תה.', ["je préfère le thé en fait"]),
D('sensible', [("Elle pleure souvent au cinéma.", 'היא בוכה הרבה בקולנוע.'), ("Oui, elle est très ___.", 'כן, היא מאוד רגישה.')], 'sensible', ['injuste', 'normale', 'publique']),
# 16
F('le mot de passe', "J'ai oublié mon ___ !", 'mot de passe', ['loyer', 'drapeau', 'sang'], 'שכחתי את הסיסמה שלי!'),
F('le bénévole', "Le samedi, je suis ___ dans une association.", 'bénévole', ['diplôme', 'risque', 'concours'], 'בשבת אני מתנדבת בעמותה.'),
B('l\'effort', "Merci pour tous tes efforts !", 'תודה על כל המאמצים שלך!'),
D('la crêpe', [("Qu'est-ce que tu veux manger ?", 'מה את רוצה לאכול?'), ("Une ___ au chocolat, s'il te plaît !", 'קרפ בשוקולד, בבקשה!')], 'crêpe', ['laïcité', 'circulation', 'révolution']),
# 17 (Petit Prince / La Fontaine)
F('l\'arrosoir', "Le petit prince prend un ___ d'eau fraîche.", 'arrosoir', ['paravent', 'baobab', 'piège'], 'הנסיך הקטן לוקח מזלף של מים קרים.'),
F('le paravent', "La rose demande un ___ contre les courants d'air.", 'paravent', ['arrosoir', 'remords', 'rayonnement'], 'הוורד מבקש פרגוד נגד רוחות הפרצים.'),
B('le Petit Prince', "Le Petit Prince aime sa rose.", 'הנסיך הקטן אוהב את הוורד שלו.'),
D('le piège', [("Le lion est pris dans un ___.", 'האריה נתפס במלכודת.'), ("Le rat arrive pour l'aider !", 'העכברוש מגיע לעזור לו!')], 'piège', ['bienfait', 'rang', 'acte']),
# 18 (Hugo / Ionesco)
F('échapper', "Une fois dit, le mot nous ___.", 'échappe', ['bondit', 'défait', 'piétine'], 'ברגע שנאמרה, המילה בורחת מאיתנו.'),
F('se transformer', "Dans la pièce, Jean ___ en rhinocéros.", 'se transforme', ['se taire', 'parle bas', 'défait'], 'במחזה ז\'אן הופך לקרנף.'),
B('la parole', "La parole est une responsabilité.", 'הדיבור הוא אחריות.'),
D('l\'ennemi, l\'ennemie', [("Pourquoi faut-il faire attention aux mots ?", 'למה צריך להיזהר במילים?'), ("Un mot peut créer un ___ mortel.", 'מילה יכולה ליצור אויב בנפש.')], 'ennemi', ['soulier', 'individu', 'dédale']),
# 19 (grammar / exam)
F('l\'impératif', "« Prenez garde ! » : le verbe est à l'___.", 'impératif', ['auxiliaire', 'adjectif', 'singulier'], '"היזהרו!": הפועל בציווי.'),
F('à l\'arrière-plan', "Sur la photo, on voit des montagnes ___.", "à l'arrière-plan", ['tout d\'abord', 'selon moi', 'il s\'agit de'], 'בתמונה רואים הרים ברקע.'),
B('selon moi', "Selon moi, la rose est coquette.", 'לדעתי, הוורד גנדרני.', ["la rose est coquette selon moi"]),
D('la personnification', [("Le mot marche, court et parle.", 'המילה הולכת, רצה ומדברת.'), ("C'est une ___ !", 'זו האנשה!')], 'personnification', ['rime', 'comparaison', 'répétition']),
]
W = json.load(open('/workspace/french-study/data/words.json'))['words']
by = {w['french']: w for w in W}
TOK = re.compile(r"[A-Za-zÀ-ÿœŒ0-9]+(?:['’-][A-Za-zÀ-ÿœŒ0-9]+)*'?")
def tiles(s):  # keep elided "j'" "l'" together with next word: "J'aime" -> one tile
    return TOK.findall(s)
def norm(s): return ' '.join(t.lower() for t in TOK.findall(s.replace('’', "'")))
out = []; cnt = {}
for it in ITEMS:
    w = by.get(it['t']); assert w, ('missing target', it['t'])
    p = w['part']; cnt[p] = cnt.get(p, 0) + 1
    o = {'id': f"p{p:02d}-{it['type'][0]}{cnt[p]}", 'part': p, 'type': it['type'], 't': [w['n']]}
    if it['type'] in ('fill', 'dialog'):
        opts = [it['ans']] + it['d']; assert len(set(o_.lower() for o_ in opts)) == 4, opts
        o['ans'] = [it['ans']]; o['opts'] = opts
    if it['type'] == 'fill':
        assert '___' in it['s']; o['s'] = it['s']; o['he'] = it['he']
    elif it['type'] == 'build':
        tl = tiles(it['s']); assert len(tl) >= 3, it['s']
        o['s'] = it['s']; o['tiles'] = [t.lower() if i else t for i, t in enumerate(tl)]; o['tiles'] = [t.lower() for t in tl]
        o['ans'] = list(dict.fromkeys([norm(it['s'])] + [norm(a) for a in it['alt']])); o['he'] = it['he']
    else:
        assert sum('___' in l[0] for l in it['lines']) == 1
        o['lines'] = [{'fr': a, 'he': b} for a, b in it['lines']]; o['he'] = ' / '.join(b for _, b in it['lines'])
    # full-sentence audio (Jeanne): one clip per sentence / per dialogue line, named by text hash
    full = [l['fr'].replace('___', o['ans'][0]) for l in o['lines']] if it['type'] == 'dialog' else [o['s'].replace('___', o['ans'][0]) if '___' in o['s'] else o['s']]
    o['say'] = full; o['au'] = [f"audio/sent/{hashlib.sha1(t.encode()).hexdigest()[:12]}.mp3" for t in full]
    out.append(o)
json.dump({'version': 1, 'items': out}, open('/workspace/french-study/data/sentences.json', 'w'), ensure_ascii=False, indent=None, separators=(',', ':'))
print(len(out), 'items; per part', dict(sorted(cnt.items())))
