import React, { useMemo, useState } from "react";
import { useReadContracts } from "wagmi";
import { ABIS, ADDRESSES } from "../web3/contracts";
import { useLaunchCount } from "../web3/hooks";
import ProposeModal from "../components/ProposeModal";

const STATUS = ["Pending", "Active", "Graduated", "Expired", "Rejected"];

function statusName(raw) {
  const idx = Number(raw ?? 0);
  return STATUS[idx] ?? `Unknown(${idx})`;
}

function IgnitionPage({ onOpenLaunch }) {
  const [showPropose, setShowPropose] = useState(false);
  const { data: launchCount } = useLaunchCount();
  const count = Number(launchCount ?? 0n);
  const launchIds = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

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
      refetchInterval: 10_000,
    },
  });

  const rows = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return (launchReads ?? [])
      .map((entry, idx) => {
        const launch = entry?.result ?? entry;
        if (!launch) return null;
        const question = launch.question ?? launch[0];
        const status = Number(launch.status ?? launch[4] ?? 0n);
        const tvl = Number(launch.tvl ?? launch[5] ?? 0n) / 1e6;
        const participants = Number(launch.participants ?? launch[6] ?? 0n);
        const expiresAt = Number(launch.expiresAt ?? launch[3] ?? 0n);
        const market = launch.market ?? launch[7];
        const days = Math.max(0, Math.ceil((expiresAt - now) / 86400));
        return {
          id: launchIds[idx],
          question,
          status,
          tvl,
          participants,
          days,
          market,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.id - a.id);
  }, [launchReads, launchIds]);

  const activeCount = rows.filter((r) => r.status === 1).length;

  return (
    <div className="container page">
      <div className="page-header">
        <h1 className="page-title">Veritas Ignition</h1>
        <p className="page-sub">Permissionless launches start on a virtual bonding curve, then graduate to live AMM/CLOB markets.</p>
      </div>

      <div className="card tab-card">
        <div className="section-label">Ignition Overview</div>
        <div className="stats-inline">
          <div>
            <label>Total launches</label>
            <strong>{rows.length}</strong>
          </div>
          <div>
            <label>Active launches</label>
            <strong>{activeCount}</strong>
          </div>
          <div>
            <label>Creation fee</label>
            <strong>$50</strong>
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowPropose(true)}>
          Propose Market ($50)
        </button>
      </div>

      <section className="card tab-card" style={{ marginTop: 12 }}>
        <div className="section-label">How Ignition Works</div>
        <div className="stats-inline">
          <div>
            <label>Step 1</label>
            <strong>Propose</strong>
            <p className="text-soft ignition-mini">Pay $50 USDC to launch a permissionless question.</p>
          </div>
          <div>
            <label>Step 2</label>
            <strong>Virtual Bonding Curve</strong>
            <p className="text-soft ignition-mini">YES/NO commitments price on virtual reserves, not AMM/CLOB.</p>
          </div>
          <div>
            <label>Step 3</label>
            <strong>Graduation</strong>
            <p className="text-soft ignition-mini">$10k TVL + 30 participants before expiry deploys live market.</p>
          </div>
        </div>
        <div className="ob-notice" style={{ marginTop: 10 }}>
          <strong>Bonding curve clarity:</strong> during Ignition, price discovery is simulated via constant-product
          virtual reserves. AMM trading and CLOB orders start only after graduation.
          <br />
          <strong>Vesting:</strong> after graduation, early backers claim LP shares linearly over 14 days.
          <br />
          <strong>Non-graduation outcome:</strong> if criteria are not met by expiry (~30 days), participants get
          refunded 100% of committed USDC. Only the creator&apos;s $50 proposal fee is retained by protocol.
        </div>
      </section>

      <section className="card tab-card" style={{ marginTop: 12 }}>
        <div className="section-label">On-Chain Ignition Launches</div>
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Question</th>
              <th className="r">Status</th>
              <th className="r">TVL</th>
              <th className="r">Participants</th>
              <th className="r">Days Left</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6}>No ignition markets active</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} style={{ cursor: "pointer" }} onClick={() => onOpenLaunch(row.id)}>
                  <td>#{row.id}</td>
                  <td>{row.question}</td>
                  <td className="r">{statusName(row.status)}</td>
                  <td className="r">${row.tvl.toFixed(2)}</td>
                  <td className="r">{row.participants}</td>
                  <td className="r">{row.status === 1 ? row.days : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {showPropose && <ProposeModal onClose={() => setShowPropose(false)} />}
    </div>
  );
}

export default IgnitionPage;
