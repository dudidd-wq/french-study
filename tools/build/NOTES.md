# French study build – resumable state
- Sources: src/ (ministry bagrut circular 2026, Hugo "Le mot" analysis, dossier 2026)
- Bagrut texts תשפ"ו: Le Lion et le Rat (La Fontaine), Le mot (Hugo, 1888, Toute la lyre),
  Rhinocéros II,2 "L'humanisme est périmé" (Ionesco), Le Petit Prince ch.8 (la rose).
- Written exam: unseen text, picture description w/ word bank, creativity, grammar (tenses w/o PQP, pronouns w/o dont), listening.
- lists/*.txt format: display|g|pos|he|level_or_text|hint   (g: m f a(both) n(n/a)); bagrut files use text tag pp/lf/hu/io/gr/cu/ex
- Steps: 1 lists -> 2 merge.py -> data/words.json -> 3 site -> 4 tts.py -> 5 deploy
