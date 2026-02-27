import React, { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { ABIS, ADDRESSES } from "../web3/contracts";
import { useLaunchCount } from "../web3/hooks";

function IgnitionPage() {
  const { data: launchCount } = useLaunchCount();
  const count = Number(launchCount ?? 0n);
  const launchIds = useMemo(
    () => Array.from({ length: count }, (_, i) => i),
    [count]
  );
  const { data: launchReads } = useReadContracts({
    contracts: ADDRESSES.ignition
      ? launchIds.map((id) => ({
          address: ADDRESSES.ignition,
          abi: ABIS.ignition,
          functionName: "getLaunch",
          args: [BigInt(id)],
        }))
      : [],
    query: {
      enabled: !!ADDRESSES.ignition && launchIds.length > 0,
      refetchInterval: 15_000,
    },
  });

  const activeIgnition = useMemo(() => {
    return (launchReads ?? [])
      .map((entry, idx) => ({
        id: launchIds[idx],
        launch: entry?.result ?? entry,
      }))
      .filter((row) => row.launch)
      .filter((row) => {
        const graduatedAt = Number(row.launch.graduatedAt ?? row.launch[8] ?? 0n);
        return graduatedAt === 0;
      });
  }, [launchReads, launchIds]);

  return (
    <div className="container page">
      <div className="page-header">
        <h1 className="page-title">Veritas Ignition</h1>
        <p className="page-sub">Permissionless launch flow with graduation and governance controls.</p>
      </div>

      <div className="ignition-layout">
        <section className="card ignition-form">
          <div className="section-label">Launch Workflow</div>
          <div className="wizard-steps">
            {["Market Question", "Category & Dates", "Oracle Setup", "Review & Launch"].map((step, i) => (
              <div className="ws-item" key={step}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
          <div className="form-grid">
            <div>
              <label className="inp-label">Market Question</label>
              <input className="inp" placeholder="Will X happen before Y?" />
            </div>
            <div>
              <label className="inp-label">Category</label>
              <input className="inp" placeholder="Macro / Crypto / Politics / Tech" />
            </div>
            <div>
              <label className="inp-label">Resolution Date</label>
              <input className="inp" placeholder="YYYY-MM-DD" />
            </div>
            <div>
              <label className="inp-label">Creation Fee</label>
              <input className="inp" value="$50 USDC" readOnly />
            </div>
          </div>
          <button className="btn btn-primary">Launch Market - $50</button>
        </section>

        <aside className="side-stack">
          <article className="card side-card">
            <div className="section-label">Active Ignition Markets</div>
            {activeIgnition.map((row) => (
              <div className="ignition-item" key={row.id}>
                <p>{row.launch.question ?? row.launch[0]}</p>
                <small>
                  TVL ${(Number(row.launch.tvl ?? row.launch[5] ?? 0n) / 1e6).toFixed(2)} USDC ·
                  Participants {Number(row.launch.participants ?? row.launch[6] ?? 0n)}
                </small>
              </div>
            ))}
            {activeIgnition.length === 0 && (
              <p className="text-soft" style={{ margin: 0 }}>
                No ignition markets active
              </p>
            )}
          </article>
          <article className="card side-card">
            <div className="section-label">How Ignition Works</div>
            <ul>
              <li>$50 creation fee</li>
              <li>50/50 neutral bootstrap</li>
              <li>Graduation by TVL and participant thresholds</li>
              <li>Escrowed fee injection to minority side</li>
            </ul>
          </article>
        </aside>
      </div>
    </div>
  );
}

export default IgnitionPage;
