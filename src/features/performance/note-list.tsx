import type { PerformanceNote } from "./types";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" });

export function NoteList({ notes }: { notes: PerformanceNote[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        No performance notes yet.
      </p>
    );
  }

  return (
    <ul className="divide-border divide-y">
      {notes.map((note) => (
        <li key={note.id} className="grid gap-1 py-3">
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span>{dateFormat.format(new Date(note.noted_on))}</span>
            {note.rating !== null && (
              <span
                className="font-medium"
                aria-label={`Rating ${note.rating} of 5`}
              >
                {"★".repeat(note.rating)}
                {"☆".repeat(5 - note.rating)}
              </span>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap">{note.note}</p>
        </li>
      ))}
    </ul>
  );
}
