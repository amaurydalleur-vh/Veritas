import React, { useState } from "react";
import { useAccount } from "wagmi";
import SectionHeader from "../../components/SectionHeader";
import { marketRows } from "../../data/platformContent";
import { useMarketsInfo } from "../../web3/hooks";
import { isDeployed } from "../../web3/contracts";
import TradeModal from "../../components/TradeModal";

function fmtUSDC(raw) {
  if (!raw && raw !== 0n) return '---';
  const n = Number(raw) / 1e6;
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function calcProb(yesRaw, noRaw) {
  const yes = Number(yesRaw || 0n);
  const no  = Number(noRaw  || 0n);
  const total = yes + no;
  if (total === 0) return '50.0%';
  return ((no / total) * 100).toFixed(1) + '%';
}

function MarketsBoardSection() {
  const { address } = useAccount();
  const deployed = isDeployed();
  const { data: chainData, isLoading } = useMarketsInfo(0, 20);
  const [tradeMarket, setTradeMarket] = useState(null);

  const rows = React.useMemo(() => {
    if (deployed && chainData) {
      const [addrs, questions, reservesYes, reservesNo, settledFlags, expiresAts] = chainData;
      return addrs.map((addr, i) => ({
        address:     addr,
        question:    questions[i],
        probability: calcProb(reservesYes[i], reservesNo[i]),
        tvl:         fmtUSDC((reservesYes[i] || 0n) + (reservesNo[i] || 0n)),
        settled:     settledFlags[i],
        expiresAt:   Number(expiresAts[i]),
      }));
    }
    return marketRows.map(r => ({
      address:     null,
      question:    r.market,
      probability: r.probability,
      tvl:         r.openInterest,
      settled:     false,
      expiresAt:   null,
    }));
  }, [deployed, chainData]);

  return (
    <section id='live-markets' className='content-section'>
      <SectionHeader
        eyebrow='Markets'
        title='Live Market Board'
        subtitle={deployed ? 'On-chain markets — probability, TVL, and minority-side yield.' : 'Representative markets. Deploy contracts to show live on-chain data.'}
      />

      {deployed && isLoading && (
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Loading on-chain markets...</p>
      )}

      <div className='table-wrap'>
        <table>
          <thead>
            <tr>
              <th>Market</th>
              <th>Implied Probability</th>
              <th>TVL / Open Interest</th>
              <th>Status</th>
              {address && deployed && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.address || i}>
                <td style={{ maxWidth: 320 }}>{row.question}</td>
                <td>{row.probability}</td>
                <td>{row.tvl}</td>
                <td>
                  <span className={'badge ' + (row.settled ? 'badge-neutral' : 'badge-ok')}>
                    {row.settled ? 'Settled' : 'Active'}
                  </span>
                </td>
                {address && deployed && (
                  <td>
                    {!row.settled && row.address && (
                      <button className='btn btn-primary compact' onClick={() => setTradeMarket(row)} type='button'>Trade</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>No markets deployed yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {!deployed && (
        <p className='deploy-notice'>Connect wallet and run npm run deploy:testnet to activate live data.</p>
      )}

      {tradeMarket && (
        <TradeModal market={tradeMarket} onClose={() => setTradeMarket(null)} />
      )}
    </section>
  );
}

export default MarketsBoardSection;
