"""Builds small sample .apkg files for the import tests (made-up cards, not real decks).

Creates the three package versions:
  legacy1  - collection.anki2 (schema 11, JSON in col table)
  legacy2  - collection.anki21 (schema 11) + media JSON
  latest   - collection.anki21b (schema 18 tables, zstd-compressed) + dummy collection.anki2
Run: python3 scripts/make-test-apkg.py   (needs the `zstd` command)
"""
import json, os, sqlite3, subprocess, tempfile, zipfile

OUT = os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures")
SEP = "\x1f"
NOTES = [  # (model, deck, fields, tags)
    ("basic", "Spanish::Animals", ["el gato", "the cat"], "animals"),
    ("basic", "Spanish::Animals", ['el perro <img src="dog.jpg">', "the dog [sound:dog.mp3]"], ""),
    ("reverse", "Spanish", ["<b>hola</b>", "hello"], "greetings basics"),
    ("cloze", "Spanish", ["{{c1::Madrid}} is the capital of {{c2::Spain}}", "Geography"], ""),
]
MODELS = {"basic": (1001, 0, ["Front", "Back"], 1), "reverse": (1002, 0, ["Front", "Back"], 2), "cloze": (1003, 1, ["Text", "Back Extra"], 1)}
DECKS = {"Spanish": 2001, "Spanish::Animals": 2002}

def unicase(a, b):
    a, b = a.lower(), b.lower()
    return (a > b) - (a < b)

def schema11(path):
    db = sqlite3.connect(path)
    db.executescript("""
      CREATE TABLE col (id integer primary key, crt integer, mod integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text);
      CREATE TABLE notes (id integer primary key, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld integer, csum integer, flags integer, data text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, mod integer, usn integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odue integer, odid integer, flags integer, data text);
    """)
    models = {str(mid): {"id": mid, "name": name, "type": t, "flds": [{"name": f, "ord": i} for i, f in enumerate(flds)],
                         "tmpls": [{"name": f"Card {i+1}", "ord": i, "qfmt": "{{Front}}", "afmt": "{{Back}}"} for i in range(nt)]}
              for name, (mid, t, flds, nt) in MODELS.items()}
    decks = {str(did): {"id": did, "name": name} for name, did in DECKS.items()}
    db.execute("INSERT INTO col VALUES (1,0,0,0,11,0,0,0,'{}',?,?,'{}','{}')", (json.dumps(models), json.dumps(decks)))
    add_notes(db)
    db.commit(); db.close()

def schema18(path):
    db = sqlite3.connect(path)
    db.create_collation("unicase", unicase)
    db.executescript("""
      CREATE TABLE col (id integer primary key, crt integer, mod integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text);
      CREATE TABLE notetypes (id integer NOT NULL PRIMARY KEY, name text NOT NULL COLLATE unicase, mtime_secs integer NOT NULL, usn integer NOT NULL, config blob NOT NULL);
      CREATE UNIQUE INDEX idx_notetypes_name ON notetypes (name);
      CREATE TABLE fields (ntid integer NOT NULL, ord integer NOT NULL, name text NOT NULL COLLATE unicase, config blob NOT NULL, PRIMARY KEY (ntid, ord)) without rowid;
      CREATE UNIQUE INDEX idx_fields_name_ntid ON fields (name, ntid);
      CREATE TABLE templates (ntid integer NOT NULL, ord integer NOT NULL, name text NOT NULL COLLATE unicase, mtime_secs integer NOT NULL, usn integer NOT NULL, config blob NOT NULL, PRIMARY KEY (ntid, ord)) without rowid;
      CREATE TABLE decks (id integer PRIMARY KEY NOT NULL, name text NOT NULL COLLATE unicase, mtime_secs integer NOT NULL, usn integer NOT NULL, common blob NOT NULL, kind blob NOT NULL);
      CREATE UNIQUE INDEX idx_decks_name ON decks (name);
      CREATE TABLE notes (id integer primary key, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld integer, csum integer, flags integer, data text);
      CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, mod integer, usn integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odue integer, odid integer, flags integer, data text);
    """)
    # Note type kind (cloze or not) is inside the protobuf config blob in real files;
    # the importer does not read it, so a dummy blob is enough here.
    db.execute("INSERT INTO col VALUES (1,0,0,0,18,0,0,0,'','','','','')")
    for name, (mid, t, flds, nt) in MODELS.items():
        db.execute("INSERT INTO notetypes VALUES (?,?,0,0,?)", (mid, name.capitalize(), b"\x1a\x00"))
        for i, f in enumerate(flds): db.execute("INSERT INTO fields VALUES (?,?,?,?)", (mid, i, f, b""))
        for i in range(nt): db.execute("INSERT INTO templates VALUES (?,?,?,0,0,?)", (mid, i, f"Card {i+1}", b""))
    for name, did in DECKS.items():
        db.execute("INSERT INTO decks VALUES (?,?,0,0,?,?)", (did, name.replace("::", SEP), b"", b""))
    add_notes(db)
    db.commit(); db.close()

def add_notes(db):
    cid = 5000
    for i, (model, deck, flds, tags) in enumerate(NOTES):
        mid, t, _, nt = MODELS[model]
        nid = 3000 + i
        db.execute("INSERT INTO notes VALUES (?,?,?,0,0,?,?,0,0,0,'')", (nid, f"g{i}", mid, f" {tags} " if tags else "", SEP.join(flds)))
        ords = [0, 1] if t == 1 and "c2" in flds[0] else list(range(nt))
        for o in ords:
            cid += 1
            db.execute("INSERT INTO cards VALUES (?,?,?,?,0,0,0,0,0,0,0,0,0,0,0,0,0,'')", (cid, nid, DECKS[deck], o))

def write(name, entries):
    with zipfile.ZipFile(os.path.join(OUT, name), "w", zipfile.ZIP_DEFLATED) as z:
        for arc, data in entries: z.writestr(arc, data)
    print("wrote", name)

with tempfile.TemporaryDirectory() as tmp:
    p11 = os.path.join(tmp, "c11.db"); schema11(p11)
    p18 = os.path.join(tmp, "c18.db"); schema18(p18)
    data11 = open(p11, "rb").read()
    zst = subprocess.run(["zstd", "-q", "-c", p18], check=True, capture_output=True).stdout
    media_zst = subprocess.run(["zstd", "-q", "-c"], input=b"", check=True, capture_output=True).stdout
    write("sample-legacy1.apkg", [("collection.anki2", data11), ("media", "{}")])
    write("sample-legacy2.apkg", [("collection.anki21", data11), ("media", json.dumps({"0": "dog.jpg", "1": "dog.mp3"})), ("0", b"jpg"), ("1", b"mp3")])
    write("sample-latest.apkg", [("collection.anki2", data11[:0] or b"dummy"), ("collection.anki21b", zst), ("media", media_zst), ("meta", b"\x08\x03")])
