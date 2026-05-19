/**
 * Willow React Hooks - Token and Validator Operations Example
 *
 * Demonstrates read-only economic operations:
 * 1. Query token information
 * 2. Check DID balances
 * 3. Check subgrove balances
 * 4. View fee schedules
 * 5. List validators
 * 6. View validator details
 * 7. View staking statistics
 *
 * Note: transfer and fundSubgrove are write operations. They go through the
 * consensus client (`useWillow().client.consensus.transfer(...)` etc.) and
 * aren't covered by these read-only hooks.
 *
 * Prerequisites:
 * - npm install @willow/react-hooks @willow/sdk
 * - Run a local Willow node
 */

import React, { useState } from 'react';
import {
  WillowProvider,
  useAuth,
  useTokenInfo,
  useBalance,
  useSubgroveBalance,
  useFeeSchedule,
  useValidators,
  useValidator,
  useValidatorSet,
} from '@willow/react-hooks';

function TokenValidatorContent() {
  const { isAuthenticated, generateAndRegister, clearIdentity, isGenerating } = useAuth();
  const [did, setDid] = useState<string | null>(null);

  if (!isAuthenticated || !did) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Willow Token & Validator Demo</h1>
        <button
          onClick={async () => {
            const r = await generateAndRegister();
            setDid(r.did);
          }}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate DID & Login'}
        </button>
      </div>
    );
  }

  return (
    <AuthenticatedContent
      did={did}
      onLogout={() => {
        clearIdentity();
        setDid(null);
      }}
    />
  );
}

function AuthenticatedContent({
  did,
  onLogout,
}: {
  did: string;
  onLogout: () => void;
}) {
  const [selectedSubgrove, setSelectedSubgrove] = useState<string>('demo-subgrove');
  const [selectedValidator, setSelectedValidator] = useState<string | null>(null);

  const { tokenInfo, isLoading: tokenInfoLoading, error: tokenInfoError } = useTokenInfo();
  const { balance, isLoading: balanceLoading, error: balanceError } = useBalance(did);
  const {
    balance: subgroveBalance,
    isLoading: subgroveBalanceLoading,
    error: subgroveBalanceError,
  } = useSubgroveBalance(selectedSubgrove);
  const { feeSchedule, isLoading: feeLoading, error: feeError } = useFeeSchedule();

  const {
    validators,
    isLoading: validatorsLoading,
    error: validatorsError,
    refetch: refetchValidators,
  } = useValidators();
  const { validator, isLoading: validatorLoading } = useValidator(selectedValidator);
  const { validatorSet, totalVotingPower, blockHeight, isLoading: validatorSetLoading } =
    useValidatorSet();

  return (
    <div style={{ padding: '20px' }}>
      <h1>Willow Token & Validator Demo</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <p>
          <strong>Authenticated as:</strong> {did.substring(0, 30)}...
        </p>
        <button onClick={onLogout}>Logout</button>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ borderBottom: '2px solid #1976d2', paddingBottom: '10px' }}>
          Token Operations
        </h2>

        <section style={{ marginBottom: '30px' }}>
          <h3>1. Token Information</h3>
          {tokenInfoLoading ? (
            <p>Loading token info...</p>
          ) : tokenInfoError ? (
            <p style={{ color: 'red' }}>Error: {tokenInfoError.message}</p>
          ) : tokenInfo ? (
            <div style={{ background: '#e3f2fd', padding: '10px' }}>
              <p>
                <strong>Name:</strong> {tokenInfo.name}
              </p>
              <p>
                <strong>Symbol:</strong> {tokenInfo.symbol}
              </p>
              <p>
                <strong>Decimals:</strong> {tokenInfo.decimals}
              </p>
              <p>
                <strong>Circulating supply:</strong> {tokenInfo.circulating_supply}
              </p>
              <p>
                <strong>Max supply:</strong> {tokenInfo.max_supply}
              </p>
            </div>
          ) : (
            <p>No token info available</p>
          )}
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h3>2. Your Account Balance</h3>
          {balanceLoading ? (
            <p>Loading balance...</p>
          ) : balanceError ? (
            <p style={{ color: 'red' }}>Error: {balanceError.message}</p>
          ) : balance ? (
            <div style={{ background: '#e8f5e9', padding: '10px' }}>
              <p>
                <strong>Available:</strong> {balance.available} WILL
              </p>
              <p>
                <strong>Staked:</strong> {balance.staked} WILL
              </p>
              <p>
                <strong>Locked:</strong> {balance.locked} WILL
              </p>
              <p>
                <strong>Total balance:</strong> {balance.balance} WILL
              </p>
            </div>
          ) : (
            <p>No balance data.</p>
          )}
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h3>3. Subgrove Balance</h3>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Subgrove ID:{' '}
              <input
                type="text"
                value={selectedSubgrove}
                onChange={(e) => setSelectedSubgrove(e.target.value)}
                style={{ padding: '5px' }}
              />
            </label>
          </div>
          {subgroveBalanceLoading ? (
            <p>Loading subgrove balance...</p>
          ) : subgroveBalanceError ? (
            <p style={{ color: 'orange' }}>Subgrove not found or no balance</p>
          ) : subgroveBalance ? (
            <div style={{ background: '#fff3e0', padding: '10px' }}>
              <p>
                <strong>Subgrove balance:</strong> {subgroveBalance.balance} WILL
              </p>
            </div>
          ) : (
            <p>No subgrove balance data</p>
          )}
        </section>

        <section style={{ marginBottom: '30px' }}>
          <h3>4. Fee Schedule</h3>
          {feeLoading ? (
            <p>Loading fee schedule...</p>
          ) : feeError ? (
            <p style={{ color: 'red' }}>Error: {feeError.message}</p>
          ) : feeSchedule ? (
            <div style={{ background: '#fce4ec', padding: '10px' }}>
              <p>
                <strong>Storage per byte:</strong> {feeSchedule.cost_per_byte} WILL
              </p>
              <p>
                <strong>Query fee:</strong> {feeSchedule.query_fee} WILL
              </p>
              <p>
                <strong>Base tx cost:</strong> {feeSchedule.base_tx_cost} WILL
              </p>
              <p>
                <strong>DID registration:</strong> {feeSchedule.did_registration} WILL
              </p>
              <p>
                <strong>Subgrove registration:</strong> {feeSchedule.subgrove_registration} WILL
              </p>
            </div>
          ) : (
            <p>No fee schedule available</p>
          )}
        </section>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ borderBottom: '2px solid #388e3c', paddingBottom: '10px' }}>
          Validator Operations
        </h2>

        <section style={{ marginBottom: '30px' }}>
          <h3>5. Active Validators</h3>
          {validatorsLoading ? (
            <p>Loading validators...</p>
          ) : validatorsError ? (
            <p style={{ color: 'red' }}>Error: {validatorsError.message}</p>
          ) : (
            <div>
              <p>Total validators: {validators.length}</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Address</th>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Voting Power</th>
                    <th style={{ padding: '8px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {validators.slice(0, 5).map((v, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}>{v.address.substring(0, 20)}...</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ color: v.status === 'active' ? 'green' : 'orange' }}>
                          {v.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{v.voting_power}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedValidator(v.address)}
                          style={{ fontSize: '12px' }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => refetchValidators()} style={{ marginTop: '10px' }}>
                Refresh
              </button>
            </div>
          )}
        </section>

        {selectedValidator && (
          <section style={{ marginBottom: '30px' }}>
            <h3>6. Validator Details</h3>
            {validatorLoading ? (
              <p>Loading validator details...</p>
            ) : validator ? (
              <div style={{ background: '#e8f5e9', padding: '10px' }}>
                <p>
                  <strong>Address:</strong> {validator.address}
                </p>
                <p>
                  <strong>Status:</strong> {validator.status}
                </p>
                <p>
                  <strong>Voting power:</strong> {validator.voting_power}
                </p>
                <p>
                  <strong>Proposer priority:</strong> {validator.proposer_priority}
                </p>
                {validator.moniker && (
                  <p>
                    <strong>Moniker:</strong> {validator.moniker}
                  </p>
                )}
                <button onClick={() => setSelectedValidator(null)}>Close</button>
              </div>
            ) : (
              <p>Validator not found</p>
            )}
          </section>
        )}

        <section style={{ marginBottom: '30px' }}>
          <h3>7. Validator Set Summary</h3>
          {validatorSetLoading ? (
            <p>Loading validator set...</p>
          ) : validatorSet ? (
            <div style={{ background: '#f3e5f5', padding: '10px' }}>
              <p>
                <strong>Block height:</strong> {blockHeight}
              </p>
              <p>
                <strong>Total validators:</strong> {validatorSet.validators.length}
              </p>
              <p>
                <strong>Total voting power:</strong> {totalVotingPower}
              </p>
            </div>
          ) : (
            <p>No validator set data</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default function TokenAndValidatorsExample() {
  return (
    <WillowProvider config={{ apiUrl: 'http://localhost:3031' }}>
      <TokenValidatorContent />
    </WillowProvider>
  );
}
