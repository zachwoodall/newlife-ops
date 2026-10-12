import { toggleReaction } from "./actions";

export type ReactionSummary = {
  emoji: string;
  count: number;
  mine: boolean;
  who: string;
};

/** The small set offered inline; anything already used is also shown. */
export const QUICK = ["👍", "🙏", "🎉", "👀"];

export function Reactions({
  commentId,
  taskId,
  summary,
}: {
  commentId: string;
  taskId: string;
  summary: ReactionSummary[];
}) {
  const used = new Set(summary.map((s) => s.emoji));
  const offer = QUICK.filter((e) => !used.has(e));

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {summary.map((s) => (
        <form key={s.emoji} action={toggleReaction}>
          <input type="hidden" name="task_id" value={taskId} />
          <input type="hidden" name="comment_id" value={commentId} />
          <input type="hidden" name="emoji" value={s.emoji} />
          <button
            type="submit"
            title={s.who}
            aria-pressed={s.mine}
            aria-label={`${s.emoji} ${s.count}. ${s.who}`}
            className={
              s.mine
                ? "border-brand-500 bg-brand-50 text-brand-900 rounded-full border px-2 py-0.5 text-xs dark:bg-neutral-800 dark:text-neutral-100"
                : "border-border hover:border-brand-500 rounded-full border px-2 py-0.5 text-xs"
            }
          >
            {s.emoji} {s.count}
          </button>
        </form>
      ))}

      <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {offer.map((e) => (
          <form key={e} action={toggleReaction} className="inline">
            <input type="hidden" name="task_id" value={taskId} />
            <input type="hidden" name="comment_id" value={commentId} />
            <input type="hidden" name="emoji" value={e} />
            <button
              type="submit"
              aria-label={`React with ${e}`}
              className="text-muted hover:bg-brand-50 rounded-full px-1.5 py-0.5 text-xs dark:hover:bg-neutral-800"
            >
              {e}
            </button>
          </form>
        ))}
      </span>
    </div>
  );
}
