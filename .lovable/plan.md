

## Plan: Mobile/Tablet Responsiveness for Lancamentos

### What changes

**1. `src/components/lancamentos/LancamentosList.tsx` -- Mobile card layout**
- On screens < 640px (`sm` breakpoint), switch each lancamento row from the current horizontal `flex items-center justify-between` layout to a vertical card layout:
  - Top row: icon + description + fixed badge
  - Middle row: category + account name
  - Bottom row: value (left) + status badge + action buttons (right)
- Action buttons get `h-9 w-9` on mobile (min 36px touch target) instead of current `h-7 w-7`
- Use Tailwind responsive classes (`sm:flex-row`, `flex-col`, etc.) -- no separate component needed, just conditional classes on the existing markup
- Add a subtle border/card style per item on mobile for visual separation

**2. `src/pages/Lancamentos.tsx` -- Filter tabs horizontal scroll on mobile**
- Wrap filter tabs in a horizontal scroll container on mobile: `overflow-x-auto flex-nowrap` with `flex-wrap` only on `sm:` and above
- Add `whitespace-nowrap` and `scrollbar-hide` to prevent wrapping on small screens
- Header buttons ("+ Receita", "- Despesa"): use icon-only on mobile (`sm:` show text)

**3. `src/pages/Dashboard.tsx` -- Same responsive improvements**
- Apply same filter tab scroll and any shared lancamento list improvements (since Dashboard also uses `LancamentosList`)

### Technical approach
- Pure Tailwind responsive classes, no CSS media queries or separate components
- Breakpoint: `sm:` (640px) for card-vs-row switch
- No structural changes to data flow or props

### Files modified
1. `src/components/lancamentos/LancamentosList.tsx` -- card layout on mobile, bigger touch targets
2. `src/pages/Lancamentos.tsx` -- scrollable filters, compact header buttons on mobile
3. `src/pages/Dashboard.tsx` -- scrollable filters on mobile

