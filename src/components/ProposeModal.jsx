import React, { useState, useEffect } from "react";
import { parseUnits } from "viem";
import { useApproveUSDC, useProposeMarket, useUSDCAllowance } from "../web3/hooks";
import { ADDRESSES } from "../web3/contracts";
import { useAccount } from "wagmi";

const CREATION_FEE = parseUnits('50', 6); // 50 USDC

function ProposeModal({ onClose }) {
  const { address } = useAccount();
  const [question, setQuestion] = useState('');
  const [step, setStep] = useState('input');

  const { data: allowance, refetch } = useUSDCAllowance(address, ADDRESSES.ignition);
  const { approve, isPending: approvePending, isSuccess: approveOk } = useApproveUSDC();
  const { propose, isPending: proposePending, isSuccess: proposeOk, error } = useProposeMarket();

  const needsApproval = allowance !== undefined && allowance < CREATION_FEE;

  useEffect(() => { if (approveOk) { refetch(); setStep('proposing'); } }, [approveOk]);
  useEffect(() => { if (proposeOk) setStep('done'); }, [proposeOk]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!question.trim()) return;
    if (needsApproval) {
      setStep('approving');
      approve(ADDRESSES.ignition, '50');
    } else {
      setStep('proposing');
      propose(question.trim());
    }
  }

  function handlePropose() {
    propose(question.trim());
  }

  return (
    <div className='modal-backdrop' onClick={onClose}>
      <div className='modal-card' onClick={e => e.stopPropagation()}>
        <div className='modal-header'>
          <h3>Propose Market</h3>
          <button className='modal-close' onClick={onClose} type='button'>×</button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Cost: 50 USDC creation fee (non-refundable)
        </p>

        {step === 'done' ? (
          <div className='modal-success'>
            <p>Market proposed successfully! It is now active in the Ignition funnel.</p>
            <button className='btn btn-primary' onClick={onClose} type='button'>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='trade-form'>
            <label className='trade-label'>
              Market Question
              <textarea
                placeholder='e.g. Will ETH exceed $5,000 before July 1, 2026?'
                value={question}
                onChange={e => setQuestion(e.target.value)}
                className='trade-input'
                rows={3}
                maxLength={500}
              />
            </label>
            {step === 'approving' && approvePending && <p className='status-msg'>Approving 50 USDC...</p>}
            {step === 'proposing' && proposePending && <p className='status-msg'>Submitting proposal...</p>}
            {error && <p className='error-msg'>{error.shortMessage || error.message}</p>}

            {step === 'proposing' && !proposePending ? (
              <button className='btn btn-primary' type='button' onClick={handlePropose}>Confirm Proposal</button>
            ) : (
              <button className='btn btn-primary' type='submit' disabled={approvePending || proposePending || !question.trim()}>
                {needsApproval ? 'Approve 50 USDC' : 'Propose Market'}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default ProposeModal;
