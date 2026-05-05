import React, { useState, useEffect } from 'react';
import {
  Users, X, Minus, Plus, Package, ArrowLeft, User as UserIcon, Check, Info,
  Lock, Download, Mail, Home, RotateCcw, Pencil
} from 'lucide-react';

/* Inline equal-sign icon (more reliable than lucide's `Equal` which varies by version) */
const EqualIcon = ({ size = 16, strokeWidth = 2.4, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round"
       style={style}>
    <line x1="5" y1="9"  x2="19" y2="9"  />
    <line x1="5" y1="15" x2="19" y2="15" />
  </svg>
);

/* ============================================================
   Color Tokens — exact match to design
   ============================================================ */
const C = {
  primary:        '#0075c9',
  primaryHover:   '#0065ad',
  primaryLight:   '#e6f2fb',
  primaryLight2:  '#f0f8fd',
  primaryBorder:  '#bfddf2',
  textDark:       '#0f1d2e',
  text:           '#1f2a3a',
  textBody:       '#374151',
  textMuted:      '#6b7689',
  textLight:      '#94a0b1',
  border:         '#e5e9ef',
  borderSoft:     '#eef1f5',
  bgSubtle:       '#f3f5f8',
  bgSubtle2:      '#f7f9fb',
  bgPage:         '#eceff3',
  white:          '#ffffff',
  success:        '#22c55e',
  successDark:    '#16a34a',
  successLight:   '#dcfce7',
  successBorder:  '#bbf7d0',
};

/* ============================================================
   Bill Data (realistic restaurant items)
   ============================================================ */
const BILL_ITEMS = [
  { id: 1, name: 'Fettucine Alfredo', price: 33.00, qty: 2 },
  { id: 2, name: 'Brownie Sundae',    price: 33.00, qty: 3 },
  { id: 3, name: 'Lentil Soup',       price: 18.50, qty: 2 },
  { id: 4, name: 'Ice Mojito',        price: 33.00, qty: 2 },
];

const SERVICE_RATE = 0.10;
const VAT_RATE     = 0.05;

const fmt = (n) => `AED ${(Math.round(n * 100) / 100).toFixed(2)}`;
const genTxnId = () =>
  'TXN' + Math.random().toString(36).slice(2, 12).toUpperCase();

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function SplitBillPrototype() {
  // ---- top-level navigation ----
  const [screen, setScreen] = useState('split');           // 'split' | 'processing' | 'success'

  // ---- mode tab ----
  const [mode, setMode] = useState('equally');             // 'equally' | 'item'

  // ---- split equally state ----
  const [equalPeople, setEqualPeople] = useState(2);
  const [equalPaid, setEqualPaid]     = useState([]);      // indices of paid guests

  // ---- split by item state ----
  const [itemStep, setItemStep]               = useState('count'); // 'count' | 'assign' | 'summary' | 'pay'
  const [itemGuestCount, setItemGuestCount]   = useState(3);
  const [itemCurrentIdx, setItemCurrentIdx]   = useState(0);
  const [itemAssignments, setItemAssignments] = useState([{}, {}, {}]);
  const [itemPaid, setItemPaid]               = useState([]);
  const [showAutoAssignNote, setShowAutoAssignNote] = useState(false);

  // ---- payment flow state ----
  const [pendingAmount, setPendingAmount] = useState(0);
  const [pendingGuest, setPendingGuest]   = useState(null); // {mode, idx}
  const [txnId, setTxnId]                 = useState('');
  const [txnDate, setTxnDate]             = useState('');

  /* -------- Bill-level computations -------- */
  const billSubtotal = BILL_ITEMS.reduce((s, it) => s + it.price * it.qty, 0);
  const billService  = billSubtotal * SERVICE_RATE;
  const billVAT      = billSubtotal * VAT_RATE;
  const billTotal    = billSubtotal + billService + billVAT;
  const equalPerPerson = billTotal / equalPeople;

  /* -------- Per-guest computations -------- */
  const guestSubtotal = (idx) => {
    const a = itemAssignments[idx] || {};
    return BILL_ITEMS.reduce((s, it) => s + (a[it.id] || 0) * it.price, 0);
  };
  const guestService = (idx) => guestSubtotal(idx) * SERVICE_RATE;
  const guestVAT     = (idx) => guestSubtotal(idx) * VAT_RATE;
  const guestTotal   = (idx) => guestSubtotal(idx) * (1 + SERVICE_RATE + VAT_RATE);
  const guestItemCount = (idx) => {
    const a = itemAssignments[idx] || {};
    return Object.values(a).reduce((s, v) => s + (v || 0), 0);
  };

  /* -------- Item availability for current guest -------- */
  const usedByOtherGuests = (itemId, currentIdx) => {
    let used = 0;
    itemAssignments.forEach((a, i) => {
      if (i !== currentIdx) used += (a[itemId] || 0);
    });
    return used;
  };
  const remainingForGuest = (itemId, currentIdx) => {
    const item = BILL_ITEMS.find((it) => it.id === itemId);
    return item.qty - usedByOtherGuests(itemId, currentIdx);
  };

  /* -------- Reset everything -------- */
  const resetAll = () => {
    setScreen('split');
    setMode('equally');
    setEqualPeople(2);
    setEqualPaid([]);
    setItemStep('count');
    setItemGuestCount(3);
    setItemCurrentIdx(0);
    setItemAssignments([{}, {}, {}]);
    setItemPaid([]);
    setShowAutoAssignNote(false);
    setPendingGuest(null);
  };

  /* -------- Mode change resets sub-state -------- */
  const switchMode = (m) => {
    setMode(m);
    if (m === 'item') {
      setItemStep('count');
      setShowAutoAssignNote(false);
    }
  };

  /* -------- When guest count changes on the count screen, resize assignments -------- */
  useEffect(() => {
    setItemAssignments((prev) => {
      if (prev.length === itemGuestCount) return prev;
      return Array.from({ length: itemGuestCount }, (_, i) => prev[i] || {});
    });
    if (itemCurrentIdx >= itemGuestCount) setItemCurrentIdx(0);
  }, [itemGuestCount]); // eslint-disable-line

  /* -------- Item-step actions -------- */
  const startAssign = () => {
    setItemAssignments(Array.from({ length: itemGuestCount }, () => ({})));
    setItemCurrentIdx(0);
    setShowAutoAssignNote(false);
    setItemStep('assign');
  };

  const incItem = (itemId) => {
    const max = remainingForGuest(itemId, itemCurrentIdx);
    setItemAssignments((prev) => {
      const next = [...prev];
      const cur = { ...(next[itemCurrentIdx] || {}) };
      const val = cur[itemId] || 0;
      if (val < max) cur[itemId] = val + 1;
      next[itemCurrentIdx] = cur;
      return next;
    });
  };
  const decItem = (itemId) => {
    setItemAssignments((prev) => {
      const next = [...prev];
      const cur = { ...(next[itemCurrentIdx] || {}) };
      const val = cur[itemId] || 0;
      if (val > 0) cur[itemId] = val - 1;
      next[itemCurrentIdx] = cur;
      return next;
    });
  };

  const advanceGuest = () => {
    const nextIdx = itemCurrentIdx + 1;
    if (nextIdx < itemGuestCount) {
      // If we are arriving at the LAST guest, auto-assign all remaining items
      if (nextIdx === itemGuestCount - 1) {
        setItemAssignments((prev) => {
          const copy = [...prev];
          const lastA = { ...(copy[nextIdx] || {}) };
          BILL_ITEMS.forEach((it) => {
            // remaining for this guest, given current copy of assignments
            let used = 0;
            copy.forEach((a, i) => {
              if (i !== nextIdx) used += (a[it.id] || 0);
            });
            lastA[it.id] = it.qty - used;
          });
          copy[nextIdx] = lastA;
          return copy;
        });
        setShowAutoAssignNote(true);
      }
      setItemCurrentIdx(nextIdx);
    } else {
      setItemStep('summary');
      setShowAutoAssignNote(false);
    }
  };

  const goBackGuest = () => {
    if (itemCurrentIdx > 0) {
      setItemCurrentIdx(itemCurrentIdx - 1);
      setShowAutoAssignNote(false);
    } else {
      setItemStep('count');
    }
  };

  /* -------- Payment flow -------- */
  const startPayment = (m, idx) => {
    const amount = m === 'equally' ? equalPerPerson : guestTotal(idx);
    setPendingAmount(amount);
    setPendingGuest({ mode: m, idx });
    setTxnId(genTxnId());
    setTxnDate(new Date().toLocaleString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    }));
    setScreen('processing');
    // simulate processing delay
    setTimeout(() => setScreen('success'), 2500);
  };

  const finishPayment = () => {
    if (pendingGuest) {
      if (pendingGuest.mode === 'equally') {
        setEqualPaid((p) => p.includes(pendingGuest.idx) ? p : [...p, pendingGuest.idx]);
      } else {
        setItemPaid((p) => p.includes(pendingGuest.idx) ? p : [...p, pendingGuest.idx]);
      }
    }
    setPendingGuest(null);
    setScreen('split');
  };

  /* ============================================================
     RENDERERS — one function per visible screen state
     ============================================================ */

  /* ------- Shared bits ------- */
  const Header = ({ title = 'Split the Bill' }) => (
    <div className="flex items-center justify-between px-5 py-4"
         style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
      <div className="flex items-center gap-2.5">
        <Users size={20} strokeWidth={2.4} style={{ color: C.primary }} />
        <span className="font-bold text-[17px]" style={{ color: C.textDark, letterSpacing: '-0.01em' }}>
          {title}
        </span>
      </div>
      <button
        onClick={resetAll}
        aria-label="Close"
        className="p-1 -mr-1 rounded-md transition-colors hover:bg-gray-100"
        style={{ color: C.textLight }}
      >
        <X size={22} strokeWidth={2} />
      </button>
    </div>
  );

  const TotalAmountBlock = ({ amount = billTotal }) => (
    <div className="text-center pt-5 pb-1.5">
      <div className="text-[13px] font-medium" style={{ color: C.textMuted }}>
        Total Amount
      </div>
      <div
        className="font-extrabold mt-1"
        style={{
          color: C.primary,
          fontSize: '38px',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        {fmt(amount)}
      </div>
    </div>
  );

  const TabSwitch = () => (
    <div className="px-5 pt-4 pb-2">
      <div
        className="flex items-center p-1 rounded-full"
        style={{ background: C.bgSubtle }}
      >
        <button
          onClick={() => switchMode('equally')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-full transition-all text-[14px] font-semibold"
          style={{
            background: mode === 'equally' ? C.white : 'transparent',
            color: mode === 'equally' ? C.primary : C.textMuted,
            boxShadow: mode === 'equally' ? '0 1px 3px rgba(15,29,46,0.08)' : 'none',
          }}
        >
          <EqualIcon size={16} strokeWidth={2.4} />
          Split Equally
        </button>
        <button
          onClick={() => switchMode('item')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-full transition-all text-[14px] font-semibold"
          style={{
            background: mode === 'item' ? C.white : 'transparent',
            color: mode === 'item' ? C.primary : C.textMuted,
            boxShadow: mode === 'item' ? '0 1px 3px rgba(15,29,46,0.08)' : 'none',
          }}
        >
          <Package size={15} strokeWidth={2.2} />
          Split by Item
        </button>
      </div>
    </div>
  );

  /* Stepper for the people count */
  const PeopleStepper = ({ value, onMinus, onPlus, label = 'people' }) => (
    <div
      className="flex items-center justify-between rounded-xl px-1 py-3"
      style={{ border: `1px solid ${C.border}`, background: C.white }}
    >
      <button
        onClick={onMinus}
        className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-30"
        style={{ color: C.textMuted }}
        disabled={value <= 1}
        aria-label="Decrease"
      >
        <Minus size={20} strokeWidth={2.2} />
      </button>
      <div className="flex flex-col items-center">
        <span className="font-extrabold text-[26px] leading-none" style={{ color: C.textDark, letterSpacing: '-0.02em' }}>
          {value}
        </span>
        <span className="text-[12px] mt-1" style={{ color: C.textMuted }}>
          {label}
        </span>
      </div>
      <button
        onClick={onPlus}
        className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-gray-50 active:bg-gray-100"
        style={{ color: C.textMuted }}
        aria-label="Increase"
      >
        <Plus size={20} strokeWidth={2.2} />
      </button>
    </div>
  );

  /* Quantity stepper for an item — square blue +/- */
  const ItemStepper = ({ value, onMinus, onPlus, canMinus, canPlus }) => (
    <div className="flex items-center gap-2">
      <button
        onClick={onMinus}
        disabled={!canMinus}
        className="w-8 h-8 flex items-center justify-center rounded-md transition-all"
        style={{
          background: C.primary,
          color: C.white,
          cursor: canMinus ? 'pointer' : 'not-allowed',
        }}
        aria-label="Decrease"
      >
        <Minus size={16} strokeWidth={2.6} />
      </button>
      <span
        className="font-bold text-[15px] w-5 text-center"
        style={{ color: C.textDark }}
      >
        {value}
      </span>
      <button
        onClick={onPlus}
        disabled={!canPlus}
        className="w-8 h-8 flex items-center justify-center rounded-md transition-all"
        style={{
          background: C.primary,
          color: C.white,
          cursor: canPlus ? 'pointer' : 'not-allowed',
        }}
        aria-label="Increase"
      >
        <Plus size={16} strokeWidth={2.6} />
      </button>
    </div>
  );

  /* Guest pay card row */
  const GuestPayRow = ({ idx, label, amount, paid, onPay }) => (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ border: `1px solid ${C.border}`, background: C.white }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: '#eef2f6' }}
      >
        <UserIcon size={20} strokeWidth={2} style={{ color: '#9aa6b6' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[15px]" style={{ color: C.textDark }}>
          {label}
        </div>
        <div className="text-[12.5px] mt-0.5" style={{ color: C.textMuted }}>
          {fmt(amount)}
        </div>
      </div>
      {paid ? (
        <div
          className="px-4 py-2 rounded-lg font-semibold text-[13.5px]"
          style={{
            background: C.primaryLight,
            color: C.primary,
            border: `1px solid ${C.primaryBorder}`,
          }}
        >
          Paid
        </div>
      ) : (
        <button
          onClick={onPay}
          className="px-5 py-2 rounded-lg font-semibold text-[13.5px] transition-colors"
          style={{ background: C.primary, color: C.white }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.primaryHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = C.primary)}
        >
          Pay
        </button>
      )}
    </div>
  );

  /* ============================================================
     SCREEN: Split Equally
     ============================================================ */
  const renderSplitEqually = () => ({
    body: (
      <>
        <TotalAmountBlock />
        <TabSwitch />

        <div className="px-5 pt-3 pb-4">
          <div className="text-center text-[13.5px] mb-3" style={{ color: C.textBody }}>
            Split between how many people?
          </div>
          <PeopleStepper
            value={equalPeople}
            onMinus={() => setEqualPeople((v) => Math.max(1, v - 1))}
            onPlus={() => setEqualPeople((v) => v + 1)}
          />
        </div>

        <div className="px-5">
          <div
            className="rounded-xl py-4 text-center"
            style={{ background: C.bgSubtle }}
          >
            <div className="text-[13px]" style={{ color: C.textMuted }}>
              Each person pays
            </div>
            <div
              className="font-extrabold mt-1"
              style={{ color: C.primary, fontSize: '26px', letterSpacing: '-0.02em' }}
            >
              {fmt(equalPerPerson)}
            </div>
          </div>
        </div>

        <div className="px-5 pt-5 pb-6">
          <div className="text-center text-[13.5px] mb-3" style={{ color: C.textBody }}>
            Select who is paying:
          </div>
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: equalPeople }).map((_, i) => (
              <GuestPayRow
                key={i}
                idx={i}
                label={`Guest ${i + 1}`}
                amount={equalPerPerson}
                paid={equalPaid.includes(i)}
                onPay={() => startPayment('equally', i)}
              />
            ))}
          </div>
        </div>
      </>
    ),
    footer: null,
  });

  /* ============================================================
     SCREEN: Split by Item — Step 1: Choose count
     ============================================================ */
  const renderItemCount = () => ({
    body: (
      <>
        <TotalAmountBlock />
        <TabSwitch />

        <div className="px-5 pt-3 pb-3">
          <div className="text-center text-[13.5px] mb-3" style={{ color: C.textBody }}>
            How many guests will pay?
          </div>
          <PeopleStepper
            value={itemGuestCount}
            onMinus={() => setItemGuestCount((v) => Math.max(2, v - 1))}
            onPlus={() => setItemGuestCount((v) => Math.min(10, v + 1))}
          />
        </div>

        <div className="px-5 pt-2 pb-4">
          <div
            className="flex items-start gap-2.5 p-3 rounded-lg"
            style={{ background: C.primaryLight2, border: `1px solid ${C.primaryBorder}` }}
          >
            <Info size={16} strokeWidth={2.2} className="flex-shrink-0 mt-0.5" style={{ color: C.primary }} />
            <div className="text-[12.5px] leading-snug" style={{ color: C.text }}>
              Since you chose <span className="font-bold" style={{ color: C.primary }}>Split by Item</span>,
              you'll assign specific items to each guest next.
            </div>
          </div>
        </div>
      </>
    ),
    footer: (
      <div className="px-5 py-4">
        <button
          onClick={startAssign}
          className="w-full py-3.5 rounded-xl font-bold text-[15px] transition-colors"
          style={{ background: C.primary, color: C.white }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.primaryHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = C.primary)}
        >
          Continue
        </button>
      </div>
    ),
  });

  /* ============================================================
     SCREEN: Split by Item — Step 2: Assign items per guest
     ============================================================ */
  const renderItemAssign = () => {
    const visibleItems = BILL_ITEMS.filter(
      (it) => remainingForGuest(it.id, itemCurrentIdx) > 0 ||
              ((itemAssignments[itemCurrentIdx] || {})[it.id] || 0) > 0
    );
    const currentTotal = guestTotal(itemCurrentIdx);
    const itemCount = guestItemCount(itemCurrentIdx);

    return {
      body: (
        <>
          <TotalAmountBlock />
          <TabSwitch />

          {/* progress bars */}
          <div className="px-5 pt-3 pb-3 flex gap-1.5">
            {Array.from({ length: itemGuestCount }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-full"
                style={{
                  height: '4px',
                  background: i <= itemCurrentIdx ? C.primary : '#dbe1e9',
                }}
              />
            ))}
          </div>

          {/* now selecting for */}
          <div className="px-5 pb-3">
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: C.primaryLight2, border: `1px solid ${C.primaryBorder}` }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: C.primary }}
              >
                <UserIcon size={17} strokeWidth={2.2} style={{ color: C.white }} />
              </div>
              <div>
                <div className="text-[12.5px] font-semibold" style={{ color: C.primary }}>
                  Now selecting for
                </div>
                <div className="font-bold text-[15px]" style={{ color: C.textDark }}>
                  Guest {itemCurrentIdx + 1}
                </div>
              </div>
            </div>
          </div>

          {/* items list */}
          <div className="px-5">
            <div className="text-center text-[13.5px] mb-3 font-medium" style={{ color: C.textBody }}>
              Set quantity Guest {itemCurrentIdx + 1} is paying for
            </div>

            <div className="flex flex-col gap-2.5">
              {visibleItems.map((it) => {
                const cur = (itemAssignments[itemCurrentIdx] || {})[it.id] || 0;
                const max = remainingForGuest(it.id, itemCurrentIdx);
                return (
                  <div
                    key={it.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ border: `1px solid ${C.border}`, background: C.white }}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-[14.5px]" style={{ color: C.textDark }}>
                        {it.name}
                      </div>
                      <div className="text-[12px] mt-0.5" style={{ color: C.textMuted }}>
                        {fmt(it.price)} · {cur} of {max}
                      </div>
                    </div>
                    <ItemStepper
                      value={cur}
                      onMinus={() => decItem(it.id)}
                      onPlus={() => incItem(it.id)}
                      canMinus={cur > 0}
                      canPlus={cur < max}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* auto-assign note */}
          {itemCurrentIdx === itemGuestCount - 1 && showAutoAssignNote && (
            <div className="px-5 pt-4 pb-2">
              <div
                className="flex items-start gap-2 p-3 rounded-lg shadow-sm"
                style={{
                  background: C.white,
                  border: `1px solid ${C.successBorder}`,
                  borderLeft: `4px solid ${C.success}`,
                }}
              >
                <Check size={16} strokeWidth={2.6} className="flex-shrink-0 mt-0.5" style={{ color: C.success }} />
                <div className="flex-1 text-[12.5px] leading-snug" style={{ color: C.text }}>
                  Remaining items automatically assigned to the last person.
                </div>
                <button
                  onClick={() => setShowAutoAssignNote(false)}
                  className="flex-shrink-0"
                  style={{ color: C.textLight }}
                >
                  <X size={14} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          )}

          <div className="h-3" />
        </>
      ),
      footer: (
        <>
          {/* sticky Owes card */}
          <div className="px-5 pt-3 pb-3">
            <div
              className="flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: C.bgSubtle2, border: `1px solid ${C.border}` }}
            >
              <div>
                <div className="font-bold text-[14.5px]" style={{ color: C.textDark }}>
                  Guest {itemCurrentIdx + 1} Owes
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: C.textMuted }}>
                  {itemCount} item{itemCount === 1 ? '' : 's'} selected
                </div>
              </div>
              <div className="font-extrabold text-[18px]" style={{ color: C.textDark, letterSpacing: '-0.01em' }}>
                {fmt(currentTotal)}
              </div>
            </div>
          </div>

          {/* sticky action buttons */}
          <div className="px-5 pb-4 flex gap-2.5" style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: '12px' }}>
            <button
              onClick={goBackGuest}
              aria-label="Back"
              className="flex items-center justify-center rounded-xl transition-colors"
              style={{
                width: 52,
                background: C.white,
                color: C.textBody,
                border: `1px solid ${C.border}`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.bgSubtle2)}
              onMouseLeave={(e) => (e.currentTarget.style.background = C.white)}
            >
              <ArrowLeft size={18} strokeWidth={2.2} />
            </button>
            <button
              onClick={advanceGuest}
              className="flex-1 py-3 rounded-xl font-bold text-[14.5px] transition-colors"
              style={{ background: C.primary, color: C.white }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.primaryHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = C.primary)}
            >
              Next Person
            </button>
          </div>
        </>
      ),
    };
  };

  /* ============================================================
     SCREEN: Split by Item — Step 3: Summary
     ============================================================ */
  const renderItemSummary = () => ({
    body: (
      <>
        <TotalAmountBlock />
        <TabSwitch />

        <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
          {Array.from({ length: itemGuestCount }).map((_, idx) => {
            const a = itemAssignments[idx] || {};
            const sub = guestSubtotal(idx);
            const svc = guestService(idx);
            const vat = guestVAT(idx);
            const tot = guestTotal(idx);
            const myItems = BILL_ITEMS
              .map((it) => ({ ...it, q: a[it.id] || 0 }))
              .filter((it) => it.q > 0);
            return (
              <div
                key={idx}
                className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${C.border}`, background: C.white }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: C.primaryLight2, borderBottom: `1px solid ${C.primaryBorder}` }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center"
                      style={{ background: C.primary }}
                    >
                      <UserIcon size={14} strokeWidth={2.4} style={{ color: C.white }} />
                    </div>
                    <span className="font-bold text-[14.5px]" style={{ color: C.primary }}>
                      Guest {idx + 1}
                    </span>
                  </div>
                  <span className="font-extrabold text-[15.5px]" style={{ color: C.textDark, letterSpacing: '-0.01em' }}>
                    {fmt(tot)}
                  </span>
                </div>

                <div className="px-4 py-3">
                  <div className="text-[12px] font-semibold mb-2" style={{ color: C.textMuted }}>
                    Items
                  </div>
                  <div className="flex flex-col gap-2 mb-3">
                    {myItems.length === 0 && (
                      <div className="text-[13px]" style={{ color: C.textLight }}>
                        No items assigned
                      </div>
                    )}
                    {myItems.map((it) => (
                      <div key={it.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[11.5px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              background: C.primaryLight2,
                              color: C.primary,
                              border: `1px solid ${C.primaryBorder}`,
                            }}
                          >
                            {it.q}x
                          </span>
                          <span className="text-[13.5px]" style={{ color: C.textDark }}>
                            {it.name}
                          </span>
                        </div>
                        <span className="text-[13px] font-medium" style={{ color: C.textDark }}>
                          {fmt(it.q * it.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: `1px dashed ${C.border}` }} className="pt-2.5 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span style={{ color: C.textMuted }}>Subtotal:</span>
                      <span style={{ color: C.textBody, fontWeight: 500 }}>{fmt(sub)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span style={{ color: C.textMuted }}>Service Charge (10%):</span>
                      <span style={{ color: C.textBody, fontWeight: 500 }}>{fmt(svc)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span style={{ color: C.textMuted }}>VAT (5%):</span>
                      <span style={{ color: C.textBody, fontWeight: 500 }}>{fmt(vat)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    ),
    footer: (
      <div className="px-5 py-4 flex gap-2.5" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
        <button
          onClick={() => {
            setItemCurrentIdx(itemGuestCount - 1);
            setItemStep('assign');
          }}
          aria-label="Edit assignments"
          className="flex items-center justify-center rounded-xl transition-colors"
          style={{
            width: 52,
            background: C.primaryLight2,
            color: C.primary,
            border: `1px solid ${C.primaryBorder}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.primaryLight)}
          onMouseLeave={(e) => (e.currentTarget.style.background = C.primaryLight2)}
        >
          <Pencil size={17} strokeWidth={2.4} />
        </button>
        <button
          onClick={() => setItemStep('pay')}
          className="flex-1 py-3 rounded-xl font-bold text-[14.5px] transition-colors"
          style={{ background: C.primary, color: C.white }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.primaryHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = C.primary)}
        >
          Confirm &amp; Create Assignments
        </button>
      </div>
    ),
  });

  /* ============================================================
     SCREEN: Split by Item — Step 4: Pay
     ============================================================ */
  const renderItemPay = () => ({
    body: (
      <>
        <TotalAmountBlock />
        <TabSwitch />

        <div className="px-5 pt-3">
          <div className="text-center text-[13.5px] mb-2" style={{ color: C.textBody }}>
            How many guests will split?
          </div>
          <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: C.primaryLight2, border: `1px solid ${C.primaryBorder}` }}
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: C.white, border: `1px solid ${C.primaryBorder}` }}
            >
              <Users size={17} strokeWidth={2.2} style={{ color: C.primary }} />
            </div>
            <div className="font-medium text-[14px]" style={{ color: C.text }}>
              <span className="font-extrabold text-[18px]" style={{ color: C.primary }}>{itemGuestCount}</span>
              {'  '}guests will split this bill
            </div>
          </div>
        </div>

        <div className="px-5 pt-4 pb-6">
          <div className="text-center text-[13.5px] mb-3" style={{ color: C.textBody }}>
            Select who is paying:
          </div>
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: itemGuestCount }).map((_, i) => (
              <GuestPayRow
                key={i}
                idx={i}
                label={`Guest ${i + 1}`}
                amount={guestTotal(i)}
                paid={itemPaid.includes(i)}
                onPay={() => startPayment('item', i)}
              />
            ))}
          </div>
        </div>
      </>
    ),
    footer: (
      <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.borderSoft}` }}>
        <button
          onClick={() => setItemStep('summary')}
          className="w-full py-3 rounded-xl font-bold text-[14.5px] transition-colors"
          style={{ background: C.primary, color: C.white }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.primaryHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = C.primary)}
        >
          Back to Summary
        </button>
      </div>
    ),
  });

  /* ============================================================
     SCREEN: Processing Payment
     ============================================================ */
  const renderProcessing = () => (
    <div
      className="flex flex-col h-full"
      style={{ background: C.white }}
    >
      {/* header */}
      <div
        className="flex items-center px-5 py-4"
        style={{ borderBottom: `1px solid ${C.borderSoft}` }}
      >
        <button
          onClick={() => {/* disabled during processing */}}
          className="p-1 -ml-1"
          style={{ color: C.textBody, opacity: 0.4, cursor: 'not-allowed' }}
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <div className="flex-1 text-center font-bold text-[16px]" style={{ color: C.textDark }}>
          Payment
        </div>
        <div style={{ width: 22 }} />
      </div>

      {/* gradient body */}
      <div
        className="flex-1 flex flex-col items-center pt-12 px-6 relative overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${C.bgSubtle2} 0%, ${C.white} 60%, ${C.bgSubtle2} 100%)`,
        }}
      >
        {/* spinner */}
        <div className="relative" style={{ width: 130, height: 130 }}>
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: C.primaryLight2, opacity: 0.85 }}
          />
          <svg
            className="absolute inset-0"
            viewBox="0 0 100 100"
            style={{ animation: 'sb-spin 0.9s linear infinite' }}
          >
            <circle
              cx="50" cy="50" r="38"
              fill="none"
              stroke={C.primary}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="60 200"
            />
          </svg>
        </div>

        <div className="text-[15px] mt-7" style={{ color: C.textMuted }}>
          Processing Payment
        </div>
        <div
          className="font-extrabold mt-2"
          style={{ color: C.textDark, fontSize: '34px', letterSpacing: '-0.02em' }}
        >
          {fmt(pendingAmount)}
        </div>
        <div className="text-[12.5px] mt-1.5" style={{ color: C.textLight }}>
          Transaction ID: #{txnId.slice(0, 12)}
        </div>

        {/* secure box */}
        <div
          className="mt-9 p-3.5 rounded-xl flex items-start gap-3 w-full"
          style={{
            background: C.successLight,
            border: `1px solid ${C.successBorder}`,
          }}
        >
          <Lock size={18} strokeWidth={2.2} className="flex-shrink-0 mt-0.5" style={{ color: C.successDark }} />
          <div>
            <div className="font-bold text-[13.5px]" style={{ color: C.textDark }}>
              Secure Payment
            </div>
            <div className="text-[12px] mt-1 leading-snug" style={{ color: C.textBody }}>
              Your payment is protected with 256-bit SSL encryption
            </div>
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="px-5 pb-4 pt-2" style={{ background: C.white }}>
        <button
          disabled
          className="w-full py-3.5 rounded-xl font-semibold text-[14.5px] cursor-not-allowed"
          style={{ background: C.bgSubtle, color: C.textLight }}
        >
          Cancel Payment
        </button>
        <div className="text-center text-[12px] mt-2" style={{ color: C.textLight }}>
          Please wait while we process your payment
        </div>
      </div>
    </div>
  );

  /* ============================================================
     SCREEN: Payment Successful
     ============================================================ */
  const renderSuccess = () => (
    <div
      className="flex flex-col h-full"
      style={{ background: C.bgSubtle2 }}
    >
      {/* Scrollable area: success block + transaction details */}
      <div className="flex-1 overflow-y-auto sb-scroll">
        <div className="px-6 pt-9 pb-5 flex flex-col items-center">
          {/* success ring with subtle glow */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: C.successLight,
                transform: 'scale(1.5)',
                filter: 'blur(20px)',
                opacity: 0.6,
              }}
            />
            <div
              className="relative rounded-full flex items-center justify-center"
              style={{
                width: 78,
                height: 78,
                background: `linear-gradient(140deg, ${C.success} 0%, ${C.successDark} 100%)`,
                boxShadow: '0 10px 25px -8px rgba(34,197,94,0.5)',
                animation: 'sb-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <Check size={36} strokeWidth={3.2} style={{ color: C.white }} />
            </div>
          </div>

          <h2 className="font-extrabold mt-5 text-center" style={{ color: C.textDark, fontSize: '24px', letterSpacing: '-0.02em' }}>
            Payment Successful!
          </h2>
          <div className="text-[14px] mt-1.5" style={{ color: C.textMuted }}>
            Your order has been placed
          </div>
        </div>

        <div className="px-5 pb-4">
          <div
            className="rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: C.white, boxShadow: '0 4px 16px -8px rgba(15,29,46,0.1)' }}
          >
            <Detail label="Transaction ID" value={txnId} mono />
            <Divider />
            <Detail label="Date & Time" value={txnDate} />
            <Divider />
            <Detail label="Amount Paid" value={fmt(pendingAmount)} success />
            <Divider />
            <Detail label="Payment Method" value="Card" />
            <Divider />
            <Detail label="Table Number" value="Table 3" />
          </div>
        </div>
      </div>

      {/* Sticky bottom action buttons */}
      <div
        className="px-5 pb-5 pt-4 flex flex-col gap-2.5 flex-shrink-0"
        style={{
          background: C.bgSubtle2,
          boxShadow: '0 -8px 16px -12px rgba(15,29,46,0.08)',
        }}
      >
        <button
          onClick={() => {/* mock print */}}
          className="w-full py-3 rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2"
          style={{
            background: C.white,
            color: C.textBody,
            border: `1px solid ${C.border}`,
          }}
        >
          <Download size={17} strokeWidth={2} />
          Print Merchant Receipt
        </button>
        <button
          onClick={() => {/* mock email */}}
          className="w-full py-3 rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2"
          style={{
            background: C.white,
            color: C.textBody,
            border: `1px solid ${C.border}`,
          }}
        >
          <Mail size={17} strokeWidth={2} />
          Print Customer Receipt
        </button>
        <button
          onClick={finishPayment}
          className="w-full py-3.5 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 transition-colors"
          style={{ background: C.primary, color: C.white }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.primaryHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = C.primary)}
        >
          <Home size={17} strokeWidth={2.2} />
          Back to Home
        </button>
      </div>
    </div>
  );

  const Detail = ({ label, value, mono, success }) => (
    <div>
      <div className="text-[12.5px]" style={{ color: C.textMuted }}>
        {label}
      </div>
      <div
        className="mt-1 font-bold text-[15px]"
        style={{
          color: success ? C.successDark : C.textDark,
          fontFamily: mono ? 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
          letterSpacing: mono ? '0.02em' : '-0.005em',
        }}
      >
        {value}
      </div>
    </div>
  );

  const Divider = () => (
    <div style={{ height: 1, background: C.borderSoft }} />
  );

  /* ============================================================
     ROOT RENDER
     ============================================================ */
  const renderModalContent = () => {
    if (mode === 'equally') return renderSplitEqually();
    if (itemStep === 'count')   return renderItemCount();
    if (itemStep === 'assign')  return renderItemAssign();
    if (itemStep === 'summary') return renderItemSummary();
    if (itemStep === 'pay')     return renderItemPay();
    return { body: null, footer: null };
  };

  /* -------- PWA install prompt state -------- */
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  /* -------- Install prompt + standalone detection --------
     (Manifest, service worker, and meta tags are wired in index.html / main.jsx) */
  useEffect(() => {
    const checkStandalone = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(checkStandalone());

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try {
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') setInstallPrompt(null);
    } catch (e) {}
  };

  const { body: screenBody, footer: screenFooter } =
    screen === 'split' ? renderModalContent() : { body: null, footer: null };

  return (
    <div
      className="w-full min-h-screen flex flex-col items-center justify-start py-8 px-4 font-manrope"
      style={{
        background: `radial-gradient(ellipse at top, #f0f3f8 0%, #e3e7ee 100%)`,
      }}
    >
      {/* Font + animation styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
        .font-manrope { font-family: 'Manrope', system-ui, -apple-system, sans-serif; }
        @keyframes sb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sb-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes sb-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sb-screen { animation: sb-fade-in 0.28s ease-out; }
        /* hide scrollbar inside phone for cleaner look but keep functionality */
        .sb-scroll::-webkit-scrollbar { width: 0; height: 0; }
        .sb-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        @media (display-mode: standalone) {
          body { overscroll-behavior-y: contain; }
        }
      `}</style>

      {/* Phone frame */}
      <div
        className="relative flex flex-col font-manrope sb-screen"
        key={`${screen}-${mode}-${itemStep}-${itemCurrentIdx}`}
        style={{
          width: 392,
          height: 760,
          maxHeight: 'calc(100vh - 80px)',
          background: C.white,
          borderRadius: 36,
          boxShadow:
            '0 30px 60px -25px rgba(15,29,46,0.25), 0 0 0 1px rgba(15,29,46,0.04), inset 0 0 0 8px #1a1f2c',
          overflow: 'hidden',
          padding: '8px',
        }}
      >
        <div
          className="flex flex-col flex-1 overflow-hidden"
          style={{
            background: screen === 'success' ? C.bgSubtle2 : C.white,
            borderRadius: 28,
            position: 'relative',
          }}
        >
          {screen === 'split' && (
            <>
              {/* Sticky header */}
              <div className="flex-shrink-0" style={{ background: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
                <Header />
              </div>

              {/* Scrollable middle */}
              <div className="flex-1 overflow-y-auto sb-scroll">
                {screenBody}
              </div>

              {/* Sticky footer (if any) */}
              {screenFooter && (
                <div
                  className="flex-shrink-0"
                  style={{
                    background: C.white,
                    borderBottomLeftRadius: 28,
                    borderBottomRightRadius: 28,
                    boxShadow: '0 -8px 16px -12px rgba(15,29,46,0.08)',
                  }}
                >
                  {screenFooter}
                </div>
              )}
            </>
          )}
          {screen === 'processing' && renderProcessing()}
          {screen === 'success'    && renderSuccess()}
        </div>
      </div>

      {/* Designer/dev controls — outside the phone frame */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={resetAll}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.7)',
              color: C.textBody,
              border: '1px solid rgba(15,29,46,0.08)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <RotateCcw size={14} strokeWidth={2.2} />
            Reset Prototype
          </button>

          {installPrompt && !isStandalone && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold transition-all"
              style={{
                background: C.primary,
                color: C.white,
                boxShadow: '0 6px 16px -6px rgba(0,117,201,0.5)',
              }}
            >
              <Download size={14} strokeWidth={2.4} />
              Install App
            </button>
          )}

          {isStandalone && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-full text-[12px] font-semibold"
              style={{
                background: C.successLight,
                color: C.successDark,
                border: `1px solid ${C.successBorder}`,
              }}
            >
              <Check size={13} strokeWidth={2.6} />
              Installed · Running as PWA
            </div>
          )}
        </div>

        <div className="text-[11.5px] text-center max-w-md leading-relaxed" style={{ color: '#6b7689' }}>
          Tap <strong>Pay</strong> to trigger the processing→success flow ·
          Switch tabs to test <strong>Split by Item</strong> with full guest assignment ·
          Last guest auto-receives remaining items ·
          <strong> PWA</strong>: installable on mobile &amp; desktop with offline cache
        </div>
      </div>
    </div>
  );
}
