/**
 * Tiny HTML5 drag-drop helpers used by KanbanBoard, CalendarView, and any
 * future client-side drag interactions. Centralises the JSON serialisation
 * shape so payloads stay typed and safely parsed.
 */

export interface DragPayload {
  itemId: string;
  fromGroup?: string;
  meta?: Record<string, unknown>;
}

const MIME = 'text/plain';

export function setDragData(e: React.DragEvent<HTMLElement>, payload: DragPayload): void {
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData(MIME, JSON.stringify(payload));
}

export function getDragData(e: React.DragEvent<HTMLElement>): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData(MIME);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DragPayload;
    if (typeof parsed?.itemId !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
