import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import {
  useApproveUSDC,
  useUSDCAllowance,
  useUSDCBalance,
  useTrade,
  formatUSDC,
} from "../web3/hooks";
import { ADDRESSES } from "../web3/contracts";

/**
 * TradeModal
 * Approve USDC -> Trade YES/NO on a market.
 */
function TradeModal({ market, onClose }) {
  const { address } = useAccount();
  const [buyYes, setBuyYes] = useState(true);
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState('input'); // input | approving | trading | done

  const { data: balance } = useUSDCBalance(address);
  const { data: allowance, refetch: refetchAllowance } = useUSDCAllowance(address, market.address);

  const { approve, isPending: approvePending, isSuccess: approveSuccess } = useApproveUSDC();
  const { trade, isPending: tradePending, isSuccess: tradeSuccess, error: tradeError } = useTrade();

  // After approval confirmed, advance to trading step
  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
      setStep('trading');
    }
  }, [approveSuccess]);

  // After trade confirmed
  useEffect(() => {
    if (tradeSuccess) setStep('done');
  }, [tradeSuccess]);

  const amountBig = amount ? parseUnits(amount, 6) : 0n;
  const needsApproval = allowance !== undefined && allowance < amountBig;

  function handleSubmit(e) {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;

    if (needsApproval) {
      setStep('approving');
      approve(market.address, amount);
    } else {
      setStep('trading');
      trade(market.address, buyYes, amount, 0n);
    }
  }

  function handleTrade() {
    trade(market.address, buyYes, amount, 0n);
  }

  return (
    <div className='modal-backdrop' onClick={onClose}>
      <div className='modal-card' onClick={e => e.stopPropagation()}>
        <div className='modal-header'>
          <h3>Trade</h3>
          <button className='modal-close' onClick={onClose} type='button'>x</button>
        </div>

        <p className='modal-question'>{market.question}</p>

        {step === 'done' ? (
          <div className='modal-success'>
            <p>Trade submitted successfully.</p>
            <button className='btn btn-primary' onClick={onClose} type='button'>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='trade-form'>
            <div className='direction-toggle'>
              <button
                type='button'
                className={'direction-btn' + (buyYes ? ' active-yes' : '')}
                onClick={() => setBuyYes(true)}
              >YES</button>
              <button
                type='button'
                className={'direction-btn' + (!buyYes ? ' active-no' : '')}
                onClick={() => setBuyYes(false)}
              >NO</button>
            </div>

            <label className='trade-label'>
              Amount (USDC)
              <input
                type='number'
                min='1'
                step='1'
                placeholder='e.g. 100'
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className='trade-input'
              />
            </label>

            {balance !== undefined && (
              <p className='balance-hint'>Balance: {formatUSDC(balance)} USDC</p>
            )}

            {step === 'approving' && approvePending && (
              <p className='status-msg'>Approving USDC... confirm in wallet</p>
            )}
            {step === 'trading' && tradePending && (
              <p className='status-msg'>Submitting trade... confirm in wallet</p>
            )}
            {tradeError && (
              <p className='error-msg'>{tradeError.shortMessage || tradeError.message}</p>
            )}

            {step === 'trading' && !tradePending ? (
              <button className='btn btn-primary' type='button' onClick={handleTrade}>
                Confirm Trade
              </button>
            ) : (
              <button
                className='btn btn-primary'
                type='submit'
                disabled={approvePending || tradePending || !amount}
              >
                {needsApproval ? 'Approve USDC' : (buyYes ? 'Buy YES' : 'Buy NO')}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default TradeModal;
