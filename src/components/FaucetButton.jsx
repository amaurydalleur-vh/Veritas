import React from "react";
import { useAccount } from "wagmi";
import { useFaucet, useUSDCBalance, formatUSDC } from "../web3/hooks";
import { isDeployed } from "../web3/contracts";

function FaucetButton() {
  const { address } = useAccount();
  const deployed = isDeployed();
  const { data: balance, refetch } = useUSDCBalance(address);
  const { claimFaucet, isPending, isConfirming, isSuccess } = useFaucet();

  if (!address || !deployed) return null;

  function handleClick() {
    claimFaucet();
  }

  // Refetch balance after success
  React.useEffect(() => {
    if (isSuccess) refetch();
  }, [isSuccess]);

  const label = isPending
    ? 'Confirm...'
    : isConfirming
    ? 'Claiming...'
    : isSuccess
    ? 'Claimed!'
    : 'Get USDC';

  return (
    <div className='faucet-wrap'>
      {balance !== undefined && (
        <span className='usdc-balance'>{formatUSDC(balance)} USDC</span>
      )}
      <button
        className='btn btn-faucet compact'
        onClick={handleClick}
        disabled={isPending || isConfirming}
        type='button'
        title='Claim 10,000 test USDC'
      >
        {label}
      </button>
    </div>
  );
}

export default FaucetButton;
