<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Compute per-exercise totals and best single-session reps from saved workout history rather than display seed numbers, so records remain truthful in demo and signed-in views.
- Keep account profile and workout reads scoped through the authenticated browser client with row-level ownership rules, while workout scoring and XP/streak writes stay in database triggers; this preserves per-user access boundaries and server-derived progress.
- Store user-facing workout preferences on the owned fitness profile and keep payment enrollment disabled until a real payment provider and checkout flow are configured; this keeps preferences synced without implying that plans can be purchased.
