import { useState, type ReactNode } from 'react';
import { Spinner } from './ui';

export interface BoardColumn<T> {
  /** The status this column stands for. Handed back to `onMove`. */
  key: string;
  label: string;
  /** Tailwind background for the dot beside the column name. */
  dot: string;
  items: T[];
  /**
   * False when this viewer may not move a card here — the reporter of a ticket, for
   * instance, cannot declare it Resolved. A blocked column refuses the drop rather
   * than letting the card land and bounce back when the server says no.
   */
  droppable?: boolean;
}

interface Props<T> {
  columns: BoardColumn<T>[];
  getId: (item: T) => number;
  /** Used for the drag announcement and the card's accessible name. */
  getLabel: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  /** Called when a card lands in a different column. */
  onMove: (item: T, toColumn: string) => void;
  /** Card currently waiting on the server, shown with a spinner. */
  busyId?: number | null;
  emptyLabel?: string;
}

/**
 * A Kanban board: one column per status, cards dragged between them.
 *
 * Drag and drop is mouse-only, so it is never the only way to move a card. Every card
 * is focusable and answers Ctrl/Cmd + arrow keys, and the underlying status control
 * still lives on the matching list page. The board is a faster way to do what the app
 * could already do, not a new place where some work can only be done with a mouse.
 *
 * Uses the platform's own drag events rather than a drag-and-drop library — the
 * behaviour needed here is a card, a column, and a drop.
 */
export function Board<T>({
  columns, getId, getLabel, renderCard, onMove, busyId = null, emptyLabel = 'Nothing here',
}: Props<T>) {
  /** The card being dragged, with the column it started in. */
  const [dragging, setDragging] = useState<{ id: number; from: string } | null>(null);
  /** The column the pointer is currently over, for the drop highlight. */
  const [over, setOver] = useState<string | null>(null);

  const canDrop = (column: BoardColumn<T>) =>
    Boolean(dragging) && dragging?.from !== column.key && column.droppable !== false;

  /** Ctrl/Cmd + ← / → moves a card to the nearest droppable column in that direction. */
  const moveByKey = (item: T, fromIndex: number, direction: -1 | 1) => {
    for (let i = fromIndex + direction; i >= 0 && i < columns.length; i += direction) {
      if (columns[i].droppable !== false) {
        onMove(item, columns[i].key);
        return;
      }
    }
  };

  return (
    <div className="flex items-stretch gap-4 overflow-x-auto p-4">
      {columns.map((column, columnIndex) => {
        const active = over === column.key && canDrop(column);
        return (
          <section
            key={column.key}
            onDragOver={(e) => {
              if (!canDrop(column)) return;
              // Without this the browser refuses the drop entirely.
              e.preventDefault();
              setOver(column.key);
            }}
            onDragLeave={() => setOver((prev) => (prev === column.key ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (!dragging || !canDrop(column)) return;
              const item = columns
                .flatMap((c) => c.items)
                .find((candidate) => getId(candidate) === dragging.id);
              setDragging(null);
              if (item) onMove(item, column.key);
            }}
            className={`flex w-72 shrink-0 flex-col rounded-xl border p-3 transition-colors ${
              active ? 'border-primary bg-primary/10' : 'border-border bg-muted/50'
            }`}
          >
            <header className="mb-3 flex items-center gap-2 px-1">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${column.dot}`} aria-hidden />
              <h3 className="min-w-0 truncate text-sm font-bold text-foreground">{column.label}</h3>
              <span className="shrink-0 rounded-full bg-border px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {column.items.length}
              </span>
            </header>

            <div className="flex min-h-[4rem] flex-1 flex-col gap-2.5">
              {column.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  {active ? 'Drop here' : emptyLabel}
                </p>
              ) : (
                column.items.map((item) => {
                  const id = getId(item);
                  const busy = busyId === id;
                  return (
                    <article
                      key={id}
                      draggable={!busy}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        // Firefox will not start a drag without payload on the event.
                        e.dataTransfer.setData('text/plain', String(id));
                        setDragging({ id, from: column.key });
                      }}
                      onDragEnd={() => { setDragging(null); setOver(null); }}
                      tabIndex={0}
                      aria-label={`${getLabel(item)} — in ${column.label}. Press Control and an arrow key to move it.`}
                      onKeyDown={(e) => {
                        if (!(e.ctrlKey || e.metaKey)) return;
                        if (e.key === 'ArrowLeft') { e.preventDefault(); moveByKey(item, columnIndex, -1); }
                        if (e.key === 'ArrowRight') { e.preventDefault(); moveByKey(item, columnIndex, 1); }
                      }}
                      className={`relative cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        busy ? 'opacity-60' : 'hover:shadow-md active:cursor-grabbing'
                      } ${dragging?.id === id ? 'opacity-40' : ''}`}
                    >
                      {busy && (
                        <span className="absolute right-2 top-2 text-muted-foreground">
                          <Spinner className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {renderCard(item)}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
