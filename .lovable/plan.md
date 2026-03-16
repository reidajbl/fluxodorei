

## Plan: Fix Dashboard Real-time Updates

### Problem
The Dashboard only fetches data on mount and month change. When the user creates/edits/deletes lancamentos on the Lancamentos page and navigates back, the Dashboard shows stale data. Also, the Projecao formula should be `totalContas - aPagar`.

### Changes

**1. `src/pages/Dashboard.tsx`** - Two fixes:

- **Fix projecao formula** (line 102): Change from `totalContas + receitasMes - despesasMes` to `totalContas - aPagar`
- **Add Supabase realtime subscription**: Subscribe to `postgres_changes` on the `lancamentos` table so that any INSERT/UPDATE/DELETE triggers `refetch()` automatically
- **Add `window focus` listener**: When user navigates back to Dashboard from Lancamentos, refetch data on window focus

### Technical Details

```text
Dashboard.tsx changes:
1. resumo.projecao = totalContas - aPagar  (line 102)
2. useEffect with supabase.channel('dashboard-lancamentos')
   .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, refetch)
   .subscribe()
3. useEffect with window 'focus' event → refetch()
4. Cleanup subscriptions on unmount
```

No database changes needed. No new files.

