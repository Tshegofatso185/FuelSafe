"use client";

import { PiggyBank, Wallet } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { planFuelSpend, SPEND_PRESETS } from "@/lib/budget";
import { moneyFormat, numberFormat, type FuelMetrics, type FuelProfile } from "@/lib/fuel";

export default function FuelBudgetPanel({
  profile,
  metrics,
  priceLoading = false,
}: {
  profile: FuelProfile;
  metrics: FuelMetrics;
  priceLoading?: boolean;
}) {
  const [spend, setSpend] = useState(200);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOther = !SPEND_PRESETS.includes(spend);
  const plan = useMemo(() => planFuelSpend(profile, metrics, spend), [profile, metrics, spend]);

  return (
    <section className="panel budget-card" aria-labelledby="budget-title">
      <div className="panel-heading">
        <div>
          <span className="small-icon yellow"><Wallet size={17} /></span>
          <div>
            <h3 id="budget-title">Plan with what you have</h3>
            <p>Start with the rand, not the tank.</p>
          </div>
        </div>
      </div>

      <label className="budget-spend-field" htmlFor="budget-spend">
        <span>How much can you spend on fuel?</span>
        <span className="budget-spend-input">
          <span>R</span>
          <input
            ref={inputRef}
            id="budget-spend"
            type="number"
            min={0}
            step={10}
            inputMode="numeric"
            value={spend}
            onChange={(event) => setSpend(Math.max(0, Number(event.currentTarget.value) || 0))}
          />
        </span>
      </label>

      <div className="budget-presets" role="group" aria-label="Quick amounts">
        {SPEND_PRESETS.map((amount) => (
          <button
            key={amount}
            type="button"
            className={spend === amount ? "active" : undefined}
            onClick={() => setSpend(amount)}
          >
            R{amount}
          </button>
        ))}
        <button
          type="button"
          className={`budget-other${isOther ? " active" : ""}`}
          onClick={() => {
            setSpend(0);
            // Wait for the value to update, then focus the box to type.
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          Other amount
        </button>
      </div>

      {metrics.pricePerLitre === null ? (
        <p className="budget-unavailable">
          {priceLoading ? "Loading today’s fuel price…" : "Fuel price unavailable, so we can’t estimate this yet."}
        </p>
      ) : plan ? (
        <>
          <div className="budget-results">
            <div className="budget-result-main">
              <span>YOU CAN BUY</span>
              <strong>{numberFormat(plan.litres, 1)} <small>L</small></strong>
              <p>{moneyFormat(metrics.pricePerLitre, 2)} per litre</p>
            </div>
            <div className="budget-result">
              <span>ADDS ABOUT</span>
              <strong>{numberFormat(plan.km)} <small>km</small></strong>
              <p>of driving range</p>
            </div>
            <div className="budget-result">
              <span>TANK AFTER</span>
              <strong>{numberFormat(plan.percentAfter)}<small>%</small></strong>
              <p>{numberFormat(plan.tankAfter, 1)} L in total</p>
            </div>
          </div>

          {plan.fillsTank && plan.change >= 1 && (
            <p className="budget-change">
              <PiggyBank size={14} /> This fills your tank and leaves about {moneyFormat(plan.change, 0)}.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
