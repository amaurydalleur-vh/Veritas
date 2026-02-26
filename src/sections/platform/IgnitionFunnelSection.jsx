import React, { useState } from "react";
import { useAccount } from "wagmi";
import SectionHeader from "../../components/SectionHeader";
import { ignitionFunnel } from "../../data/platformContent";
import { useLaunchCount } from "../../web3/hooks";
import { isDeployed, ADDRESSES } from "../../web3/contracts";
import ProposeModal from "../../components/ProposeModal";

function IgnitionFunnelSection() {
  const { address } = useAccount();
  const deployed = isDeployed();
  const { data: launchCount } = useLaunchCount();
  const [showPropose, setShowPropose] = useState(false);

  const items = [
    { label: 'Total Proposed', value: deployed && launchCount !== undefined ? launchCount.toString() : ignitionFunnel[0].value },
    { label: 'Graduation Target TVL', value: '$10,000' },
    { label: 'Graduation Target Users', value: '30' },
    { label: 'Creation Fee', value: '$50' },
  ];

  return (
    <section id='launch-funnel' className='content-section'>
      <SectionHeader
        eyebrow='Ignition'
        title='Launch Funnel and Graduation Progress'
        subtitle='Lifecycle visibility from market proposal to transition into the core market layer.'
      />

      <div className='funnel-grid'>
        {items.map((item) => (
          <article className='panel-card funnel-card' key={item.label}>
            <p>{item.label}</p>
            <h3>{item.value}</h3>
          </article>
        ))}
      </div>

      {address && deployed && (
        <div style={{ marginTop: '2rem' }}>
          <button className='btn btn-primary' type='button' onClick={() => setShowPropose(true)}>
            + Propose Market (USD 50)
          </button>
        </div>
      )}

      {!deployed && (
        <p className='deploy-notice'>Deploy contracts to enable live Ignition data and market proposals.</p>
      )}

      {showPropose && (
        <ProposeModal onClose={() => setShowPropose(false)} />
      )}
    </section>
  );
}

export default IgnitionFunnelSection;
