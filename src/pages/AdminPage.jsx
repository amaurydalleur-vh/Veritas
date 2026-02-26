import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import {
  useFactoryOwner,
  useIsAuctionAuthorized,
  useSetAuthorizedCreator,
  useAdminCreateMarket,
  useCreateAuction,
  useApproveUSDC,
  useUSDCBalance,
  useUSDCAllowance,
  useSeedLiquidityPerSide,
} from "../web3/hooks.js";
import { ADDRESSES } from "../web3/contracts.js";

// Duration presets in seconds
const DURATION_OPTIONS = [
  { label: "7 days",   value: 7  * 86400 },
  { label: "14 days",  value: 14 * 86400 },
  { label: "30 days",  value: 30 * 86400 },
  { label: "60 days",  value: 60 * 86400 },
  { label: "90 days",  value: 90 * 86400 },
  { label: "180 days", value: 180 * 86400 },
];

const COMMIT_OPTIONS = [
  { label: "24 hours", value: 86400 },
  { label: "48 hours", value: 2 * 86400 },
  { label: "72 hours", value: 3 * 86400 },
];

const REVEAL_OPTIONS = [
  { label: "12 hours", value: 12 * 3600 },
  { label: "24 hours", value: 86400 },
  { label: "48 hours", value: 2 * 86400 },
];

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { data: owner } = useFactoryOwner();

  const isOwner = isConnected && owner && address?.toLowerCase() === owner?.toLowerCase();

  if (!isConnected) return <AdminShell><p className="admin-hint">Connect your wallet to continue.</p></AdminShell>;
  if (!owner)       return <AdminShell><p className="admin-hint">Loading…</p></AdminShell>;
  if (!isOwner)     return null; // invisible to non-owners

  return (
    <AdminShell>
      <SetupSection />
      <CreateMarketSection />
      <CreateAuctionSection />
    </AdminShell>
  );
}

function AdminShell({ children }) {
  return (
    <div className="container page">
      <div className="admin-header">
        <span className="admin-badge">ADMIN</span>
        <h1 className="admin-title">Market Control Panel</h1>
        <p className="admin-subtitle">Visible only to the deployer wallet. Not linked from the public UI.</p>
      </div>
      {children}
    </div>
  );
}

// ── Section 1: Setup ─────────────────────────────────────────────────────

function SetupSection() {
  const { data: isAuthorized, refetch } = useIsAuctionAuthorized();
  const { setAuthorized, isPending, isConfirming, isSuccess, error } = useSetAuthorizedCreator();
  const auctionDeployed = !!ADDRESSES.dutchAuction;

  useEffect(() => { if (isSuccess) refetch(); }, [isSuccess, refetch]);

  return (
    <div className="admin-card">
      <h2 className="admin-section-title">Setup</h2>
      <div className="admin-row">
        <div className="admin-status-row">
          <span className="admin-label">Dutch Auction contract</span>
          <StatusDot ok={auctionDeployed} label={auctionDeployed ? ADDRESSES.dutchAuction : "Not deployed — run npm run deploy:testnet"} />
        </div>
        {auctionDeployed && (
          <div className="admin-status-row">
            <span className="admin-label">Authorized as factory creator</span>
            <StatusDot ok={!!isAuthorized} label={isAuthorized ? "Registered" : "Not registered"} />
          </div>
        )}
        {auctionDeployed && !isAuthorized && (
          <button
            className="admin-btn"
            disabled={isPending || isConfirming}
            onClick={() => setAuthorized(ADDRESSES.dutchAuction, true)}
          >
            {isPending || isConfirming ? "Registering…" : "Register Dutch Auction"}
          </button>
        )}
        {error && <p className="admin-error">{error.shortMessage || error.message}</p>}
      </div>
    </div>
  );
}

// ── Section 2: Create instant market ─────────────────────────────────────

function CreateMarketSection() {
  const { address } = useAccount();
  const [question, setQuestion]   = useState("");
  const [duration, setDuration]   = useState(DURATION_OPTIONS[2].value); // 30 days default
  const [step, setStep]           = useState("idle"); // idle | approving | creating | done

  const { data: seedPerSide }  = useSeedLiquidityPerSide();
  const seedTotal               = seedPerSide ? seedPerSide * 2n : 0n;
  const seedDisplay             = seedPerSide ? formatUnits(seedPerSide, 6) : "…";

  const { data: balance }      = useUSDCBalance(address);
  const { data: allowance, refetch: refetchAllowance } = useUSDCAllowance(address, ADDRESSES.factory);

  const needsApproval = allowance !== undefined && seedTotal > 0n && allowance < seedTotal;

  const { approve, isPending: approvePending, isConfirming: approveConfirming, isSuccess: approveSuccess } = useApproveUSDC();
  const { createMarket, isPending: createPending, isConfirming: createConfirming, isSuccess: createSuccess, error: createError } = useAdminCreateMarket();

  useEffect(() => { if (approveSuccess) { refetchAllowance(); setStep("creating"); } }, [approveSuccess, refetchAllowance]);
  useEffect(() => { if (createSuccess)  setStep("done"); }, [createSuccess]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    if (needsApproval) {
      setStep("approving");
      approve(ADDRESSES.factory, Number(formatUnits(seedTotal, 6)));
    } else {
      setStep("creating");
      createMarket(question.trim(), duration);
    }
  };

  // Trigger createMarket after approve completes
  useEffect(() => {
    if (step === "creating" && !createPending && !createConfirming && !createSuccess) {
      createMarket(question.trim(), duration);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const busy = approvePending || approveConfirming || createPending || createConfirming;

  return (
    <div className="admin-card">
      <h2 className="admin-section-title">Create Instant Market</h2>
      <p className="admin-meta">
        Deploys a VeritasMarket immediately. Requires <strong>{seedDisplay} USDC per side ({formatUnits(seedTotal || 0n, 6)} total)</strong> from your wallet.
        Your balance: <strong>{balance !== undefined ? Number(formatUnits(balance, 6)).toLocaleString() : "…"} USDC</strong>
      </p>

      {step === "done" ? (
        <div className="admin-success">
          Market created successfully.{" "}
          <button className="admin-link" onClick={() => { setQuestion(""); setStep("idle"); }}>Create another</button>
        </div>
      ) : (
        <form className="admin-form" onSubmit={handleSubmit}>
          <label className="admin-field-label">Market question</label>
          <textarea
            className="admin-textarea"
            placeholder="Will Bitcoin exceed $200,000 before end of 2026?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            maxLength={500}
            rows={3}
          />

          <label className="admin-field-label">Duration</label>
          <div className="admin-pill-row">
            {DURATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`admin-pill ${duration === opt.value ? "active" : ""}`}
                onClick={() => setDuration(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {createError && <p className="admin-error">{createError.shortMessage || createError.message}</p>}

          <button className="admin-btn primary" type="submit" disabled={busy || !question.trim()}>
            {step === "approving" && (approvePending || approveConfirming)
              ? "Approving USDC…"
              : step === "creating" && (createPending || createConfirming)
              ? "Creating market…"
              : needsApproval
              ? "Approve USDC → Create Market"
              : "Create Market"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Section 3: Launch Dutch Auction ──────────────────────────────────────

function CreateAuctionSection() {
  const auctionDeployed = !!ADDRESSES.dutchAuction;
  const { data: isAuthorized } = useIsAuctionAuthorized();

  const [question,       setQuestion]       = useState("");
  const [commitDuration, setCommitDuration] = useState(COMMIT_OPTIONS[1].value); // 48h
  const [revealDuration, setRevealDuration] = useState(REVEAL_OPTIONS[1].value); // 24h
  const [marketDuration, setMarketDuration] = useState(DURATION_OPTIONS[2].value); // 30 days
  const [done,           setDone]           = useState(false);

  const { createAuction, isPending, isConfirming, isSuccess, error } = useCreateAuction();

  useEffect(() => { if (isSuccess) setDone(true); }, [isSuccess]);

  const notReady = !auctionDeployed || !isAuthorized;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim() || notReady) return;
    createAuction(question.trim(), commitDuration, revealDuration, marketDuration);
  };

  return (
    <div className="admin-card">
      <h2 className="admin-section-title">Launch Dutch Auction</h2>
      <p className="admin-meta">
        Opens a sealed-bid bootstrapping auction. No upfront USDC required — participants fund the AMM seed.
        Commit → Reveal → Finalize → VeritasMarket deploys automatically.
      </p>

      {notReady && (
        <div className="admin-notice">
          Complete the Setup section above before launching an auction.
        </div>
      )}

      {done ? (
        <div className="admin-success">
          Auction created. Participants can now commit sealed bids.{" "}
          <button className="admin-link" onClick={() => { setQuestion(""); setDone(false); }}>
            Create another
          </button>
        </div>
      ) : (
        <form className="admin-form" onSubmit={handleSubmit}>
          <label className="admin-field-label">Market question</label>
          <textarea
            className="admin-textarea"
            placeholder="Will the Fed cut rates before September 2026?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            maxLength={500}
            rows={3}
            disabled={notReady}
          />

          <div className="admin-duration-grid">
            <div>
              <label className="admin-field-label">Commit window</label>
              <div className="admin-pill-row">
                {COMMIT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`admin-pill ${commitDuration === opt.value ? "active" : ""}`}
                    onClick={() => setCommitDuration(opt.value)}
                    disabled={notReady}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="admin-field-label">Reveal window</label>
              <div className="admin-pill-row">
                {REVEAL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`admin-pill ${revealDuration === opt.value ? "active" : ""}`}
                    onClick={() => setRevealDuration(opt.value)}
                    disabled={notReady}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="admin-field-label">Market duration (post-graduation)</label>
              <div className="admin-pill-row">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`admin-pill ${marketDuration === opt.value ? "active" : ""}`}
                    onClick={() => setMarketDuration(opt.value)}
                    disabled={notReady}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="admin-timeline">
            <span>Timeline:</span>
            <strong>
              Commit {COMMIT_OPTIONS.find(o => o.value === commitDuration)?.label}
              {" → "}Reveal {REVEAL_OPTIONS.find(o => o.value === revealDuration)?.label}
              {" → "}Market runs {DURATION_OPTIONS.find(o => o.value === marketDuration)?.label}
            </strong>
          </div>

          {error && <p className="admin-error">{error.shortMessage || error.message}</p>}

          <button
            className="admin-btn primary"
            type="submit"
            disabled={notReady || isPending || isConfirming || !question.trim()}
          >
            {isPending || isConfirming ? "Launching…" : "Launch Auction"}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────

function StatusDot({ ok, label }) {
  return (
    <span className="admin-status">
      <span className={`admin-dot ${ok ? "ok" : "warn"}`} />
      <span className="admin-status-label">{label}</span>
    </span>
  );
}
