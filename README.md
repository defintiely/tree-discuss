# Tree Discuss

Threaded discussion on a 2D canvas. A reply attaches to a **specific phrase** in the parent
message, not to the message as a whole — so you can always see what exactly is being answered.

## Run locally

```
npm install
npm run dev      # http://localhost:5173
npm run build    # static files in dist/
```

Rooms need a Supabase project. Copy its URL and anon key into `.env.local`:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Apply `supabase/schema.sql` in the Supabase SQL editor. Without these the app still runs —
it just works locally in one browser, with no rooms.

## Using it

Select any text in a node and press **↳ Ответить** — a child node appears, an arrow runs from
the quote to it, and the quoted fragment stays highlighted in the parent's colour. Two replies
to different fragments get different colours, so it is obvious which quote belongs to which answer.

- **↳ Ответить** in the footer — reply to the whole message, no selection
- **+ Дописать** — continue this node's own text instead of replying to yourself
- **☺+** — reactions; click an existing one to add another
- **Разложить** — lay the tree out in columns: one per reply level, ordered by where each
  quote sits in the parent's text
- **Ширина** — node width for the whole canvas; in a room everyone sees the same layout

## Rooms

Create a room with a name and a password, share both with your team, and you are editing the
same tree. Changes save to the cloud every 10 seconds and arrive to everyone else in the same cycle.

The password never leaves the browser. The database stores a one-way derivative of it and the
tree encrypted with a key derived from it, so whoever reads the table gets neither the password
nor the discussion — verified by attacking a live database. Room names are visible; the content is not.

**A forgotten password cannot be recovered** — the room stays unreadable. That is the price of
not storing it anywhere.

## Import from a chat log

**Промпт для LLM** opens a ready prompt: paste it into any LLM together with your conversation,
and it returns `nodes.csv` + `reactions.csv` for **Импорт CSV**.

Quotes travel as **text** (the `quote` column), not character offsets — the app locates them by
substring search. This came out of testing: asked to count offsets by hand, an LLM got all four
anchors wrong while its own self-check reported success.

## Exchange format

**nodes.csv** — `id,parent_id,kind,title,text,x,y,anchor_start,anchor_end,color,author,quote`

The tree is flat: a child carries the link to its parent, there is no separate edge table.
`quote` wins over the numeric offsets on import — if the string is found in the parent's text,
anchors are computed from it.

**reactions.csv** — `node_id,emoji,count`

Files carry a BOM so Excel keeps Cyrillic and emoji intact. Import validates duplicate ids,
dangling `parent_id`, cycles and root count, naming the offending node rather than saying
"invalid csv".

## Not there yet

- editing an already-answered text shifts its highlight (the link survives)
- no undo, search, or thread collapsing
- the nickname is a signature, not a login — anyone can type any name
