import React, { useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { parseUnits } from "viem";
import {
  useApproveUSDC,
  useUSDCAllowance,
  useLaunch,
  useVirtualProbability,
  useCommit,
  useCheckGraduation,
  useIgnitionRefund,
  useClaimVested,
} from "../web3/hooks";
import { ABIS, ADDRESSES } from "../web3/contracts";

const STATUS = ["Pending", "Active", "Graduated", "Expired", "Rejected"];
const VESTING_CLIFF_SECONDS = 14 * 24 * 60 * 60;
const GRADUATION_TVL_USDC = 10_000;
const GRADUATION_USERS = 30;

function toNum(v, div = 1) {
  return Number(v ?? 0n) / div;
}

function statusLabel(raw) {
  const idx = Number(raw ?? 0);
  return STATUS[idx] ?? `Unknown(${idx})`;
}

function IgnitionDetailPage({ launchId, onBack, onOpenLiveMarket }) {
  const { address: walletAddress } = useAccount();
  const { data: launch, refetch: refetchLaunch } = useLaunch(launchId);
  const { data: virtualProb, refetch: refetchVirtualProb } = useVirtualProbability(launchId);
  const [side, setSide] = useState("YES");
  const [amount, setAmount] = useState("100");
  const [checkAttempted, setCheckAttempted] = useState(false);

  const question = launch?.question ?? launch?.[0] ?? "Ignition launch";
  const createdAt = Number(launch?.createdAt ?? launch?.[2] ?? 0n);
  const expiresAt = Number(launch?.expiresAt ?? launch?.[3] ?? 0n);
  const status = Number(launch?.status ?? launch?.[4] ?? 0);
  const tvl = launch?.tvl ?? launch?.[5] ?? 0n;
  const participants = launch?.participants ?? launch?.[6] ?? 0n;
  const marketAddress = launch?.market ?? launch?.[7] ?? "0x0000000000000000000000000000000000000000";
  const graduatedAt = Number(launch?.graduatedAt ?? launch?.[8] ?? 0n);
  const seedYes = launch?.seedYes ?? launch?.[9] ?? 0n;
  const seedNo = launch?.seedNo ?? launch?.[10] ?? 0n;

  const now = Math.floor(Date.now() / 1000);
  const remainingSec = Math.max(0, expiresAt - now);
  const remainingDays = Math.ceil(remainingSec / 86400);
  const yesPct = virtualProb != null ? Number(virtualProb) / 1e16 : 50;
  const noPct = 100 - yesPct;
  const amountWei = useMemo(() => {
    try {
      return parseUnits(amount || "0", 6);
    } catch {
      return 0n;
    }
  }, [amount]);

  const { data: allowance, refetch: refetchAllowance } = useUSDCAllowance(walletAddress, ADDRESSES.ignition);
  const { approve, isPending: approvePending, isConfirming: approveConfirming, isSuccess: approveOk } = useApproveUSDC();
  const { commit, isPending: commitPending, isConfirming: commitConfirming, isSuccess: commitOk, error: commitError } = useCommit();
  const { checkGraduation, isPending: checkPending, isConfirming: checkConfirming, isSuccess: checkOk, error: checkError } = useCheckGraduation();
  const { refund, isPending: refundPending, isConfirming: refundConfirming, isSuccess: refundOk, error: refundError } = useIgnitionRefund();
  const { claimVested, isPending: claimPending, isConfirming: claimConfirming, isSuccess: claimOk, error: claimError } = useClaimVested();

  const { data: committedByUser, refetch: refetchCommitted } = useReadContract({
    address: ADDRESSES.ignition,
    abi: ABIS.ignition,
    functionName: "committed",
    args: [BigInt(launchId), walletAddress],
    query: { enabled: !!walletAddress && launchId !== undefined && !!ADDRESSES.ignition },
  });
  const { data: claimedYesByUser, refetch: refetchClaimedYes } = useReadContract({
    address: ADDRESSES.ignition,
    abi: ABIS.ignition,
    functionName: "claimedYes",
    args: [BigInt(launchId), walletAddress],
    query: { enabled: !!walletAddress && launchId !== undefined && !!ADDRESSES.ignition },
  });
  const { data: claimedNoByUser, refetch: refetchClaimedNo } = useReadContract({
    address: ADDRESSES.ignition,
    abi: ABIS.ignition,
    functionName: "claimedNo",
    args: [BigInt(launchId), walletAddress],
    query: { enabled: !!walletAddress && launchId !== undefined && !!ADDRESSES.ignition },
  });

  const needsApproval = !allowance || allowance < amountWei;
  const isActive = status === 1;
  const isGraduated = status === 2;
  const isRefundable = status === 3 || status === 4;
  const hasLiveMarket = !!marketAddress && marketAddress !== "0x0000000000000000000000000000000000000000";
  const tvlNum = Number(tvl) / 1e6;
  const participantsNum = Number(participants);
  const tvlToGo = Math.max(0, GRADUATION_TVL_USDC - tvlNum);
  const participantsToGo = Math.max(0, GRADUATION_USERS - participantsNum);
  const meetsGraduation = tvlNum >= GRADUATION_TVL_USDC && participantsNum >= GRADUATION_USERS && remainingSec > 0;
  const vestingElapsed = isGraduated ? Math.max(0, now - graduatedAt) : 0;
  const vestingBps = isGraduated ? Math.min(10_000, Math.floor((vestingElapsed * 10_000) / VESTING_CLIFF_SECONDS)) : 0;
  const totalEntitledYes = tvl > 0n ? ((committedByUser ?? 0n) * seedYes) / tvl : 0n;
  const totalEntitledNo = tvl > 0n ? ((committedByUser ?? 0n) * seedNo) / tvl : 0n;
  const vestedYes = (totalEntitledYes * BigInt(vestingBps)) / 10_000n;
  const vestedNo = (totalEntitledNo * BigInt(vestingBps)) / 10_000n;
  const claimableYes = vestedYes - (claimedYesByUser ?? 0n);
  const claimableNo = vestedNo - (claimedNoByUser ?? 0n);

  const refresh = () => {
    refetchLaunch();
    refetchVirtualProb();
    refetchAllowance();
    refetchCommitted();
    refetchClaimedYes();
    refetchClaimedNo();
  };

  React.useEffect(() => {
    if (approveOk || commitOk || checkOk || refundOk || claimOk) {
      refresh();
    }
  }, [approveOk, commitOk, checkOk, refundOk, claimOk]);

  return (
    <div className="container page">
      <button className="btn btn-ghost" onClick={onBack}>
        Back to Ignition
      </button>

      <div className="page-header">
        <h1 className="page-title">{question}</h1>
        <p className="page-sub">Ignition virtual bonding curve phase. AMM/CLOB is enabled only after graduation.</p>
      </div>

      <div className="detail-layout">
        <section>
          <div className="card tab-card">
            <div className="section-label">Ignition State</div>
            <div className="stats-inline">
              <div>
                <label>Status</label>
                <strong>{statusLabel(status)}</strong>
              </div>
              <div>
                <label>Virtual YES / NO</label>
                <strong>{yesPct.toFixed(1)}% / {noPct.toFixed(1)}%</strong>
              </div>
              <div>
                <label>TVL</label>
                <strong>${toNum(tvl, 1e6).toFixed(2)}</strong>
              </div>
            </div>
            <div className="stats-inline" style={{ marginTop: 8 }}>
              <div>
                <label>Participants</label>
                <strong>{Number(participants)}</strong>
              </div>
              <div>
                <label>Created</label>
                <strong>{createdAt ? new Date(createdAt * 1000).toLocaleDateString("en-US") : "-"}</strong>
              </div>
              <div>
                <label>Time to expiry</label>
                <strong>{remainingSec > 0 ? `${remainingDays}d` : "Expired"}</strong>
              </div>
            </div>
          </div>

          {isActive && (
            <div className="card tab-card" style={{ marginTop: 12 }}>
              <div className="section-label">Commit on Virtual Curve</div>
              <div className="ob-notice" style={{ marginBottom: 10 }}>
                Commitments execute on Ignition virtual reserves, not on AMM/CLOB. Graduation deploys the live market.
                <br />
                If this launch does not graduate before expiry, participants get refunded committed USDC in full.
                The $50 creation fee remains protocol-retained.
              </div>
              <div className="trade-side">
                <button
                  className={`btn btn-yes ${side === "YES" ? "active" : ""}`}
                  onClick={() => setSide("YES")}
                >
                  Commit YES
                </button>
                <button
                  className={`btn btn-no ${side === "NO" ? "active" : ""}`}
                  onClick={() => setSide("NO")}
                >
                  Commit NO
                </button>
              </div>
              <label className="inp-label">Commit Size (USDC)</label>
              <input className="inp" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {needsApproval ? (
                <button
                  className="btn btn-primary w100"
                  disabled={!walletAddress || amountWei === 0n || approvePending || approveConfirming}
                  onClick={() => approve(ADDRESSES.ignition, amount || "0")}
                >
                  {approvePending || approveConfirming ? "Approving..." : "Approve USDC"}
                </button>
              ) : (
                <button
                  className="btn btn-primary w100"
                  disabled={!walletAddress || amountWei === 0n || commitPending || commitConfirming}
                  onClick={() => commit(launchId, side === "YES", Number(amount || 0))}
                >
                  {commitPending || commitConfirming ? "Committing..." : `Commit ${side}`}
                </button>
              )}
              {(commitError || checkError) && (
                <div className="ob-notice" style={{ color: "var(--red)", marginTop: 8 }}>
                  {(commitError?.shortMessage ?? commitError?.message) || (checkError?.shortMessage ?? checkError?.message)}
                </div>
              )}
              <button
                className="btn btn-ghost w100"
                style={{ marginTop: 8 }}
                disabled={checkPending || checkConfirming}
                onClick={() => {
                  setCheckAttempted(true);
                  checkGraduation(launchId);
                }}
              >
                {checkPending || checkConfirming ? "Checking..." : "Check Graduation"}
              </button>
              {checkAttempted && checkOk && status === 1 && (
                <div className="ob-notice" style={{ marginTop: 8 }}>
                  Graduation check completed: criteria are not met yet.
                  <br />
                  Remaining threshold: ${tvlToGo.toFixed(2)} TVL and {participantsToGo} participant(s).
                </div>
              )}
              {checkAttempted && checkOk && status === 2 && (
                <div className="ob-notice" style={{ color: "var(--jade)", marginTop: 8 }}>
                  Graduation triggered successfully. This launch is now live.
                </div>
              )}
              {!meetsGraduation && status === 1 && (
                <div className="ob-notice" style={{ marginTop: 8 }}>
                  Graduation requires ${GRADUATION_TVL_USDC.toLocaleString()} TVL and {GRADUATION_USERS} participants.
                  Current: ${tvlNum.toFixed(2)} and {participantsNum}.
                </div>
              )}
            </div>
          )}

          {isRefundable && (
            <div className="card tab-card" style={{ marginTop: 12 }}>
              <div className="section-label">Refund</div>
              <div className="ob-notice">
                This launch is {statusLabel(status).toLowerCase()}. You can refund your committed USDC.
              </div>
              <button
                className="btn btn-primary w100"
                disabled={!walletAddress || (committedByUser ?? 0n) === 0n || refundPending || refundConfirming}
                onClick={() => refund(launchId)}
              >
                {refundPending || refundConfirming ? "Refunding..." : "Refund Commitment"}
              </button>
              {refundError && (
                <div className="ob-notice" style={{ color: "var(--red)", marginTop: 8 }}>
                  {refundError.shortMessage ?? refundError.message}
                </div>
              )}
            </div>
          )}

          {isGraduated && (
            <div className="card tab-card" style={{ marginTop: 12 }}>
              <div className="section-label">Graduated Launch - Vested LP Claim</div>
              <div className="stats-inline">
                <div>
                  <label>Vesting Progress</label>
                  <strong>{(vestingBps / 100).toFixed(2)}%</strong>
                </div>
                <div>
                  <label>Claimable YES</label>
                  <strong>{toNum(claimableYes, 1e6).toFixed(2)}</strong>
                </div>
                <div>
                  <label>Claimable NO</label>
                  <strong>{toNum(claimableNo, 1e6).toFixed(2)}</strong>
                </div>
              </div>
              <button
                className="btn btn-primary w100"
                disabled={!walletAddress || (claimableYes === 0n && claimableNo === 0n) || claimPending || claimConfirming}
                onClick={() => claimVested(launchId)}
              >
                {claimPending || claimConfirming ? "Claiming..." : "Claim Vested LP Shares"}
              </button>
              {claimError && (
                <div className="ob-notice" style={{ color: "var(--red)", marginTop: 8 }}>
                  {claimError.shortMessage ?? claimError.message}
                </div>
              )}
              {hasLiveMarket && (
                <button
                  className="btn btn-ghost w100"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    onOpenLiveMarket({
                      id: `onchain-${marketAddress.toLowerCase()}`,
                      address: marketAddress,
                      question,
                      category: "ONCHAIN",
                      phase: "core",
                      yes: yesPct / 100,
                      no: noPct / 100,
                      tvl: toNum(tvl, 1e6),
                      vol: 0,
                      skew: Math.round(yesPct),
                      days: 30,
                      participants: Number(participants),
                      minApy: 0,
                      majApy: 0,
                      history: Array(10).fill(Math.round(yesPct)),
                    })
                  }
                >
                  Open Live Market
                </button>
              )}
            </div>
          )}
        </section>

        <aside className="trade-card">
          <h3>Your Ignition Position</h3>
          <div className="trade-stats">
            <div>
              <span>Committed USDC</span>
              <strong>${toNum(committedByUser, 1e6).toFixed(2)}</strong>
            </div>
            <div>
              <span>Total entitled YES/NO</span>
              <strong>{toNum(totalEntitledYes, 1e6).toFixed(2)} / {toNum(totalEntitledNo, 1e6).toFixed(2)}</strong>
            </div>
            <div>
              <span>Already claimed YES/NO</span>
              <strong>{toNum(claimedYesByUser, 1e6).toFixed(2)} / {toNum(claimedNoByUser, 1e6).toFixed(2)}</strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default IgnitionDetailPage;
