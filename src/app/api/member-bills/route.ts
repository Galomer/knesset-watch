/**
 * GET /api/member-bills?personID=X          → recent bills list (DB first)
 * GET /api/member-bills?personID=X&count=1  → K25 counts { proposed, passed }
 * GET /api/member-bills?personID=X&career=1 → career stats across all Knessets
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchMemberBills, countMemberBillsK25, billStatusLabel, billStatusCategory, CURRENT_KNESSET } from '@/lib/knesset-api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const personID = Number(searchParams.get('personID'));
  const countOnly = searchParams.get('count') === '1';
  const career = searchParams.get('career') === '1';

  if (!personID) return NextResponse.json([], { status: 400 });

  // ── Career stats across all Knessets ──────────────────────────────────────
  if (career) {
    try {
      const { data, error } = await supabaseAdmin
        .from('bill_initiators')
        .select('bills!inner(bill_id, knesset_num, status_id)')
        .eq('person_id', personID);

      if (!error && data && data.length > 0) {
        // Aggregate by knesset
        const byKnesset = new Map<number, { proposed: number; passed: number }>();
        for (const row of data) {
          const bill = (row.bills as unknown) as { bill_id: number; knesset_num: number; status_id: number };
          const k = bill.knesset_num;
          const cur = byKnesset.get(k) ?? { proposed: 0, passed: 0 };
          cur.proposed++;
          if (bill.status_id === 118) cur.passed++;
          byKnesset.set(k, cur);
        }

        const breakdown = Array.from(byKnesset.entries())
          .map(([knesset, stats]) => ({ knesset, ...stats }))
          .sort((a, b) => b.knesset - a.knesset);

        const total = breakdown.reduce(
          (acc, k) => ({ proposed: acc.proposed + k.proposed, passed: acc.passed + k.passed }),
          { proposed: 0, passed: 0 }
        );

        return NextResponse.json({ total, byKnesset: breakdown });
      }
    } catch { /* fall through */ }

    return NextResponse.json({ total: { proposed: 0, passed: 0 }, byKnesset: [] });
  }

  // ── Bill counts (K25 only) ─────────────────────────────────────────────────
  if (countOnly) {
    try {
      // Count across ALL knessets (not just current)
      const { data, error } = await supabaseAdmin
        .from('bill_initiators')
        .select('bills!inner(bill_id, status_id, knesset_num, is_government)')
        .eq('person_id', personID);

      if (!error && data) {
        type BillRow = { bill_id: number; status_id: number; knesset_num: number; is_government: boolean };
        const bills = data.map(r => (r.bills as unknown) as BillRow);

        const privateB  = bills.filter(b => !b.is_government);
        const govB      = bills.filter(b =>  b.is_government);
        const k25       = bills.filter(b => b.knesset_num === CURRENT_KNESSET);

        return NextResponse.json({
          proposed:         bills.length,
          passed:           bills.filter(b => b.status_id === 118).length,
          privateProposed:  privateB.length,
          privatePassed:    privateB.filter(b => b.status_id === 118).length,
          govProposed:      govB.length,
          govPassed:        govB.filter(b => b.status_id === 118).length,
          k25Proposed:      k25.length,
          k25Passed:        k25.filter(b => b.status_id === 118).length,
        });
      }
    } catch { /* fall through */ }

    // Fallback to live API (K25 only)
    try {
      const counts = await countMemberBillsK25(personID);
      return NextResponse.json({
        ...counts,
        privateProposed: counts.proposed,
        privatePassed:   counts.passed,
        govProposed:     0,
        govPassed:       0,
        k25Proposed:     counts.proposed,
        k25Passed:       counts.passed,
      });
    } catch {
      return NextResponse.json({
        proposed: 0, passed: 0,
        privateProposed: 0, privatePassed: 0,
        govProposed: 0, govPassed: 0,
        k25Proposed: 0, k25Passed: 0,
      });
    }
  }

  // ── Bill list ──────────────────────────────────────────────────────────────
  try {
    const { data, error } = await supabaseAdmin
      .from('bill_initiators')
      .select('bills!inner(bill_id, name, knesset_num, status_id, is_government, publication_date, bill_classifications(*))')
      .eq('person_id', personID)
      .order('bill_id', { ascending: false }); // order on bill_initiators.bill_id — newer bills have higher IDs

    if (!error && data && data.length > 0) {
      const bills = data.map(r => {
        const b = (r.bills as unknown) as {
          bill_id: number; name: string; knesset_num: number;
          status_id: number; is_government: boolean; publication_date: string | null;
          bill_classifications: unknown[] | null;
        };
        const classification = Array.isArray(b.bill_classifications) && b.bill_classifications.length > 0
          ? b.bill_classifications[0]
          : null;
        return {
          BillID: b.bill_id,
          Name: b.name ?? '',
          KnessetNum: b.knesset_num,
          StatusID: b.status_id,
          StatusDesc: billStatusLabel(b.status_id, 'he'),
          StatusDescEn: billStatusLabel(b.status_id, 'en'),
          StatusCategory: billStatusCategory(b.status_id),
          SubTypeDesc: b.is_government ? 'ממשלתית' : 'פרטית',
          IsGovernment: b.is_government,
          PublicationDate: b.publication_date,
          Classification: classification,
        };
      });
      return NextResponse.json(bills, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
    }
  } catch { /* fall through */ }

  // Fallback to live API
  try {
    const bills = await fetchMemberBills(personID);
    return NextResponse.json(bills, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
  } catch {
    return NextResponse.json([]);
  }
}
